/**
 * Export eval results to JSON format for nextjs.org/evals
 *
 * Reads results (with built-in classifications from agent-eval) and
 * exports clean results to agent-results.json.
 *
 * Usage:
 *   npx tsx scripts/export-results.ts [experiments...]
 *   npx tsx scripts/export-results.ts  # exports from all experiments
 *
 * Output: agent-results.json (copy this to front repo)
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

interface SummaryJson {
  totalRuns: number;
  passedRuns: number;
  meanDuration: number;
  valid?: boolean;
}

interface AgentResult {
  evalPath: string;
  result: {
    success: boolean;
    duration: number;
    evalPath: string;
    timestamp: string;
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
  'claude-opus-4.5-agents-md': 'Claude Opus 4.5 + AGENTS.md',
  'claude-opus-4.1': 'Claude Opus 4.1',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-sonnet-4.5-agentic-rag': 'Claude Sonnet 4.5 + Agentic RAG',
  'claude-sonnet-4': 'Claude Sonnet 4',
  'claude-haiku-4.5': 'Claude Haiku 4.5',
  'claude-3.7-sonnet': 'Claude 3.7 Sonnet',
  'gemini-3-pro-preview': 'Gemini 3.0 Pro Preview',
  'gemini-3-pro-preview-agents-md': 'Gemini 3.0 Pro Preview + AGENTS.md',
  'gemini-3-flash': 'Gemini 3.0 Flash',
  'gemini-3-flash-agents-md': 'Gemini 3.0 Flash + AGENTS.md',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'gemini-2.0-flash-lite': 'Gemini 2.0 Flash Lite',
  'gpt-5.2-codex': 'GPT 5.2 Codex',
  'gpt-5.2-codex-xhigh': 'GPT 5.2 Codex (xhigh)',
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
  'kimi-k2.5': 'Kimi K2.5',
  'devstral-2': 'Devstral 2',
  'minimax-m2.1': 'Minimax M2.1',
  'minimax-m2.1-agents-md': 'Minimax M2.1 + AGENTS.md',
  'kat-coder-pro-v1': 'Kat Coder Pro V1',
  'glm-4.6': 'GLM 4.6',
  'gpt-5.3-codex-xhigh': 'GPT 5.3 Codex (xhigh)',
  'v0-1.5-md': 'v0 1.5 MD',
};

const HARNESS_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'vercel-ai-gateway/opencode': 'OpenCode',
};

function parseTimestamp(ts: string): string {
  const match = ts.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d+)Z$/
  );
  if (match) {
    return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`;
  }
  return ts;
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

async function main(): Promise<void> {
  const resultsDir = join(process.cwd(), 'results');

  let experiments = process.argv.slice(2);

  if (experiments.length === 0) {
    // Auto-discover all experiments with results
    const allDirs = (await readdir(resultsDir)).filter((d) => !d.startsWith('.'));
    const withResults: string[] = [];
    for (const dir of allDirs) {
      const expDir = join(resultsDir, dir);
      const timestamps = (await readdir(expDir).catch(() => [] as string[])).filter(
        (t) => !t.startsWith('.')
      );
      for (const ts of timestamps) {
        const evalDirs = await readdir(join(expDir, ts)).catch(() => [] as string[]);
        for (const evalDir of evalDirs) {
          try {
            await stat(join(expDir, ts, evalDir, 'summary.json'));
            withResults.push(dir);
            break;
          } catch {
            /* empty */
          }
        }
        if (withResults.includes(dir)) break;
      }
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

  for (const experiment of experiments) {
    const expDir = join(resultsDir, experiment);
    try {
      await stat(expDir);
    } catch {
      console.warn(`Experiment not found: ${experiment}`);
      continue;
    }

    // Scan all timestamps and take the latest result per eval
    const allTimestamps = (await readdir(expDir)).filter((ts) => !ts.startsWith('.'));
    if (allTimestamps.length === 0) continue;

    const sortedTimestamps = allTimestamps.sort((a, b) => {
      const da = new Date(parseTimestamp(a));
      const db = new Date(parseTimestamp(b));
      return db.getTime() - da.getTime();
    });

    const latestTimestamp = sortedTimestamps[0];
    const agentResults: AgentResult[] = [];
    const seenEvals = new Set<string>();

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

          // Skip invalid results (infra/timeout failures)
          if (summary.valid === false) continue;

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
        } catch {
          // Skip evals without valid summary
        }
      }
    }

    if (agentResults.length === 0) {
      console.warn(`No valid results for: ${experiment}`);
      continue;
    }

    const modelName = MODEL_NAMES[experiment] || experiment;
    const agentHarness = await getAgentHarness(experiment);

    exportedData.metadata.experiments.push({
      name: experiment,
      timestamp: parseTimestamp(latestTimestamp),
      modelName,
      agentHarness,
    });

    if (exportedData.results[modelName]) {
      exportedData.results[modelName].push(
        ...agentResults.sort((a, b) => a.evalPath.localeCompare(b.evalPath))
      );
    } else {
      exportedData.results[modelName] = agentResults.sort((a, b) =>
        a.evalPath.localeCompare(b.evalPath)
      );
    }
  }

  // Count stats
  let totalSuccess = 0;
  let totalResults = 0;
  for (const results of Object.values(exportedData.results)) {
    for (const r of results) {
      totalResults++;
      if (r.result.success) totalSuccess++;
    }
  }

  const outputPath = join(process.cwd(), 'agent-results.json');
  await writeFile(outputPath, JSON.stringify(exportedData, null, 2));

  console.log('\n' + '-'.repeat(60));
  console.log(`Exported to: ${outputPath}`);
  console.log(`Total: ${totalResults} | Pass: ${totalSuccess} | Fail: ${totalResults - totalSuccess}`);
  console.log('-'.repeat(60));
}

main().catch(console.error);
