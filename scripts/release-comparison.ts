import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
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
    'scripts/sync-evals.ts',
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

function cells(data: ExportedReleaseData) {
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
    }
  >();
  let tasks: string | undefined;
  for (const experiment of data.metadata.experiments) {
    const results = data.results[experiment.name];
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
        });
      }
    }
  }
  if (!values.size) throw new Error('Empty measurement');
  return values;
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
): Promise<ReleaseComparison> {
  const unavailable = {
    available: false as const,
    note: 'No reviewed, compatible earlier measurement is merged. This run establishes a baseline once its measurement PR is reviewed and merged.',
  };
  const target = current.metadata.evaluationTarget;
  if (
    !target ||
    target.suite !== 'published' ||
    !/^[a-f0-9]{64}$/.test(target.comparisonKey ?? '')
  )
    return unavailable;
  const order = versionOrder(target.version);
  if (!order) throw new Error('Invalid current release version');
  const currentCells = cells(current);
  const versions = await readdir(root).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const candidates: Array<{
    data: ExportedReleaseData;
    path: string;
    order: number[];
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
          previous.comparisonKey !== target.comparisonKey ||
          !Number.isFinite(Date.parse(previous.evaluatedAt)) ||
          Date.parse(previous.evaluatedAt) >= Date.parse(target.evaluatedAt)
        )
          continue;
        const previousCells = cells(data);
        if (
          previousCells.size !== currentCells.size ||
          [...currentCells.keys()].some((key) => !previousCells.has(key))
        )
          continue;
        candidates.push({ data, path, order: prior });
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
  const previousCells = cells(baseline.data);
  for (const [key, value] of currentCells) {
    if (value.success === previousCells.get(key)!.success) continue;
    const { success, ...change } = value;
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
    note: 'Same release line, suite revision, declared model/harness, execution configuration, and pass@1 conditions. Pass→fail changes are regression candidates; confirmations are reported separately. Remote model or CLI updates can still affect results, so this comparison alone does not establish a framework cause.',
  };
}
