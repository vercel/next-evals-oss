/**
 * QA and export eval results to JSON format for nextjs.org/evals
 *
 * Classifies failures as model/infra/timeout, deletes non-model failure
 * results so they can be re-run, then exports clean results.
 *
 * Usage:
 *   npx tsx scripts/qa-and-export.ts [experiments...]
 *
 * Examples:
 *   npx tsx scripts/qa-and-export.ts claude-opus-4.5 gemini-3-pro
 *   npx tsx scripts/qa-and-export.ts  # exports latest from all experiments
 *
 * Output: agent-results.json (copy this to front repo)
 */

import { readdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { generateText, tool, createGateway, hasToolCall } from 'ai';
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
  'claude-opus-4.5': 'Claude Opus 4.5',
  'claude-opus-4.1': 'Claude Opus 4.1',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-sonnet-4': 'Claude Sonnet 4',
  'claude-haiku-4.5': 'Claude Haiku 4.5',
  'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
  'gemini-3-pro-preview': 'Gemini 3.0 Pro Preview',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gpt-5.2-codex': 'GPT 5.2 Codex',
  'gpt-5.3-codex': 'GPT 5.3 Codex',
  'gpt-5-codex': 'GPT 5 Codex',
  'gpt-5': 'GPT 5',
  'gpt-5-mini': 'GPT 5 Mini',
  'gpt-5-nano': 'GPT 5 Nano',
  'gpt-4o': 'GPT 4o',
  'gpt-4o-mini': 'GPT 4o Mini',
  'gpt-4.1-mini': 'GPT 4.1 Mini',
  'gpt-oss-120b': 'GPT OSS 120B',
  'grok-4': 'Grok 4',
  'grok-4-fast-reasoning': 'Grok 4 Fast Reasoning',
  'qwen3-coder': 'Qwen3 Coder',
  'qwen3-max': 'Qwen3 Max',
  'kimi-k2-turbo': 'Kimi K2 Turbo',
  'kimi-k2-0905': 'Kimi K2 0905',
  'deepseek-v3.2': 'DeepSeek V3.2',
  'devstral-2': 'Devstral 2',
  'minimax-m2.1': 'Minimax M2.1',
  'kat-coder-pro-v1': 'Kat Coder Pro V1',
  'glm-4.6': 'GLM 4.6',
  'v0-1.5-md': 'v0 1.5 MD',
};

const HARNESS_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  'vercel-ai-gateway/opencode': 'OpenCode',
};

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

const CLASSIFIER_SYSTEM_PROMPT = `You are a failure classifier for an AI coding agent benchmark.

Your job: figure out WHY a failed eval run failed. Each eval tests whether an AI model can complete a coding task (e.g. migrate to App Router, add a Next.js feature). You have tools to explore the result files.

Classify into one of:
- "model" — the model tried but wrote incorrect code
- "infra" — infrastructure broke (API errors, rate limits, crashes) and the model never got to do real work
- "timeout" — the run hit its time limit

The eval result directory contains run-1/ and run-2/ subdirectories (one per attempt), plus a summary.json. Each run has result.json, optionally transcript.jsonl, and outputs/ with build.txt and eval.txt.

IMPORTANT: The eval harness ALWAYS runs build + tests, even if the model produced nothing — tests just run against unmodified scaffold code (TODO placeholders). So test failures alone do NOT mean the model wrote code.

The transcript.jsonl is the key evidence. It records every action the model took. If there is no transcript.jsonl, or the transcript only shows errors (no tool calls or text output from the model), the model never actually ran — that's "infra". Only classify as "model" if you see evidence in the transcript that the model actually generated code.`;

/**
 * Validates and resolves a path, ensuring it stays within the allowed root.
 * Returns the resolved absolute path or null if invalid.
 */
function safePath(root: string, relativePath: string): string | null {
  const resolved = resolve(root, relativePath);
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

/**
 * Creates sandboxed read-only tools scoped to a specific eval result directory.
 */
function createClassifierTools(evalResultDir: string) {
  return {
    list_files: tool({
      description: 'List files and directories at a path relative to the eval result root. Use "." for the root.',
      inputSchema: z.object({
        path: z.string().describe('Relative path to list, e.g. "." or "run-1" or "run-1/outputs"'),
      }),
      execute: async ({ path: relPath }) => {
        const target = safePath(evalResultDir, relPath);
        if (!target) return { error: 'Path outside allowed directory' };
        try {
          const entries = await readdir(target);
          const results: Array<{ name: string; type: 'file' | 'dir' }> = [];
          for (const entry of entries.sort()) {
            const info = await stat(join(target, entry));
            results.push({ name: entry, type: info.isDirectory() ? 'dir' : 'file' });
          }
          return { entries: results };
        } catch {
          return { error: `Cannot list: ${relPath}` };
        }
      },
    }),

    read_file: tool({
      description: 'Read a file relative to the eval result root. For large files, use offset/limit to paginate.',
      inputSchema: z.object({
        path: z.string().describe('Relative path to the file, e.g. "run-1/result.json"'),
        offset: z.number().describe('Line offset to start reading from (0-based)').optional(),
        limit: z.number().describe('Max number of lines to return').optional(),
      }),
      execute: async ({ path: relPath, offset: rawOffset, limit: rawLimit }) => {
        const offset = rawOffset ?? 0;
        const limit = rawLimit ?? 200;
        const target = safePath(evalResultDir, relPath);
        if (!target) return { error: 'Path outside allowed directory' };
        try {
          const content = await readFile(target, 'utf-8');
          const lines = content.split('\n');
          const sliced = lines.slice(offset, offset + limit);
          return {
            content: sliced.join('\n'),
            totalLines: lines.length,
            showing: `lines ${offset}-${Math.min(offset + limit, lines.length)} of ${lines.length}`,
          };
        } catch {
          return { error: `Cannot read: ${relPath}` };
        }
      },
    }),

    grep: tool({
      description: 'Search for a pattern in files under a directory. Returns matching lines with context.',
      inputSchema: z.object({
        pattern: z.string().describe('Text or regex pattern to search for'),
        path: z.string().describe('Relative directory or file to search in, e.g. "." or "run-1"'),
        maxResults: z.number().describe('Max number of matches to return').optional(),
      }),
      execute: async ({ pattern, path: relPath, maxResults: rawMax }) => {
        const maxResults = rawMax ?? 20;
        const target = safePath(evalResultDir, relPath);
        if (!target) return { error: 'Path outside allowed directory' };
        const regex = new RegExp(pattern, 'i');
        const matches: Array<{ file: string; line: number; text: string }> = [];

        async function searchFile(filePath: string, relName: string) {
          try {
            const content = await readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && matches.length < maxResults; i++) {
              if (regex.test(lines[i])) {
                matches.push({ file: relName, line: i + 1, text: lines[i].slice(0, 500) });
              }
            }
          } catch {
            // Skip unreadable files
          }
        }

        async function searchDir(dirPath: string, prefix: string) {
          try {
            const entries = await readdir(dirPath);
            for (const entry of entries) {
              if (matches.length >= maxResults) break;
              const full = join(dirPath, entry);
              const rel = prefix ? `${prefix}/${entry}` : entry;
              const info = await stat(full);
              if (info.isDirectory()) {
                await searchDir(full, rel);
              } else {
                await searchFile(full, rel);
              }
            }
          } catch {
            // Skip unreadable dirs
          }
        }

        const info = await stat(target).catch(() => null);
        if (!info) return { error: `Path not found: ${relPath}` };
        if (info.isDirectory()) {
          await searchDir(target, relPath === '.' ? '' : relPath);
        } else {
          await searchFile(target, relPath);
        }

        return { matches, totalFound: matches.length, truncated: matches.length >= maxResults };
      },
    }),
  };
}

async function classifyFailure(
  resultsDir: string,
  experiment: string,
  timestamp: string,
  evalDir: string
): Promise<{ failureType: 'model' | 'infra' | 'timeout'; failureReason: string } | null> {
  const evalResultDir = join(resultsDir, experiment, timestamp, evalDir);
  const cachedPath = join(evalResultDir, 'classification.json');

  // Check for cached classification
  try {
    const cached = JSON.parse(await readFile(cachedPath, 'utf-8'));
    if (cached.failureType && cached.failureReason) {
      return { failureType: cached.failureType, failureReason: cached.failureReason };
    }
  } catch {
    // No cache, classify
  }

  // Use a shared variable to capture the classification from the tool call
  let classification: { failureType: 'model' | 'infra' | 'timeout'; failureReason: string } | null = null;

  const explorationTools = createClassifierTools(evalResultDir);
  const allTools = {
    ...explorationTools,
    classify: tool({
      description: 'Submit your final classification. Call this once you have enough evidence.',
      inputSchema: z.object({
        failureType: z.enum(['model', 'infra', 'timeout']).describe('The failure category'),
        failureReason: z.string().describe('Brief 1-2 sentence explanation of why'),
      }),
      execute: async ({ failureType, failureReason }) => {
        classification = { failureType, failureReason };
        return { ok: true };
      },
    }),
  };

  try {
    const verbose = process.env.VERBOSE === '1';
    await generateText({
      model: gateway('anthropic/claude-sonnet-4-5'),
      system: CLASSIFIER_SYSTEM_PROMPT,
      prompt: `Classify the failure for eval "${evalDir}" (experiment: ${experiment}). Use the exploration tools to investigate, then call classify() with your verdict.`,
      tools: allTools,
      stopWhen: hasToolCall('classify'),
      onStepFinish: verbose ? (event) => {
        const calls = event.toolCalls ?? [];
        for (const tc of calls) {
          const args = JSON.stringify(tc.args ?? tc.input ?? {});
          console.log(`  [${evalDir}] ${tc.toolName}(${args.slice(0, 120)})`);
        }
      } : undefined,
    });

    if (!classification) {
      console.warn(`  No classification for ${evalDir}`);
      return null;
    }

    // Cache the classification
    await writeFile(cachedPath, JSON.stringify(classification, null, 2));
    return classification;
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
    // Export from all experiments that have at least one summary.json
    const allDirs = (await readdir(resultsDir)).filter((d) => !d.startsWith('.'));
    const withResults: string[] = [];
    for (const dir of allDirs) {
      const expDir = join(resultsDir, dir);
      const timestamps = (await readdir(expDir).catch(() => [] as string[])).filter((t) => !t.startsWith('.'));
      let hasSummary = false;
      for (const ts of timestamps) {
        const evalDirs = await readdir(join(expDir, ts)).catch(() => [] as string[]);
        for (const evalDir of evalDirs) {
          try {
            await stat(join(expDir, ts, evalDir, 'summary.json'));
            hasSummary = true;
            break;
          } catch {}
        }
        if (hasSummary) break;
      }
      if (hasSummary) withResults.push(dir);
    }
    experiments = withResults;
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
      const CLASSIFY_CONCURRENCY = 10;
      console.log(`Classifying ${failures.length} failures...`);

      const results: Array<{ result: AgentResult; classification: Awaited<ReturnType<typeof classifyFailure>> }> = [];
      for (let i = 0; i < failures.length; i += CLASSIFY_CONCURRENCY) {
        const batch = failures.slice(i, i + CLASSIFY_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async ({ result, experiment, rawTimestamp }) => {
            const classification = await classifyFailure(
              resultsDir,
              experiment,
              rawTimestamp,
              result.evalPath
            );
            return { result, classification };
          })
        );
        results.push(...batchResults);
      }

      for (const { result, classification } of results) {
        if (classification) {
          result.result.failureType = classification.failureType;
          result.result.failureReason = classification.failureReason;
        }
      }
    }

    // QA: delete results for non-model failures so they can be re-run
    const toDelete: Array<{ experiment: string; evalPath: string; rawTimestamp: string; failureType: string }> = [];
    for (const { experiment, data } of experimentDataList) {
      for (const result of data.results) {
        const ft = result.result.failureType;
        if (!result.result.success && ft && ft !== 'model') {
          const rawTimestamp = data.evalTimestamps[result.evalPath];
          if (rawTimestamp) {
            toDelete.push({ experiment, evalPath: result.evalPath, rawTimestamp, failureType: ft });
          }
        }
      }
    }

    if (toDelete.length > 0) {
      for (const { experiment, evalPath, rawTimestamp, failureType } of toDelete) {
        const expDir = join(resultsDir, experiment);
        const allTimestamps = (await readdir(expDir).catch(() => [])).filter((t) => !t.startsWith('.'));
        for (const ts of allTimestamps) {
          const evalDir = join(expDir, ts, evalPath);
          try {
            await rm(evalDir, { recursive: true });
          } catch {
            // Already deleted or doesn't exist in this timestamp
          }
        }
      }

      // Remove deleted results from export data
      const deleteSet = new Set(toDelete.map((d) => `${d.experiment}:${d.evalPath}`));
      for (const { experiment, data } of experimentDataList) {
        const modelName = data.modelName;
        if (exportedData.results[modelName]) {
          exportedData.results[modelName] = exportedData.results[modelName].filter(
            (r) => !deleteSet.has(`${experiment}:${r.evalPath}`)
          );
        }
      }
    }
  } else {
    console.log('\nSkipping failure classification (AI_GATEWAY_API_KEY not set)');
  }

  // Count final stats
  let totalSuccess = 0;
  let totalModel = 0;
  let totalInfra = 0;
  let totalTimeout = 0;
  let totalResults = 0;
  for (const results of Object.values(exportedData.results)) {
    for (const r of results) {
      totalResults++;
      if (r.result.success) totalSuccess++;
      else if (r.result.failureType === 'model') totalModel++;
      else if (r.result.failureType === 'infra') totalInfra++;
      else if (r.result.failureType === 'timeout') totalTimeout++;
    }
  }

  const outputPath = join(process.cwd(), 'agent-results.json');
  await writeFile(outputPath, JSON.stringify(exportedData, null, 2));

  console.log('\n' + '-'.repeat(60));
  console.log(`Exported to: ${outputPath}`);
  console.log(`Total: ${totalResults} | Pass: ${totalSuccess} | Model: ${totalModel} | Infra: ${totalInfra} | Timeout: ${totalTimeout}`);
  if (totalInfra > 0 || totalTimeout > 0) {
    console.log(`\n${totalInfra + totalTimeout} non-model failures were deleted. Run \`npm run run-evals\` to fill them back in.`);
  } else {
    console.log(`\nAll failures are model failures. No infra/timeout issues.`);
  }
  console.log('-'.repeat(60));
}

main().catch(console.error);
