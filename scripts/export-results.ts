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
      avgDuration?: number;
      docsImpact?: DocsImpact;
    }>;
  };
  results: Record<string, AgentResult[]>;
}

const MODEL_NAMES: Record<string, string> = {
  'claude-fable-5': 'Claude Fable 5',
  'claude-fable-5--agents-md': 'Claude Fable 5 + AGENTS.md',
  'claude-opus-4.6': 'Claude Opus 4.6',
  'claude-opus-4.6--agents-md': 'Claude Opus 4.6 + AGENTS.md',
  'claude-opus-4.7': 'Claude Opus 4.7 (max)',
  'claude-opus-4.7--agents-md': 'Claude Opus 4.7 (max) + AGENTS.md',
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
  'gpt-5.4-xhigh': 'GPT 5.4 (xhigh)',
  'gpt-5.4-xhigh--agents-md': 'GPT 5.4 (xhigh) + AGENTS.md',
  'kimi-k2.5': 'Kimi K2.5',
  'kimi-k2.5--agents-md': 'Kimi K2.5 + AGENTS.md',
  'kimi-k2.6': 'Kimi K2.6',
  'kimi-k2.6--agents-md': 'Kimi K2.6 + AGENTS.md',
  'minimax-m2.7': 'MiniMax M2.7',
  'minimax-m2.7--agents-md': 'MiniMax M2.7 + AGENTS.md',
  'minimax-m3': 'MiniMax M3',
  'minimax-m3--agents-md': 'MiniMax M3 + AGENTS.md',
  'glm-5.1': 'GLM 5.1',
  'glm-5.1-opencode': 'GLM 5.1',
  'glm-5.1-opencode--agents-md': 'GLM 5.1 + AGENTS.md',
  'glm-5.2': 'GLM 5.2',
  'glm-5.2--agents-md': 'GLM 5.2 + AGENTS.md',
};

const HARNESS_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  'codex': 'Codex',
  'vercel-ai-gateway/codex': 'Codex',
  'vercel-ai-gateway/opencode': 'OpenCode',
  'cursor': 'Cursor',
  'gemini': 'Gemini CLI',
  'vercel-ai-gateway/claude-code': 'Claude Code',
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
    async function hasSummaryJson(dir: string): Promise<boolean> {
      const entries = (await readdir(dir).catch(() => [] as string[])).filter((e) => !e.startsWith('.'));
      for (const entry of entries) {
        const full = join(dir, entry);
        try {
          await stat(join(full, 'summary.json'));
          return true;
        } catch {
          const s = await stat(full).catch(() => null);
          if (s?.isDirectory() && await hasSummaryJson(full)) return true;
        }
      }
      return false;
    }
    for (const dir of allDirs) {
      if (await hasSummaryJson(join(resultsDir, dir))) {
        withResults.push(dir);
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
    // Recursively find timestamp-like directories (handles model paths with slashes)
    async function findTimestampDirs(dir: string): Promise<{ts: string, dir: string}[]> {
      const entries = (await readdir(dir).catch(() => [] as string[])).filter((e) => !e.startsWith('.'));
      const results: {ts: string, dir: string}[] = [];
      for (const entry of entries) {
        const full = join(dir, entry);
        const isTimestamp = /^\d{4}-\d{2}-\d{2}T/.test(entry);
        if (isTimestamp) {
          results.push({ts: entry, dir: full});
        } else {
          const s = await stat(full).catch(() => null);
          if (s?.isDirectory()) {
            results.push(...await findTimestampDirs(full));
          }
        }
      }
      return results;
    }
    const timestampEntries = await findTimestampDirs(expDir);
    if (timestampEntries.length === 0) continue;

    const sortedEntries = timestampEntries.sort((a, b) => {
      const da = new Date(parseTimestamp(a.ts));
      const db = new Date(parseTimestamp(b.ts));
      return db.getTime() - da.getTime();
    });

    const latestTimestamp = sortedEntries[0].ts;
    const agentResults: AgentResult[] = [];
    const seenEvals = new Set<string>();

    for (const { ts: timestamp, dir: runDir } of sortedEntries) {
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
    'claude-fable-5--agents-md': 'claude-fable-5',
    'claude-opus-4.6--agents-md': 'claude-opus-4.6',
    'claude-opus-4.7--agents-md': 'claude-opus-4.7',
    'claude-sonnet-4.5--agents-md': 'claude-sonnet-4.5',
    'claude-sonnet-4.6--agents-md': 'claude-sonnet-4.6',
    'cursor-composer-1.5--agents-md': 'cursor-composer-1.5',
    'cursor-composer-2.0--agents-md': 'cursor-composer-2.0',
    'gemini-3-pro-preview--agents-md': 'gemini-3-pro-preview-gemini-cli',
    'gemini-3.1-pro-preview--agents-md': 'gemini-3.1-pro-preview',
    'gpt-5.2-codex-xhigh--agents-md': 'gpt-5.2-codex-xhigh',
    'gpt-5.3-codex-xhigh--agents-md': 'gpt-5.3-codex-xhigh',
    'gpt-5.4-xhigh--agents-md': 'gpt-5.4-xhigh',
    'kimi-k2.5--agents-md': 'kimi-k2.5',
    'kimi-k2.6--agents-md': 'kimi-k2.6',
    'minimax-m2.7--agents-md': 'minimax-m2.7',
    'minimax-m3--agents-md': 'minimax-m3',
    'glm-5.1-opencode--agents-md': 'glm-5.1-opencode',
    'glm-5.2--agents-md': 'glm-5.2',
  };

  for (const [variantName, baseName] of Object.entries(AGENTS_MD_PAIRS)) {
    const baseExp = exportedData.metadata.experiments.find((e) => e.name === baseName);
    const variantExp = exportedData.metadata.experiments.find((e) => e.name === variantName);
    const baseResults = exportedData.results[baseName];
    const variantResults = exportedData.results[variantName];

    if (!baseExp || !variantExp || !baseResults || !variantResults) continue;

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

    // Average duration across base + variant runs (seconds)
    const allDurationsMs = [...baseResults, ...variantResults].map(
      (r) => r.result.duration,
    );
    baseExp.avgDuration =
      allDurationsMs.reduce((a, b) => a + b, 0) / allDurationsMs.length / 1000;

    // Use the newer of base / variant timestamps
    if (new Date(variantExp.timestamp) > new Date(baseExp.timestamp)) {
      baseExp.timestamp = variantExp.timestamp;
    }

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

  // Fill avgDuration for any experiments that didn't go through the merge
  for (const exp of exportedData.metadata.experiments) {
    if (exp.avgDuration !== undefined) continue;
    const results = exportedData.results[exp.name];
    if (!results || results.length === 0) continue;
    const durations = results.map((r) => r.result.duration);
    exp.avgDuration =
      durations.reduce((a, b) => a + b, 0) / durations.length / 1000;
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
