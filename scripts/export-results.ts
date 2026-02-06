/**
 * Export eval results to JSON format for nextjs.org/evals
 *
 * Usage:
 *   npx tsx scripts/export-results.ts [experiments...]
 *
 * Examples:
 *   npx tsx scripts/export-results.ts claude-opus-4.5 gemini-3-pro
 *   npx tsx scripts/export-results.ts  # exports latest from all experiments
 *
 * Output: agent-results.json (copy this to front repo)
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { generateObject, createGateway } from 'ai';
import { z } from 'zod';

// Load .env.local then .env (first file found wins per-variable)
for (const envFile of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // File doesn't exist, skip
  }
}

interface SummaryJson {
  totalRuns: number;
  passedRuns: number;
  meanDuration: number;
}

interface AgentResult {
  evalPath: string;
  result: {
    success: boolean;
    duration: number;
    evalPath: string;
    timestamp: string;
    failureType?: 'model' | 'infra' | 'timeout';
    failureReason?: string;
  };
}

interface ExportedData {
  metadata: {
    exportedAt: string;
    experiments: Array<{
      name: string;
      timestamp: string;
      modelName: string;
      agentHarness: string;
    }>;
  };
  results: Record<string, AgentResult[]>;
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-4.6': 'Claude Opus 4.6',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'gemini-3-pro-preview': 'Gemini 3 Pro Preview',
  'gpt-5.2-codex': 'GPT 5.2 Codex',
  'gpt-5.3-codex': 'GPT 5.3 Codex',
  'deepseek-v3.2': 'DeepSeek V3.2',
  'devstral-2': 'Devstral 2',
  'minimax-m2.1': 'Minimax M2.1',
  'kat-coder-pro-v1': 'Kat Coder Pro V1',
};

const HARNESS_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  'vercel-ai-gateway/opencode': 'OpenCode',
};

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

const CLASSIFIER_SYSTEM_PROMPT = `You are an eval failure classifier. Given information about a failed evaluation run, classify the failure into one of three categories:

- "model": The AI model failed to produce correct code or made logical/coding errors. The infrastructure worked fine but the model's output was wrong.
- "infra": The failure was caused by infrastructure issues like sandbox timeouts, network errors, Docker problems, file system issues, missing dependencies, or tool execution failures unrelated to the model's capability.
- "timeout": The eval run exceeded its time limit. This is a special case — it could be infra OR model related, but we track it separately.`;

const classificationSchema = z.object({
  failureType: z.enum(['model', 'infra', 'timeout']),
  reasoning: z.string().describe('A brief (1-2 sentence) explanation of the classification'),
});

async function readFileOrEmpty(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch {
    return '';
  }
}

const MAX_FILE_CHARS = 10_000;
const MAX_TOTAL_CHARS = 40_000;

async function collectRunFiles(dir: string, prefix = ''): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries.sort()) {
    const fullPath = join(dir, entry);
    const relPath = prefix ? `${prefix}/${entry}` : entry;
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...await collectRunFiles(fullPath, relPath));
    } else {
      const content = await readFileOrEmpty(fullPath);
      if (content) files.push({ path: relPath, content });
    }
  }
  return files;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n... (truncated, ${text.length - max} chars omitted)`;
}

async function classifyFailure(
  resultsDir: string,
  experiment: string,
  timestamp: string,
  evalDir: string
): Promise<{ failureType: 'model' | 'infra' | 'timeout'; failureReason: string } | null> {
  const runDir = join(resultsDir, experiment, timestamp, evalDir, 'run-1');
  const files = await collectRunFiles(runDir);

  const sections: string[] = [`## Eval: ${evalDir}`, ''];
  let totalChars = 0;
  for (const file of files) {
    const truncated = truncate(file.content, MAX_FILE_CHARS);
    if (totalChars + truncated.length > MAX_TOTAL_CHARS) {
      sections.push(`### ${file.path}`, truncate(truncated, MAX_TOTAL_CHARS - totalChars), '');
      break;
    }
    sections.push(`### ${file.path}`, truncated, '');
    totalChars += truncated.length;
  }

  const userMessage = sections.join('\n');

  try {
    const { object } = await generateObject({
      model: gateway('anthropic/claude-haiku-4-5'),
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: userMessage,
      schema: classificationSchema,
    });

    return {
      failureType: object.failureType,
      failureReason: object.reasoning,
    };
  } catch (err) {
    console.warn(`  Failed to classify ${evalDir}: ${err}`);
    return null;
  }
}

async function getAgentHarness(experiment: string): Promise<string> {
  try {
    const configPath = join('experiments', `${experiment}.ts`);
    const content = await readFile(configPath, 'utf-8');
    const match = content.match(/agent:\s*['"]([^'"]+)['"]/);
    if (match) {
      return HARNESS_NAMES[match[1]] || match[1];
    }
  } catch {
    // Config file may not exist for old results
  }
  return 'Unknown';
}

function parseTimestamp(ts: string): string {
  const match = ts.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d+)Z$/
  );
  if (match) {
    return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  }
  return ts;
}

function formatModelName(experiment: string): string {
  return MODEL_NAMES[experiment] || experiment;
}

async function getLatestTimestamp(expDir: string): Promise<string | null> {
  try {
    const timestamps = await readdir(expDir);
    const validTimestamps = timestamps.filter((ts) => !ts.startsWith('.'));
    if (validTimestamps.length === 0) return null;

    let latest: { ts: string; date: Date } | null = null;
    for (const ts of validTimestamps) {
      const parsed = parseTimestamp(ts);
      const date = new Date(parsed);
      if (!isNaN(date.getTime()) && (!latest || date > latest.date)) {
        latest = { ts, date };
      }
    }
    return latest?.ts || null;
  } catch {
    return null;
  }
}

interface ExperimentExport {
  modelName: string;
  agentHarness: string;
  timestamp: string;
  results: AgentResult[];
  // Maps evalDir -> raw timestamp directory name (for file lookups)
  evalTimestamps: Record<string, string>;
}

async function exportExperiment(
  resultsDir: string,
  experiment: string
): Promise<ExperimentExport | null> {
  const expDir = join(resultsDir, experiment);

  try {
    await stat(expDir);
  } catch {
    console.warn(`Experiment not found: ${experiment}`);
    return null;
  }

  // Scan all timestamps and take the latest result per eval
  const allTimestamps = (await readdir(expDir)).filter((ts) => !ts.startsWith('.'));
  if (allTimestamps.length === 0) {
    console.warn(`No results found for: ${experiment}`);
    return null;
  }

  // Sort timestamps newest first
  const sortedTimestamps = allTimestamps.sort((a, b) => {
    const da = new Date(parseTimestamp(a));
    const db = new Date(parseTimestamp(b));
    return db.getTime() - da.getTime();
  });

  const latestTimestamp = sortedTimestamps[0];
  const agentResults: AgentResult[] = [];
  const seenEvals = new Set<string>();
  const evalTimestamps: Record<string, string> = {};

  for (const timestamp of sortedTimestamps) {
    const runDir = join(expDir, timestamp);
    let evalDirs: string[];
    try {
      evalDirs = await readdir(runDir);
    } catch {
      continue;
    }

    for (const evalDir of evalDirs) {
      if (evalDir.startsWith('.') || seenEvals.has(evalDir)) continue;

      const summaryPath = join(runDir, evalDir, 'summary.json');
      try {
        const summaryRaw = await readFile(summaryPath, 'utf-8');
        const summary: SummaryJson = JSON.parse(summaryRaw);

        agentResults.push({
          evalPath: evalDir,
          result: {
            success: summary.passedRuns > 0,
            duration: summary.meanDuration * 1000,
            evalPath: evalDir,
            timestamp: parseTimestamp(timestamp),
          },
        });
        seenEvals.add(evalDir);
        evalTimestamps[evalDir] = timestamp;
      } catch {
        // Skip evals without summary
      }
    }
  }

  const timestamp = latestTimestamp;

  if (agentResults.length === 0) {
    console.warn(`No eval results found for: ${experiment}`);
    return null;
  }

  const agentHarness = await getAgentHarness(experiment);

  return {
    modelName: formatModelName(experiment),
    agentHarness,
    timestamp,
    results: agentResults.sort((a, b) => a.evalPath.localeCompare(b.evalPath)),
    evalTimestamps,
  };
}

async function main(): Promise<void> {
  const resultsDir = join(process.cwd(), 'results');

  let experiments = process.argv.slice(2);

  if (experiments.length === 0) {
    // Export from all experiments with results
    const allDirs = await readdir(resultsDir);
    experiments = allDirs.filter((d) => !d.startsWith('.'));
  }

  console.log(`Exporting from experiments: ${experiments.join(', ')}\n`);

  const exportedData: ExportedData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      experiments: [],
    },
    results: {},
  };

  // Track experiment data for classification pass
  const experimentDataList: Array<{ experiment: string; data: ExperimentExport }> = [];

  for (const experiment of experiments) {
    const data = await exportExperiment(resultsDir, experiment);
    if (!data) continue;

    const passed = data.results.filter((r) => r.result.success).length;
    console.log(`${experiment} -> ${data.modelName}: ${data.results.length} evals, ${passed} passed`);

    exportedData.metadata.experiments.push({
      name: experiment,
      timestamp: parseTimestamp(data.timestamp),
      modelName: data.modelName,
      agentHarness: data.agentHarness,
    });

    // Merge results by agent name
    if (exportedData.results[data.modelName]) {
      exportedData.results[data.modelName].push(...data.results);
    } else {
      exportedData.results[data.modelName] = data.results;
    }

    experimentDataList.push({ experiment, data });
  }

  // Classify failures using AI
  if (process.env.AI_GATEWAY_API_KEY) {
    const failures: Array<{
      result: AgentResult;
      experiment: string;
      rawTimestamp: string;
    }> = [];

    for (const { experiment, data } of experimentDataList) {
      for (const result of data.results) {
        if (!result.result.success) {
          const rawTimestamp = data.evalTimestamps[result.evalPath];
          if (rawTimestamp) {
            failures.push({ result, experiment, rawTimestamp });
          }
        }
      }
    }

    if (failures.length > 0) {
      console.log(`\nClassifying ${failures.length} failures...`);

      const results = await Promise.all(
        failures.map(async ({ result, experiment, rawTimestamp }) => {
          const classification = await classifyFailure(
            resultsDir,
            experiment,
            rawTimestamp,
            result.evalPath
          );
          return { result, classification };
        })
      );

      for (const { result, classification } of results) {
        if (classification) {
          result.result.failureType = classification.failureType;
          result.result.failureReason = classification.failureReason;
          console.log(`  ${result.evalPath}: ${classification.failureType} — ${classification.failureReason}`);
        } else {
          console.log(`  ${result.evalPath}: (unclassified)`);
        }
      }
    }
  } else {
    console.log('\nSkipping failure classification (AI_GATEWAY_API_KEY not set)');
  }

  const outputPath = join(process.cwd(), 'agent-results.json');
  await writeFile(outputPath, JSON.stringify(exportedData, null, 2));

  console.log(`\nExported to: ${outputPath}`);
  console.log(
    `Agents: ${Object.keys(exportedData.results).join(', ') || 'none'}`
  );
}

main().catch(console.error);
