import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { MODEL_PRICING, priceUsage, type Pricing } from './cost.js';
import type { EffortMetrics } from './effort.js';
import type {
  ExportedReleaseData,
  ReleaseReport,
} from './release-automation.js';

interface Change {
  experiment: string;
  model: string;
  evalName: string;
  agentsMd: boolean;
  reproducible: boolean;
}

export interface ComparisonInputs {
  executionKey: string;
  graders: Record<string, string>;
}

export async function comparisonInputs(
  root: string,
  experiments: readonly string[],
): Promise<ComparisonInputs> {
  const hash = createHash('sha256').update('release-execution-v1');
  for (const path of [
    'pnpm-lock.yaml',
    'lib/setup.ts',
    'lib/release-runs.ts',
    ...[...experiments].sort().map((name) => `experiments/${name}.ts`),
  ]) {
    hash
      .update(path)
      .update('\0')
      .update(await readFile(join(root, path)))
      .update('\0');
  }
  const overrides = JSON.parse(
    await readFile(join(root, 'eval-grader-overrides.json'), 'utf8'),
  );
  return {
    executionKey: hash.digest('hex'),
    graders: Object.fromEntries(
      Object.entries(overrides.graders).map(([name, value]) => [
        name,
        JSON.stringify(value),
      ]),
    ),
  };
}

export type ReleaseComparison =
  | { available: false; note: string }
  | {
      available: true;
      baseline: {
        version: string;
        measurementUrl: string;
        evaluatedAt: string;
      };
      regressions: Change[];
      improvements: Change[];
      changedEvals?: string[];
      costs?: ReleaseCostComparison[];
      note: string;
    };

// Include the execution inputs, but not the target Next.js release or reporting code.
export async function comparisonKey(
  root: string,
  experiments: readonly string[],
): Promise<string> {
  const hash = createHash('sha256').update(
    'published-pass@1-base-and-agents-md-v1',
  );
  for (const path of [
    'eval-suite-ref.txt',
    'eval-grader-overrides.json',
    'eval-publication-overrides.json',
    'lib/published-evals.ts',
    'scripts/sync-evals.ts',
    'scripts/grader-overrides.ts',
    'pnpm-lock.yaml',
    'lib/setup.ts',
    'lib/release-runs.ts',
    ...[...experiments].sort().map((name) => `experiments/${name}.ts`),
  ]) {
    hash
      .update(path)
      .update('\0')
      .update(await readFile(join(root, path)))
      .update('\0');
  }
  return hash.digest('hex');
}

function cells(data: ExportedReleaseData, excluded: ReadonlySet<string>) {
  const measurement = data.metadata.measurement;
  if (
    measurement?.metric !== 'pass@1' ||
    measurement.scoredAttempts !== 1 ||
    measurement.infrastructureFailuresExcluded !== true
  )
    throw new Error('Not validated pass@1 data');
  const values = new Map<
    string,
    {
      success: boolean;
      experiment: string;
      model: string;
      evalName: string;
      agentsMd: boolean;
      effort?: EffortMetrics;
    }
  >();
  let tasks: string | undefined;
  for (const experiment of data.metadata.experiments) {
    const results = data.results[experiment.name]?.filter(
      (result) => !excluded.has(result.evalPath),
    );
    if (!results?.length) throw new Error('Missing results');
    if (
      !Array.isArray(experiment.docsImpact?.newlyPassed) ||
      !Array.isArray(experiment.docsImpact?.newlyFailed)
    )
      throw new Error('Missing docs condition');
    const names = results.map((result) => result.evalPath).sort();
    if (
      new Set(names).size !== names.length ||
      (tasks && tasks !== JSON.stringify(names))
    )
      throw new Error('Different task sets');
    tasks = JSON.stringify(names);
    for (const result of results) {
      if (result.notAvailable || typeof result.result.success !== 'boolean')
        throw new Error('Incomplete results');
      const base = experiment.docsImpact?.newlyPassed.includes(result.evalPath)
        ? false
        : experiment.docsImpact?.newlyFailed.includes(result.evalPath)
          ? true
          : result.result.success;
      for (const agentsMd of [false, true]) {
        const key = JSON.stringify([
          experiment.name,
          experiment.modelName,
          experiment.agentHarness,
          result.evalPath,
          agentsMd,
        ]);
        if (values.has(key)) throw new Error('Duplicate result');
        values.set(key, {
          success: agentsMd ? result.result.success : base,
          experiment: experiment.name,
          model: experiment.modelName,
          evalName: result.evalPath,
          agentsMd,
          effort: agentsMd ? result.effort?.agentsMd : result.effort?.base,
        });
      }
    }
  }
  if (!values.size) throw new Error('Empty measurement');
  return values;
}

function matchesComparisonKey(
  previous: NonNullable<ExportedReleaseData['metadata']['evaluationTarget']>,
  currentKey: string,
  excluded: ReadonlySet<string>,
): boolean {
  if (previous.comparisonKey === currentKey) return true;
  // Only a reviewed annotation merged with the baseline can bridge a
  // publication-only change. Preserve its original execution key and scores.
  const reviewed = previous.publicationComparison;
  return Boolean(
    reviewed &&
      /^[a-f0-9]{64}$/.test(previous.comparisonKey) &&
      reviewed.originalComparisonKey === previous.comparisonKey &&
      reviewed.comparisonKey === currentKey &&
      Array.isArray(reviewed.excludedEvals) &&
      reviewed.excludedEvals.length === excluded.size &&
      new Set(reviewed.excludedEvals).size === excluded.size &&
      reviewed.excludedEvals.every((name) => excluded.has(name)),
  );
}

function versionOrder(version: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-canary\.(\d+))?$/.exec(version);
  return match
    ? [
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        match[4] === undefined ? Infinity : Number(match[4]),
      ]
    : undefined;
}

// Read only the merged main checkout. Unreviewed, closed, and open PR branches
// are never fetched or used as a baseline.
export async function loadReleaseComparison(
  root: string,
  current: ExportedReleaseData,
  report: ReleaseReport,
  excludedEvals: readonly string[] = [],
): Promise<ReleaseComparison> {
  const excluded = new Set(excludedEvals);
  const target = current.metadata.evaluationTarget;
  const releaseLine = target?.version.match(/^(\d+\.\d+)\./)?.[1];
  const unavailable = {
    available: false as const,
    note: `No reviewed compatible earlier ${releaseLine ? `Next.js ${releaseLine}.x` : 'release-line'} pass@1 measurement is merged. Other release lines are not used as baselines. This run can establish this line's baseline after review and merge.`,
  };
  if (
    !target ||
    target.suite !== 'published' ||
    !/^[a-f0-9]{64}$/.test(target.comparisonKey ?? '')
  )
    return unavailable;
  const order = versionOrder(target.version);
  if (!order) throw new Error('Invalid current release version');
  const currentCells = cells(current, excluded);
  const versions = await readdir(root).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const candidates: Array<{
    data: ExportedReleaseData;
    path: string;
    order: number[];
    changedEvals: string[];
  }> = [];
  for (const version of versions) {
    const prior = versionOrder(version);
    if (
      !prior ||
      prior[0] !== order[0] ||
      prior[1] !== order[1] ||
      version.includes('-canary.') !== target.version.includes('-canary.') ||
      !(prior[2] < order[2] || (prior[2] === order[2] && prior[3] < order[3]))
    )
      continue;
    for (const run of await readdir(join(root, version))) {
      if (!/^\d+$/.test(run)) continue;
      const path = `${version}/${run}/measurement.json`;
      try {
        const data: ExportedReleaseData = JSON.parse(
          await readFile(join(root, path), 'utf8'),
        );
        const previous = data.metadata.evaluationTarget;
        if (
          !previous ||
          previous.version !== version ||
          previous.suite !== target.suite ||
          previous.suiteRef !== target.suiteRef ||
          !Number.isFinite(Date.parse(previous.evaluatedAt)) ||
          Date.parse(previous.evaluatedAt) >= Date.parse(target.evaluatedAt)
        )
          continue;
        const before = previous.comparisonInputs;
        const after = target.comparisonInputs;
        let changedEvals: string[] = [];
        if (before && after) {
          if (
            !/^[a-f0-9]{64}$/.test(before.executionKey) ||
            before.executionKey !== after.executionKey
          )
            continue;
          changedEvals = [
            ...new Set([
              ...Object.keys(before.graders),
              ...Object.keys(after.graders),
            ]),
          ]
            .filter((name) => before.graders[name] !== after.graders[name])
            .sort();
        } else if (
          !matchesComparisonKey(previous, target.comparisonKey, excluded)
        ) {
          continue;
        }
        const comparisonExcluded = new Set([...excluded, ...changedEvals]);
        const previousCells = cells(data, comparisonExcluded);
        const comparableCurrent = cells(current, comparisonExcluded);
        if (
          previousCells.size !== comparableCurrent.size ||
          [...comparableCurrent.keys()].some((key) => !previousCells.has(key))
        )
          continue;
        candidates.push({ data, path, order: prior, changedEvals });
      } catch (error) {
        // Older/partial measurements cannot become a baseline.
        if (
          (error as NodeJS.ErrnoException).code &&
          (error as NodeJS.ErrnoException).code !== 'ENOENT'
        )
          throw error;
      }
    }
  }
  candidates.sort(
    (a, b) =>
      b.order[2] - a.order[2] ||
      b.order[3] - a.order[3] ||
      Date.parse(b.data.metadata.evaluationTarget!.evaluatedAt) -
        Date.parse(a.data.metadata.evaluationTarget!.evaluatedAt),
  );
  const baseline = candidates[0];
  if (!baseline) return unavailable;
  const regressions: Change[] = [],
    improvements: Change[] = [];
  const comparisonExcluded = new Set([...excluded, ...baseline.changedEvals]);
  const previousCells = cells(baseline.data, comparisonExcluded);
  for (const [key, value] of currentCells) {
    if (comparisonExcluded.has(value.evalName)) continue;
    if (value.success === previousCells.get(key)!.success) continue;
    const { success, effort: _effort, ...change } = value;
    const reproducible = report.failures.some(
      (failure) =>
        failure.experiment === value.experiment &&
        failure.evalName === value.evalName &&
        failure.agentsMd === value.agentsMd &&
        failure.reproducible,
    );
    (success ? improvements : regressions).push({ ...change, reproducible });
  }
  const previous = baseline.data.metadata.evaluationTarget!;
  return {
    available: true,
    baseline: {
      version: previous.version,
      evaluatedAt: previous.evaluatedAt,
      measurementUrl: `https://github.com/vercel/next-evals-oss/blob/main/measurements/releases/${baseline.path}`,
    },
    regressions,
    improvements,
    changedEvals: baseline.changedEvals,
    costs: compareReleaseCosts(previousCells, cells(current, comparisonExcluded)),
    note: 'Same release line, suite revision, declared model/harness, execution configuration, and pass@1 conditions. Tasks with changed grader or companion-file pins are excluded and listed in changedEvals. Pass→fail changes are regression candidates; confirmations are reported separately. Remote model or CLI updates can still affect results, so this comparison alone does not establish a framework cause.',
  };
}

interface CostChange {
  beforeUsd: number;
  afterUsd: number;
  changePercent: number | null;
}

export interface ReleaseCostComparison
  extends Omit<CostChange, 'beforeUsd' | 'afterUsd'> {
  beforeUsd: number | null;
  afterUsd: number | null;
  experiment: string;
  model: string;
  agentsMd: boolean;
  totalTasks: number;
  matchedTasks: number;
  excludedFailedTasks: number;
  missingUsageTasks: number;
  pricing: Pricing | null;
  tasks: Array<CostChange & { evalName: string }>;
}

// Reprice both releases at one recorded rate table, so pricing updates cannot
// masquerade as a change in agent effort. Never use text-length cost estimates.
function measuredCost(
  effort: EffortMetrics | undefined,
  pricing: Pricing | null,
) {
  if (
    !effort ||
    !pricing ||
    effort.measuredRuns !== 1 ||
    effort.totalRuns !== 1
  )
    return null;
  const {
    avgInputTokens: input,
    avgOutputTokens: output,
    avgCacheReadTokens: cacheRead,
    avgCacheWriteTokens: cacheWrite,
  } = effort;
  if (
    [input, output, cacheRead, cacheWrite].some(
      (n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0,
    )
  )
    return null;
  if (input! < cacheRead! + cacheWrite!) return null;
  return priceUsage(
    {
      input: input! - cacheRead! - cacheWrite!,
      output: output!,
      cacheRead: cacheRead!,
      cacheWrite: cacheWrite!,
    },
    pricing,
  );
}

function costChange(beforeUsd: number, afterUsd: number): CostChange {
  return {
    beforeUsd,
    afterUsd,
    changePercent: beforeUsd > 0 ? (afterUsd / beforeUsd - 1) * 100 : null,
  };
}

function compareReleaseCosts(
  before: ReturnType<typeof cells>,
  after: ReturnType<typeof cells>,
) {
  const groups = new Map<string, ReleaseCostComparison>();
  for (const [key, current] of after) {
    const previous = before.get(key)!;
    const groupKey = JSON.stringify([current.experiment, current.agentsMd]);
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        experiment: current.experiment,
        model: current.model,
        agentsMd: current.agentsMd,
        totalTasks: 0,
        matchedTasks: 0,
        excludedFailedTasks: 0,
        missingUsageTasks: 0,
        pricing: MODEL_PRICING[current.experiment] ?? null,
        tasks: [],
        beforeUsd: null,
        afterUsd: null,
        changePercent: null,
      };
      groups.set(groupKey, group);
    }
    group.totalTasks++;
    // A cheaper failure is not an efficiency improvement. Compare the same
    // successful tasks on both sides, and expose how many tasks were excluded.
    if (!previous.success || !current.success) {
      group.excludedFailedTasks++;
      continue;
    }
    const oldCost = measuredCost(previous.effort, group.pricing);
    const newCost = measuredCost(current.effort, group.pricing);
    if (oldCost === null || newCost === null) {
      group.missingUsageTasks++;
      continue;
    }
    group.tasks.push({
      evalName: current.evalName,
      ...costChange(oldCost, newCost),
    });
  }
  for (const group of groups.values()) {
    group.matchedTasks = group.tasks.length;
    if (group.matchedTasks)
      Object.assign(
        group,
        costChange(
          group.tasks.reduce((sum, task) => sum + task.beforeUsd, 0) /
            group.matchedTasks,
          group.tasks.reduce((sum, task) => sum + task.afterUsd, 0) /
            group.matchedTasks,
        ),
      );
  }
  return [...groups.values()];
}
