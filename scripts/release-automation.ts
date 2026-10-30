import {
  appendFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import { TIER_ONE_RELEASE_MATRIX } from '../lib/tier-one.js';

export interface ReleaseTarget {
  kind: 'release' | 'backport' | 'canary';
  version: string;
  ref: string;
  sha: string;
  sourceRunUrl: string;
  evaluatedAt: string;
}

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-canary\.\d+)?$/;
const shaPattern = /^[0-9a-f]{40}$/i;

export function validateReleaseTarget(input: ReleaseTarget): ReleaseTarget {
  const target = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as unknown as ReleaseTarget;

  if (!['release', 'backport', 'canary'].includes(target.kind)) {
    throw new Error('releaseKind must be release, backport, or canary');
  }
  if (!exactVersionPattern.test(target.version)) {
    throw new Error(
      `nextVersion must be an exact stable or canary version; received ${JSON.stringify(target.version)}`,
    );
  }
  const isCanaryVersion = target.version.includes('-canary.');
  if ((target.kind === 'canary') !== isCanaryVersion) {
    throw new Error(
      'releaseKind must be canary exactly when nextVersion is a canary version',
    );
  }
  if (target.ref !== `v${target.version}`) {
    throw new Error(
      `nextRef must be v${target.version}; received ${JSON.stringify(target.ref)}`,
    );
  }
  if (!shaPattern.test(target.sha)) {
    throw new Error('nextSha must be a full 40-character commit SHA');
  }
  if (!Number.isFinite(Date.parse(target.evaluatedAt))) {
    throw new Error('evaluatedAt must be an ISO timestamp');
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(target.sourceRunUrl);
  } catch {
    throw new Error('sourceRunUrl must be a GitHub Actions run URL');
  }
  if (
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.hostname !== 'github.com' ||
    !/^\/vercel\/next\.js\/actions\/runs\/\d+(?:\/.*)?$/.test(
      sourceUrl.pathname,
    )
  ) {
    throw new Error(
      'sourceRunUrl must point to a vercel/next.js GitHub Actions run',
    );
  }

  return target;
}

export function parseResultTimestamp(value: string): number {
  const normalized = value.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(\.\d+Z)$/,
    '$1T$2:$3:$4$5',
  );
  return Date.parse(normalized);
}

interface Summary {
  totalRuns: number;
  passedRuns: number;
  valid?: boolean;
}

interface RunResult {
  status?: string;
  error?: string;
}

const evaluatorStartupFailurePatterns = [
  /Startup Error/i,
  /failed to load config from .*vitest/i,
  /Cannot find (?:package|module) ['"]vitest\/config/i,
  /Cannot resolve (?:package|module) ['"]vitest\/config/i,
];

export function findInvalidRunReason(options: {
  result: RunResult;
  hasTranscript: boolean;
  evalOutput?: string;
}): string | undefined {
  if (!options.hasTranscript) return 'has no agent transcript';
  if (options.evalOutput === undefined) return 'has no evaluator output';
  if (/agent runner exited with code 143/i.test(options.result.error ?? '')) {
    return 'contains an agent runner exit 143';
  }
  if (
    evaluatorStartupFailurePatterns.some((pattern) =>
      pattern.test(options.evalOutput!),
    )
  ) {
    return 'contains an evaluator startup failure';
  }
  return undefined;
}

export interface ReleaseNotification {
  schemaVersion: 5;
  target: ReleaseTarget;
  workflowUrl: string;
  measurementUrl: string;
  metric: 'pass@1';
  validation: {
    complete: true;
    infrastructureFailuresExcluded: true;
    modelFailureConfirmationAttempts: 2;
  };
  report: ReleaseReport;
}

export function buildReleaseNotification(options: {
  target: ReleaseTarget;
  workflowUrl: string;
  measurementUrl: string;
  report: ReleaseReport;
}): ReleaseNotification {
  if (
    !/^https:\/\/github\.com\/vercel\/next-evals-oss\/actions\/runs\/\d+$/.test(
      options.workflowUrl,
    )
  ) {
    throw new Error(
      'workflowUrl must point to a vercel/next-evals-oss Actions run',
    );
  }
  if (
    !/^https:\/\/github\.com\/vercel\/next-evals-oss\/pull\/\d+$/.test(
      options.measurementUrl,
    )
  ) {
    throw new Error(
      'measurementUrl must point to a vercel/next-evals-oss pull request',
    );
  }
  return {
    schemaVersion: 5,
    target: options.target,
    workflowUrl: options.workflowUrl,
    measurementUrl: options.measurementUrl,
    metric: 'pass@1',
    validation: {
      complete: true,
      infrastructureFailuresExcluded: true,
      modelFailureConfirmationAttempts: 2,
    },
    report: options.report,
  };
}

interface ExportedResult {
  evalPath: string;
  notAvailable?: boolean;
  result: { success: boolean };
}

interface ExportedExperiment {
  name: string;
  modelName: string;
  agentHarness: string;
  docsImpact?: {
    newlyPassed: string[];
    newlyFailed: string[];
  };
}

interface ExportedReleaseData {
  metadata: {
    measurement?: {
      metric: string;
      scoredAttempts: number;
      infrastructureFailuresExcluded: boolean;
    };
    experiments: ExportedExperiment[];
  };
  results: Record<string, ExportedResult[]>;
}

interface ReleaseDiagnosticsData {
  metric: string;
  confirmationAttemptsPerFailure: number;
  experiments: Array<{
    experiment: string;
    tasks: Array<{
      evalName: string;
      scoredFailureReason: string;
      confirmations: Array<{
        outcome: 'passed' | 'failed' | 'unavailable';
        infrastructureRetries: number;
      }>;
    }>;
  }>;
}

export interface ReleaseScore {
  passed: number;
  total: number;
  percentage: number | null;
}

export interface ReleaseReport {
  scores: {
    withoutAgentsMd: ReleaseScore;
    withAgentsMd: ReleaseScore;
  };
  tasks: Array<{
    name: string;
    withoutAgentsMd: ReleaseScore;
    withAgentsMd: ReleaseScore;
  }>;
  experiments: Array<{
    name: string;
    model: string;
    agentHarness: string;
    withoutAgentsMd: ReleaseScore;
    withAgentsMd: ReleaseScore;
  }>;
  failures: Array<{
    experiment: string;
    model: string;
    evalName: string;
    agentsMd: boolean;
    reproducible: boolean;
    confirmationPasses: number;
    confirmationFailures: number;
    confirmationUnavailable: number;
    infrastructureRetries: number;
    scoredFailureReason: string;
  }>;
  comparison: {
    available: false;
    note: string;
  };
}

function score(values: boolean[]): ReleaseScore {
  const passed = values.filter(Boolean).length;
  return {
    passed,
    total: values.length,
    percentage:
      values.length === 0
        ? null
        : Math.round((passed / values.length) * 1000) / 10,
  };
}

function baseSuccess(
  experiment: ExportedExperiment,
  result: ExportedResult,
): boolean {
  if (experiment.docsImpact?.newlyPassed.includes(result.evalPath))
    return false;
  if (experiment.docsImpact?.newlyFailed.includes(result.evalPath)) return true;
  return result.result.success;
}

export function buildReleaseReport(
  data: ExportedReleaseData,
  diagnostics: ReleaseDiagnosticsData,
): ReleaseReport {
  if (
    data.metadata.measurement?.metric !== 'pass@1' ||
    data.metadata.measurement.scoredAttempts !== 1 ||
    data.metadata.measurement.infrastructureFailuresExcluded !== true
  ) {
    throw new Error(
      'Release report requires validated pass@1 measurement data',
    );
  }
  if (
    diagnostics.metric !== 'pass@1' ||
    diagnostics.confirmationAttemptsPerFailure !== 2
  ) {
    throw new Error('Release report requires two pass@1 confirmation attempts');
  }

  const metadata = new Map(
    data.metadata.experiments.map((experiment) => [
      experiment.name,
      experiment,
    ]),
  );
  const allWithout: boolean[] = [];
  const allWith: boolean[] = [];
  const taskScores = new Map<
    string,
    { withoutAgentsMd: boolean[]; withAgentsMd: boolean[] }
  >();
  const experiments = data.metadata.experiments
    .map((experiment) => {
      const cells = (data.results[experiment.name] ?? []).filter(
        (result) => !result.notAvailable,
      );
      const without = cells.map((result) => baseSuccess(experiment, result));
      const withAgents = cells.map((result) => result.result.success);
      cells.forEach((result, index) => {
        const task = taskScores.get(result.evalPath) ?? {
          withoutAgentsMd: [],
          withAgentsMd: [],
        };
        task.withoutAgentsMd.push(without[index]);
        task.withAgentsMd.push(withAgents[index]);
        taskScores.set(result.evalPath, task);
      });
      allWithout.push(...without);
      allWith.push(...withAgents);
      return {
        name: experiment.name,
        model: experiment.modelName,
        agentHarness: experiment.agentHarness,
        withoutAgentsMd: score(without),
        withAgentsMd: score(withAgents),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const failures = diagnostics.experiments
    .flatMap((experiment) => {
      const agentsMd = experiment.experiment.endsWith('--agents-md');
      const baseExperiment = experiment.experiment.replace(/--agents-md$/, '');
      const model = metadata.get(baseExperiment)?.modelName ?? baseExperiment;
      return experiment.tasks.map((task) => {
        const confirmationPasses = task.confirmations.filter(
          (attempt) => attempt.outcome === 'passed',
        ).length;
        const confirmationFailures = task.confirmations.filter(
          (attempt) => attempt.outcome === 'failed',
        ).length;
        const confirmationUnavailable = task.confirmations.filter(
          (attempt) => attempt.outcome === 'unavailable',
        ).length;
        return {
          experiment: baseExperiment,
          model,
          evalName: task.evalName,
          agentsMd,
          reproducible:
            task.confirmations.length ===
              diagnostics.confirmationAttemptsPerFailure &&
            confirmationFailures ===
              diagnostics.confirmationAttemptsPerFailure &&
            confirmationUnavailable === 0,
          confirmationPasses,
          confirmationFailures,
          confirmationUnavailable,
          infrastructureRetries: task.confirmations.reduce(
            (total, attempt) => total + attempt.infrastructureRetries,
            0,
          ),
          scoredFailureReason: task.scoredFailureReason,
        };
      });
    })
    .sort(
      (a, b) =>
        a.evalName.localeCompare(b.evalName) ||
        a.experiment.localeCompare(b.experiment) ||
        Number(a.agentsMd) - Number(b.agentsMd),
    );

  const tasks = [...taskScores]
    .map(([name, values]) => ({
      name,
      withoutAgentsMd: score(values.withoutAgentsMd),
      withAgentsMd: score(values.withAgentsMd),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    scores: {
      withoutAgentsMd: score(allWithout),
      withAgentsMd: score(allWith),
    },
    tasks,
    experiments,
    failures,
    comparison: {
      available: false,
      note: 'No comparable previous pass@1 measurement is included, so release-to-release regressions cannot be determined from this report. The published pass@4 board is not a comparable baseline.',
    },
  };
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

export async function validateReleaseResults(options: {
  root: string;
  startedAt: string;
  experiments?: readonly string[];
}): Promise<void> {
  const startTime = Date.parse(options.startedAt);
  if (!Number.isFinite(startTime))
    throw new Error('startedAt must be an ISO timestamp');

  const experiments = options.experiments ?? TIER_ONE_RELEASE_MATRIX;
  const evalNames = (
    await readdir(join(options.root, 'evals'), { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  if (evalNames.length === 0)
    throw new Error('The canonical eval suite is empty');

  const problems: string[] = [];
  for (const experiment of experiments) {
    const experimentDir = join(options.root, 'results', experiment);
    const timestampEntries = await readdir(experimentDir, {
      withFileTypes: true,
    }).catch(() => []);
    const currentRuns = timestampEntries
      .filter(
        (entry) =>
          entry.isDirectory() && parseResultTimestamp(entry.name) >= startTime,
      )
      .sort(
        (a, b) => parseResultTimestamp(b.name) - parseResultTimestamp(a.name),
      );

    if (currentRuns.length === 0) {
      problems.push(`${experiment}: found no result batch from this workflow`);
      continue;
    }

    for (const evalName of evalNames) {
      let evalDir: string | undefined;
      for (const batch of currentRuns) {
        const candidate = join(experimentDir, batch.name, evalName);
        if (await exists(join(candidate, 'summary.json'))) {
          evalDir = candidate;
          break;
        }
      }
      if (!evalDir) {
        problems.push(
          `${experiment}/${evalName}: no result remained after infrastructure retries`,
        );
        continue;
      }

      let summary: Summary;
      try {
        summary = JSON.parse(
          await readFile(join(evalDir, 'summary.json'), 'utf8'),
        ) as Summary;
      } catch {
        problems.push(
          `${experiment}/${evalName}: missing or invalid summary.json`,
        );
        continue;
      }

      if (summary.valid === false) {
        problems.push(`${experiment}/${evalName}: summary is marked invalid`);
      }
      if (
        !Number.isInteger(summary.totalRuns) ||
        summary.totalRuns !== 1 ||
        !Number.isInteger(summary.passedRuns) ||
        summary.passedRuns < 0 ||
        summary.passedRuns > summary.totalRuns
      ) {
        problems.push(
          `${experiment}/${evalName}: impossible run counts in summary.json`,
        );
        continue;
      }

      const runEntries = (await readdir(evalDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && /^run-\d+$/.test(entry.name))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
      if (runEntries.length !== summary.totalRuns) {
        problems.push(
          `${experiment}/${evalName}: summary reports ${summary.totalRuns} run(s), found ${runEntries.length}`,
        );
      }

      for (const runEntry of runEntries) {
        const runDir = join(evalDir, runEntry.name);
        let result: RunResult;
        try {
          result = JSON.parse(
            await readFile(join(runDir, 'result.json'), 'utf8'),
          ) as RunResult;
        } catch {
          problems.push(
            `${experiment}/${evalName}/${runEntry.name}: missing or invalid result.json`,
          );
          continue;
        }

        const transcript =
          (await exists(join(runDir, 'transcript-raw.jsonl'))) ||
          (await exists(join(runDir, 'transcript.json')));
        const evalOutput = await readFile(
          join(runDir, 'outputs', 'eval.txt'),
          'utf8',
        ).catch(() => undefined);
        const invalidReason = findInvalidRunReason({
          result,
          hasTranscript: transcript,
          evalOutput,
        });
        if (invalidReason) {
          problems.push(
            `${experiment}/${evalName}/${runEntry.name}: ${invalidReason}`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Release results are not reportable:\n- ${problems.join('\n- ')}`,
    );
  }
}

async function writeOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  await appendFile(outputPath, `${name}=${value}\n`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function releaseWorkspace(): string {
  return resolve(requiredEnv('RELEASE_EVAL_WORKSPACE'));
}

export async function prepareReleaseWorkspace(options: {
  root: string;
  workspace: string;
  evals: string;
}): Promise<void> {
  const root = resolve(options.root);
  const workspace = resolve(options.workspace);
  const relativePath = relative(root, workspace);
  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  ) {
    throw new Error('Release eval workspace must be outside the repository');
  }

  await rm(workspace, { recursive: true, force: true });
  await mkdir(workspace, { recursive: true });
  await Promise.all(
    ['experiments', 'lib'].map((directory) =>
      cp(join(root, directory), join(workspace, directory), {
        recursive: true,
      }),
    ),
  );
  await cp(resolve(options.evals), join(workspace, 'evals'), {
    recursive: true,
  });
  await mkdir(join(workspace, 'results'));
  await symlink(
    join(root, 'node_modules'),
    join(workspace, 'node_modules'),
    'dir',
  );
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'prepare-workspace') {
    const workspace = releaseWorkspace();
    await prepareReleaseWorkspace({
      root: process.cwd(),
      workspace,
      evals: process.env.RELEASE_EVAL_SUITE_PATH ?? 'evals',
    });
    console.log(`Prepared isolated release workspace at ${workspace}.`);
    return;
  }

  if (command === 'prepare') {
    const evaluatedAt = new Date().toISOString();
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt,
    });
    const suiteRef = (await readFile('eval-suite-ref.txt', 'utf8')).trim();
    if (!shaPattern.test(suiteRef))
      throw new Error('eval-suite-ref.txt must contain a full commit SHA');

    await writeOutput('next-version', target.version);
    await writeOutput('release-kind', target.kind);
    await writeOutput('next-ref', target.ref);
    await writeOutput('next-sha', target.sha);
    await writeOutput('source-run-url', target.sourceRunUrl);
    await writeOutput('evaluated-at', target.evaluatedAt);
    await writeOutput('suite-ref', suiteRef);
    await writeOutput(
      'matrix',
      JSON.stringify({ experiment: TIER_ONE_RELEASE_MATRIX }),
    );
    return;
  }

  if (command === 'validate-results') {
    const experiment = process.env.EXPERIMENT;
    await validateReleaseResults({
      root: releaseWorkspace(),
      startedAt: process.env.EVALUATED_AT ?? '',
      experiments: experiment ? [experiment] : undefined,
    });
    console.log(
      `Validated ${experiment ? 1 : TIER_ONE_RELEASE_MATRIX.length} complete experiment run(s).`,
    );
    return;
  }

  if (command === 'write-target') {
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt: process.env.EVALUATED_AT ?? '',
    });
    await writeFile(
      join(releaseWorkspace(), 'evaluation-target.json'),
      `${JSON.stringify(target, null, 2)}\n`,
    );
    return;
  }

  if (command === 'agent-notification') {
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt: process.env.EVALUATED_AT ?? '',
    });
    const data = JSON.parse(
      await readFile(requiredEnv('RELEASE_MEASUREMENT_PATH'), 'utf8'),
    ) as ExportedReleaseData;
    const diagnostics = JSON.parse(
      await readFile(requiredEnv('RELEASE_DIAGNOSTICS_PATH'), 'utf8'),
    ) as ReleaseDiagnosticsData;
    const notification = buildReleaseNotification({
      target,
      workflowUrl: process.env.WORKFLOW_URL ?? '',
      measurementUrl: process.env.MEASUREMENT_URL ?? '',
      report: buildReleaseReport(data, diagnostics),
    });
    await writeFile(
      process.env.AGENT_PAYLOAD_PATH ?? 'release-notification.json',
      `${JSON.stringify(notification, null, 2)}\n`,
    );
    console.log('Prepared the validated release-evals event for the agent.');
    return;
  }

  throw new Error(
    'Usage: release-automation.ts <prepare|prepare-workspace|validate-results|write-target|agent-notification>',
  );
}

if (process.argv[1]?.endsWith('release-automation.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
