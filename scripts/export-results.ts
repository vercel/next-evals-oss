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

import { execSync } from 'node:child_process';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { MODEL_PRICING, extractRunTokens, priceUsage } from './cost.js';

interface SummaryJson {
  totalRuns: number;
  passedRuns: number;
  meanDuration: number;
  valid?: boolean;
}

interface AgentResult {
  evalPath: string;
  // The experiment has no valid result for this eval (never ran it, or the
  // eval's content changed since). Counts against the success rate so every
  // experiment is scored over the same canonical eval set.
  notAvailable?: boolean;
  // Mean list cost in USD across this eval's runs, or undefined when the run
  // saved no token usage (e.g. a timeout) or the model has no price entry.
  costUsd?: number;
  result: {
    success: boolean;
    duration: number;
    evalPath: string;
    timestamp: string;
  };
}

// variant → base experiment (same agent harness). Hoisted to module scope so
// both cost pricing (per eval) and the docs-impact merge resolve the same base.
const AGENTS_MD_PAIRS: Record<string, string> = {
  'claude-fable-5--agents-md': 'claude-fable-5',
  'claude-opus-5--agents-md': 'claude-opus-5',
  'claude-sonnet-5--agents-md': 'claude-sonnet-5',
  'claude-opus-4.6--agents-md': 'claude-opus-4.6',
  'claude-opus-4.7--agents-md': 'claude-opus-4.7',
  'claude-opus-4.8--agents-md': 'claude-opus-4.8',
  'claude-sonnet-4.5--agents-md': 'claude-sonnet-4.5',
  'claude-sonnet-4.6--agents-md': 'claude-sonnet-4.6',
  'cursor-composer-2.0--agents-md': 'cursor-composer-2.0',
  'cursor-composer-2.5--agents-md': 'cursor-composer-2.5',
  'gemini-3-pro-preview--agents-md': 'gemini-3-pro-preview-gemini-cli',
  'gemini-3.1-pro-preview--agents-md': 'gemini-3.1-pro-preview',
  'gpt-5.2-codex-xhigh--agents-md': 'gpt-5.2-codex-xhigh',
  'gpt-5.3-codex-xhigh--agents-md': 'gpt-5.3-codex-xhigh',
  'gpt-5.4-xhigh--agents-md': 'gpt-5.4-xhigh',
  'gpt-5.5-pro--agents-md': 'gpt-5.5-pro',
  'gpt-5.6-sol-ultra--agents-md': 'gpt-5.6-sol-ultra',
  'kimi-k2.5--agents-md': 'kimi-k2.5',
  'kimi-k2.6--agents-md': 'kimi-k2.6',
  'kimi-k2.7-code--agents-md': 'kimi-k2.7-code',
  'kimi-k3--agents-md': 'kimi-k3',
  'minimax-m2.7--agents-md': 'minimax-m2.7',
  'minimax-m3--agents-md': 'minimax-m3',
  'glm-5.1-opencode--agents-md': 'glm-5.1-opencode',
  'glm-5.2--agents-md': 'glm-5.2',
  'grok-4.5--agents-md': 'grok-4.5',
  'grok-4.6--agents-md': 'grok-4.6',
};

/**
 * Mean list cost (USD) for one eval, averaged over its runs. Reads each run's
 * transcript-raw.jsonl, extracts tokens, and prices them at the experiment's
 * list rate. Returns undefined when the model has no price or no run carried
 * usage (e.g. a timeout), so the caller can leave it out of the average.
 */
async function meanEvalCostUsd(
  evalDir: string,
  experiment: string,
): Promise<number | undefined> {
  const baseSlug = AGENTS_MD_PAIRS[experiment] ?? experiment;
  const pricing = MODEL_PRICING[baseSlug];
  if (!pricing) return undefined;

  let runEntries: string[];
  try {
    runEntries = await readdir(evalDir);
  } catch {
    return undefined;
  }

  const costs: number[] = [];
  for (const entry of runEntries) {
    if (!entry.startsWith('run-')) continue;
    try {
      const raw = await readFile(join(evalDir, entry, 'transcript-raw.jsonl'), 'utf-8');
      const usage = extractRunTokens(raw);
      if (usage) costs.push(priceUsage(usage, pricing));
    } catch {
      // No transcript for this run (e.g. timeout) — skip it.
    }
  }

  if (costs.length === 0) return undefined;
  return costs.reduce((a, b) => a + b, 0) / costs.length;
}

/**
 * Mean per-eval list cost across results, over cells that have a cost. Returns
 * null when none do (so an all-timeout or unpriced experiment reads as N/A).
 */
function avgCost(results: AgentResult[]): number | null {
  const costs = results
    .filter((r) => !r.notAvailable && typeof r.costUsd === 'number')
    .map((r) => r.costUsd as number);
  if (costs.length === 0) return null;
  return costs.reduce((a, b) => a + b, 0) / costs.length;
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
      // Mean list cost per eval (USD). null = not estimated (no price, or the
      // model's runs carry no usable token usage) — rendered as N/A.
      avgCostUsd?: number | null;
      docsImpact?: DocsImpact;
      // 1 = current (fresh full run on the current eval set), 2 = previously
      // measured. See "Model retention policy" in the README.
      tier: 1 | 2;
    }>;
  };
  results: Record<string, AgentResult[]>;
}

/**
 * Tier-1 experiments per the README's "Model retention policy": the latest
 * version of each model family, plus the previous version if and only if the
 * current one was released less than a month after it. Membership implies a
 * commitment to keep the results fresh (rerun on eval-set/canary changes).
 * Everything else exports as tier 2: previously measured, dated, not rerun.
 *
 * grok-4.6 and gemini-3.1-pro-preview qualify by the rule but are exported as
 * tier 2 until they can actually be rerun (provider ACL / missing API key).
 */
const TIER_1 = new Set([
  'claude-fable-5',
  'claude-opus-5',
  'claude-sonnet-5',
  'gpt-5.6-sol-ultra',
  'gpt-5.3-codex-xhigh',
  'kimi-k3',
  'kimi-k2.7-code', // kimi-k3 shipped 29 days after it
  'cursor-composer-2.5',
  'glm-5.2',
  'minimax-m3',
]);

const MODEL_NAMES: Record<string, string> = {
  'claude-fable-5': 'Claude Fable 5 (high)',
  'claude-fable-5--agents-md': 'Claude Fable 5 (high) + AGENTS.md',
  'claude-opus-5': 'Claude Opus 5',
  'claude-opus-5--agents-md': 'Claude Opus 5 + AGENTS.md',
  'claude-sonnet-5': 'Claude Sonnet 5',
  'claude-sonnet-5--agents-md': 'Claude Sonnet 5 + AGENTS.md',
  'claude-opus-4.6': 'Claude Opus 4.6',
  'claude-opus-4.6--agents-md': 'Claude Opus 4.6 + AGENTS.md',
  'claude-opus-4.7': 'Claude Opus 4.7 (max)',
  'claude-opus-4.7--agents-md': 'Claude Opus 4.7 (max) + AGENTS.md',
  'claude-opus-4.8': 'Claude Opus 4.8',
  'claude-opus-4.8--agents-md': 'Claude Opus 4.8 + AGENTS.md',
  'claude-sonnet-4.5': 'Claude Sonnet 4.5',
  'claude-sonnet-4.5--agents-md': 'Claude Sonnet 4.5 + AGENTS.md',
  'claude-sonnet-4.6': 'Claude Sonnet 4.6',
  'claude-sonnet-4.6--agents-md': 'Claude Sonnet 4.6 + AGENTS.md',
  'cursor-composer-2.0': 'Cursor Composer 2.0',
  'cursor-composer-2.0--agents-md': 'Cursor Composer 2.0 + AGENTS.md',
  'cursor-composer-2.5': 'Cursor Composer 2.5',
  'cursor-composer-2.5--agents-md': 'Cursor Composer 2.5 + AGENTS.md',
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
  'gpt-5.5-pro': 'GPT 5.5 Pro',
  'gpt-5.5-pro--agents-md': 'GPT 5.5 Pro + AGENTS.md',
  'gpt-5.6-sol-ultra': 'GPT 5.6 Sol (ultra)',
  'gpt-5.6-sol-ultra--agents-md': 'GPT 5.6 Sol (ultra) + AGENTS.md',
  'kimi-k2.5': 'Kimi K2.5',
  'kimi-k2.5--agents-md': 'Kimi K2.5 + AGENTS.md',
  'kimi-k2.6': 'Kimi K2.6',
  'kimi-k2.6--agents-md': 'Kimi K2.6 + AGENTS.md',
  'kimi-k2.7-code': 'Kimi K2.7 Code',
  'kimi-k2.7-code--agents-md': 'Kimi K2.7 Code + AGENTS.md',
  'kimi-k3': 'Kimi K3',
  'kimi-k3--agents-md': 'Kimi K3 + AGENTS.md',
  'minimax-m2.7': 'MiniMax M2.7',
  'minimax-m2.7--agents-md': 'MiniMax M2.7 + AGENTS.md',
  'minimax-m3': 'MiniMax M3',
  'minimax-m3--agents-md': 'MiniMax M3 + AGENTS.md',
  'glm-5.1': 'GLM 5.1',
  'glm-5.1-opencode': 'GLM 5.1',
  'glm-5.1-opencode--agents-md': 'GLM 5.1 + AGENTS.md',
  'glm-5.2': 'GLM 5.2',
  'glm-5.2--agents-md': 'GLM 5.2 + AGENTS.md',
  'grok-4.5': 'Grok 4.5',
  'grok-4.5--agents-md': 'Grok 4.5 + AGENTS.md',
  'grok-4.6': 'Grok 4.6',
  'grok-4.6--agents-md': 'Grok 4.6 + AGENTS.md',
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

  // Canonical eval set: what's in evals/ right now. Every experiment is
  // scored over exactly this set so success rates are comparable.
  const canonicalEvals = (await readdir(join(process.cwd(), 'evals')))
    .filter((d) => !d.startsWith('.'))
    .sort();

  // The runner's staleness verdict. Only evals an experiment has NEVER run
  // (new — e.g. added or renamed upstream) export as notAvailable. Evals
  // whose content changed keep their last measured result until the model
  // is rerun — the board shows the previous measurement, not a hole.
  const missingByExperiment = new Map<string, Set<string>>();
  const statusRaw = execSync('npx agent-eval status --json', {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const status = JSON.parse(statusRaw) as {
    work: Array<{ experiment: string; new: string[]; changed: string[] }>;
  };
  for (const w of status.work) {
    missingByExperiment.set(w.experiment, new Set(w.new));
  }

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

          const costUsd = await meanEvalCostUsd(join(runDir, evalDir), experiment);

          agentResults.push({
            evalPath: evalDir,
            ...(costUsd !== undefined ? { costUsd } : {}),
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

    // Normalize to the canonical eval set: results for evals that no longer
    // exist are dropped; evals the experiment never ran become explicit
    // notAvailable entries that count against the success rate. Evals whose
    // content changed since the cached result keep that last measurement
    // until the model is rerun.
    const byEval = new Map(agentResults.map((r) => [r.evalPath, r]));
    const missing = missingByExperiment.get(experiment);
    let notAvailableCount = 0;
    const normalized: AgentResult[] = canonicalEvals.map((evalName) => {
      const found = byEval.get(evalName);
      if (found && !missing?.has(evalName)) return found;
      notAvailableCount++;
      return {
        evalPath: evalName,
        notAvailable: true,
        result: {
          success: false,
          duration: 0,
          evalPath: evalName,
          timestamp: parseTimestamp(latestTimestamp),
        },
      };
    });
    if (notAvailableCount > 0) {
      console.warn(
        `${experiment}: ${notAvailableCount}/${canonicalEvals.length} eval(s) not available (never run) — counted as not passed`
      );
    }

    const modelName = MODEL_NAMES[experiment] || experiment;
    const agentHarness = await getAgentHarness(experiment);

    exportedData.metadata.experiments.push({
      name: experiment,
      timestamp: parseTimestamp(latestTimestamp),
      modelName,
      agentHarness,
      // Variants inherit the base experiment's tier so the docsImpact merge
      // below never pairs experiments across tiers.
      tier: TIER_1.has(AGENTS_MD_PAIRS[experiment] ?? experiment) ? 1 : 2,
    });

    exportedData.results[experiment] = normalized;
  }

  // Merge --agents-md variants into base experiments (AGENTS_MD_PAIRS is
  // defined at module scope so per-eval cost pricing resolves the same base).
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

    // Find evals that flipped fail→pass and pass→fail. An eval that is
    // notAvailable on either side is not a flip — there is nothing to compare.
    const unavailable = new Set(
      [...baseResults, ...variantResults]
        .filter((r) => r.notAvailable)
        .map((r) => r.evalPath),
    );
    const baseFailSet = new Set(
      baseResults.filter((r) => !r.result.success).map((r) => r.evalPath),
    );
    const basePassSet = new Set(
      baseResults.filter((r) => r.result.success).map((r) => r.evalPath),
    );
    const newlyPassed = variantResults
      .filter(
        (r) =>
          r.result.success &&
          baseFailSet.has(r.evalPath) &&
          !unavailable.has(r.evalPath),
      )
      .map((r) => r.evalPath);
    const newlyFailed = variantResults
      .filter(
        (r) =>
          !r.result.success &&
          basePassSet.has(r.evalPath) &&
          !unavailable.has(r.evalPath),
      )
      .map((r) => r.evalPath);

    // Attach docsImpact to the base experiment
    baseExp.docsImpact = {
      baseSuccessRate: Math.round(baseSuccessRate),
      docsSuccessRate: Math.round(docsSuccessRate),
      delta: Math.round(docsSuccessRate - baseSuccessRate),
      newlyPassed,
      newlyFailed,
    };

    // Average duration across base + variant runs (seconds), excluding
    // notAvailable placeholders (their duration is 0).
    const allDurationsMs = [...baseResults, ...variantResults]
      .filter((r) => !r.notAvailable)
      .map((r) => r.result.duration);
    baseExp.avgDuration =
      allDurationsMs.reduce((a, b) => a + b, 0) / allDurationsMs.length / 1000;

    // Average list cost per eval across base + variant, over cells that have a
    // cost (a timed-out eval has none and is simply left out). null when the
    // model has no price at all → N/A on the board.
    baseExp.avgCostUsd = MODEL_PRICING[baseName]
      ? avgCost([...baseResults, ...variantResults])
      : null;

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

  // Fill avgDuration / avgCostUsd for experiments that didn't go through the
  // merge (standalone, no --agents-md pair).
  for (const exp of exportedData.metadata.experiments) {
    const results = exportedData.results[exp.name];
    if (!results || results.length === 0) continue;
    if (exp.avgDuration === undefined) {
      const durations = results
        .filter((r) => !r.notAvailable)
        .map((r) => r.result.duration);
      if (durations.length > 0) {
        exp.avgDuration =
          durations.reduce((a, b) => a + b, 0) / durations.length / 1000;
      }
    }
    if (exp.avgCostUsd === undefined) {
      exp.avgCostUsd = MODEL_PRICING[exp.name] ? avgCost(results) : null;
    }
  }

  // Count stats
  let totalSuccess = 0;
  let totalResults = 0;
  let totalNotAvailable = 0;
  for (const results of Object.values(exportedData.results)) {
    for (const r of results) {
      totalResults++;
      if (r.result.success) totalSuccess++;
      if (r.notAvailable) totalNotAvailable++;
    }
  }

  const outputPath = join(process.cwd(), 'agent-results.json');
  await writeFile(outputPath, JSON.stringify(exportedData, null, 2));

  console.log('\n' + '-'.repeat(60));
  console.log(`Exported to: ${outputPath}`);
  console.log(
    `Total: ${totalResults} | Pass: ${totalSuccess} | Fail: ${totalResults - totalSuccess - totalNotAvailable} | N/A: ${totalNotAvailable}`
  );
  console.log('-'.repeat(60));
}

main().catch(console.error);
