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

interface DocsImpact {
  baseSuccessRate: number;
  docsSuccessRate: number;
  delta: number;
  newlyPassed: string[];
  newlyFailed: string[];
}

interface ExportedData {
  metadata: {
    exportedAt: string;
    experiments: Array<{
      name: string;
      timestamp: string;
      modelName: string;
      agentHarness: string;
      docsImpact?: DocsImpact;
    }>;
  };
  results: Record<string, AgentResult[]>;
}

const MODEL_NAMES: Record<string, string> = {
  'claude-opus-4.6': 'Claude Opus 4.6',
  'claude-opus-4.6--agents-md': 'Claude Opus 4.6 + AGENTS.md',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-sonnet-4.5--agents-md': 'Claude Sonnet 4.5 + AGENTS.md',
  'claude-sonnet-4.6': 'Claude Sonnet 4.6',
  'claude-sonnet-4.6--agents-md': 'Claude Sonnet 4.6 + AGENTS.md',
  'cursor-composer-1.5': 'Cursor Composer 1.5',
  'cursor-composer-1.5--agents-md': 'Cursor Composer 1.5 + AGENTS.md',
  'cursor-composer-2.0': 'Cursor Composer 2.0',
  'cursor-composer-2.0--agents-md': 'Cursor Composer 2.0 + AGENTS.md',
  'gemini-3-pro-preview--agents-md': 'Gemini 3.0 Pro Preview + AGENTS.md',
  'gemini-3-pro-preview-gemini-cli': 'Gemini 3.0 Pro Preview',
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
  'gemini-3.1-pro-preview--agents-md': 'Gemini 3.1 Pro Preview + AGENTS.md',
  'gpt-5.2-codex-xhigh': 'GPT 5.2 Codex (xhigh)',
  'gpt-5.2-codex-xhigh--agents-md': 'GPT 5.2 Codex (xhigh) + AGENTS.md',
  'gpt-5.3-codex-xhigh': 'GPT 5.3 Codex (xhigh)',
  'gpt-5.3-codex-xhigh--agents-md': 'GPT 5.3 Codex (xhigh) + AGENTS.md',
};

const HARNESS_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'vercel-ai-gateway/opencode': 'OpenCode',
  'cursor': 'Cursor',
  'gemini': 'Gemini CLI',
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

    exportedData.results[experiment] = agentResults.sort((a, b) =>
      a.evalPath.localeCompare(b.evalPath)
    );
  }

  // Merge --agents-md variants into base experiments
  // variant → base (must use the same agent harness)
  const AGENTS_MD_PAIRS: Record<string, string> = {
    'claude-opus-4.6--agents-md': 'claude-opus-4.6',
    'claude-sonnet-4.5--agents-md': 'claude-sonnet-4.5',
    'claude-sonnet-4.6--agents-md': 'claude-sonnet-4.6',
    'cursor-composer-1.5--agents-md': 'cursor-composer-1.5',
    'cursor-composer-2.0--agents-md': 'cursor-composer-2.0',
    'gemini-3-pro-preview--agents-md': 'gemini-3-pro-preview-gemini-cli',
    'gemini-3.1-pro-preview--agents-md': 'gemini-3.1-pro-preview',
    'gpt-5.2-codex-xhigh--agents-md': 'gpt-5.2-codex-xhigh',
    'gpt-5.3-codex-xhigh--agents-md': 'gpt-5.3-codex-xhigh',
  };

  for (const [variantName, baseName] of Object.entries(AGENTS_MD_PAIRS)) {
    const baseExp = exportedData.metadata.experiments.find((e) => e.name === baseName);
    const variantExp = exportedData.metadata.experiments.find((e) => e.name === variantName);
    const baseResults = exportedData.results[baseName];
    const variantResults = exportedData.results[variantName];

    if (!variantExp || !variantResults) continue;

    // If only the variant exists (no base results), rename it and set docsImpact with only docsSuccessRate
    if (!baseExp || !baseResults) {
      const docsSuccessRate =
        (variantResults.filter((r) => r.result.success).length / variantResults.length) * 100;
      variantExp.name = baseName;
      variantExp.modelName = MODEL_NAMES[baseName] || baseName;
      variantExp.docsImpact = {
        baseSuccessRate: Math.round(docsSuccessRate),
        docsSuccessRate: Math.round(docsSuccessRate),
        delta: 0,
        newlyPassed: [],
        newlyFailed: [],
      };
      exportedData.results[baseName] = variantResults;
      delete exportedData.results[variantName];
      continue;
    }

    // Compute success rates
    const baseSuccessRate =
      (baseResults.filter((r) => r.result.success).length / baseResults.length) * 100;
    const docsSuccessRate =
      (variantResults.filter((r) => r.result.success).length / variantResults.length) * 100;

    // Find evals that flipped fail→pass and pass→fail
    const baseFailSet = new Set(
      baseResults.filter((r) => !r.result.success).map((r) => r.evalPath),
    );
    const basePassSet = new Set(
      baseResults.filter((r) => r.result.success).map((r) => r.evalPath),
    );
    const newlyPassed = variantResults
      .filter((r) => r.result.success && baseFailSet.has(r.evalPath))
      .map((r) => r.evalPath);
    const newlyFailed = variantResults
      .filter((r) => !r.result.success && basePassSet.has(r.evalPath))
      .map((r) => r.evalPath);

    // Attach docsImpact to the base experiment
    baseExp.docsImpact = {
      baseSuccessRate: Math.round(baseSuccessRate),
      docsSuccessRate: Math.round(docsSuccessRate),
      delta: Math.round(docsSuccessRate - baseSuccessRate),
      newlyPassed,
      newlyFailed,
    };

    // Use the variant's timestamp if it's newer
    baseExp.timestamp = variantExp.timestamp;

    // Replace base results with the --agents-md results (better scores)
    exportedData.results[baseName] = variantResults.map((r) => ({
      ...r,
      // Keep the evalPath as-is
    }));

    // Remove the variant from metadata and results
    exportedData.metadata.experiments = exportedData.metadata.experiments.filter(
      (e) => e.name !== variantName,
    );
    delete exportedData.results[variantName];
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
