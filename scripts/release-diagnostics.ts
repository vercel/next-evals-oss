import {
  classifyFailure,
  getAgent,
  loadAllFixtures,
  loadConfig,
  runExperiment,
  type Classification,
  type EvalFixture,
  type ResolvedExperimentConfig,
} from '@vercel/agent-eval';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { TIER_ONE_RELEASE_MATRIX } from '../lib/tier-one.js';
import { parseResultTimestamp } from './release-automation.js';

const confirmationAttempts = 2;
const maxInfrastructureRetries = 3;
const diagnosticConcurrency = 4;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

interface Summary {
  passedRuns: number;
  totalRuns: number;
}

export interface ConfirmationAttempt {
  attempt: number;
  outcome: 'passed' | 'failed' | 'unavailable';
  infrastructureRetries: number;
  failureReason?: string;
}

export interface FailureDiagnostic {
  evalName: string;
  scoredFailureReason: string;
  confirmations: ConfirmationAttempt[];
}

export interface ExperimentDiagnostics {
  schemaVersion: 1;
  experiment: string;
  metric: 'pass@1';
  confirmationAttempts: 2;
  tasks: FailureDiagnostic[];
}

export interface ReleaseDiagnostics {
  schemaVersion: 1;
  metric: 'pass@1';
  confirmationAttemptsPerFailure: 2;
  experiments: ExperimentDiagnostics[];
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function currentEvalDirectories(options: {
  root: string;
  experiment: string;
  startedAt: string;
}): Promise<Map<string, string>> {
  const startTime = Date.parse(options.startedAt);
  if (!Number.isFinite(startTime)) {
    throw new Error('startedAt must be an ISO timestamp');
  }

  const experimentDir = join(options.root, 'results', options.experiment);
  const batches = (await readdir(experimentDir, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isDirectory() && parseResultTimestamp(entry.name) >= startTime,
    )
    .sort(
      (a, b) => parseResultTimestamp(b.name) - parseResultTimestamp(a.name),
    );
  const evalDirs = new Map<string, string>();
  for (const batch of batches) {
    const batchDir = join(experimentDir, batch.name);
    for (const entry of await readdir(batchDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || evalDirs.has(entry.name)) continue;
      const evalDir = join(batchDir, entry.name);
      if (await exists(join(evalDir, 'summary.json'))) {
        evalDirs.set(entry.name, evalDir);
      }
    }
  }
  return evalDirs;
}

export async function findScoredModelFailures(options: {
  root: string;
  experiment: string;
  startedAt: string;
}): Promise<Array<{ evalName: string; reason: string }>> {
  const evalDirs = await currentEvalDirectories(options);
  const failures: Array<{ evalName: string; reason: string }> = [];

  for (const [evalName, evalDir] of evalDirs) {
    const summary = JSON.parse(
      await readFile(join(evalDir, 'summary.json'), 'utf8'),
    ) as Summary;
    if (summary.totalRuns !== 1 || summary.passedRuns !== 0) continue;

    const classification = JSON.parse(
      await readFile(join(evalDir, 'classification.json'), 'utf8'),
    ) as Classification;
    if (classification.failureType !== 'model') {
      throw new Error(
        `${options.experiment}/${evalName}: a non-model failure remained in the scored results`,
      );
    }
    failures.push({ evalName, reason: classification.failureReason });
  }

  return failures.sort((a, b) => a.evalName.localeCompare(b.evalName));
}

function resolveApiKey(config: ResolvedExperimentConfig): string {
  const agent = getAgent(config.agent);
  const envName = agent.getApiKeyEnvVar();
  const direct = process.env[envName];
  const gateway = config.agent.startsWith('vercel-ai-gateway/')
    ? process.env.VERCEL_OIDC_TOKEN
    : undefined;
  const apiKey = direct ?? gateway;
  if (!apiKey) {
    throw new Error(`${envName} is required for ${config.agent}`);
  }
  return apiKey;
}

async function classifyWithRetry(
  evalDir: string,
  evalName: string,
  experiment: string,
): Promise<Classification> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise((resolveDelay) =>
        setTimeout(resolveDelay, Math.min(1_000 * 2 ** (attempt - 1), 8_000)),
      );
    }
    try {
      const classification = await classifyFailure(
        evalDir,
        evalName,
        experiment,
      );
      if (classification) return classification;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `${experiment}/${evalName}: could not classify confirmation failure: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function runValidConfirmation(options: {
  config: ResolvedExperimentConfig & { model: string };
  fixture: EvalFixture;
  apiKey: string;
  experiment: string;
  attempt: number;
  resultsRoot: string;
}): Promise<ConfirmationAttempt> {
  let infrastructureRetries = 0;
  for (let tryNumber = 0; tryNumber <= maxInfrastructureRetries; tryNumber++) {
    const resultsDir = join(
      options.resultsRoot,
      options.experiment,
      options.fixture.name,
      `confirmation-${options.attempt}`,
      `try-${tryNumber + 1}`,
    );
    let results;
    try {
      results = await runExperiment({
        config: {
          ...options.config,
          evals: [options.fixture.name],
          runs: 1,
          earlyExit: true,
        },
        fixtures: [options.fixture],
        apiKey: options.apiKey,
        resultsDir,
        experimentName: 'diagnostic',
      });
    } catch {
      infrastructureRetries++;
      continue;
    }
    const summary = results.evals[0];
    if (summary.passedRuns === 1) {
      return {
        attempt: options.attempt,
        outcome: 'passed',
        infrastructureRetries,
      };
    }

    const timestamp = results.startedAt.replace(/:/g, '-');
    const evalDir = join(
      resultsDir,
      'diagnostic',
      timestamp,
      options.fixture.name,
    );
    let classification: Classification;
    try {
      classification = await classifyWithRetry(
        evalDir,
        options.fixture.name,
        options.experiment,
      );
    } catch {
      infrastructureRetries++;
      continue;
    }
    if (classification.failureType === 'model') {
      return {
        attempt: options.attempt,
        outcome: 'failed',
        infrastructureRetries,
        failureReason: classification.failureReason,
      };
    }
    infrastructureRetries++;
  }

  return {
    attempt: options.attempt,
    outcome: 'unavailable',
    infrastructureRetries,
    failureReason: 'No valid confirmation remained after infrastructure retries',
  };
}

async function mapWithConcurrency<T, U>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let cursor = 0;
  async function runWorker() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, runWorker),
  );
  return results;
}

export async function diagnoseExperiment(options: {
  root: string;
  experiment: string;
  startedAt: string;
  outputPath: string;
  resultsRoot: string;
}): Promise<ExperimentDiagnostics> {
  const failures = await findScoredModelFailures(options);
  const diagnostics: ExperimentDiagnostics = {
    schemaVersion: 1,
    experiment: options.experiment,
    metric: 'pass@1',
    confirmationAttempts,
    tasks: [],
  };

  if (failures.length > 0) {
    const config = await loadConfig(
      resolve(options.root, 'experiments', `${options.experiment}.ts`),
    );
    if (Array.isArray(config.model)) {
      throw new Error('Release diagnostics require one model per experiment');
    }
    const singleModelConfig = config as ResolvedExperimentConfig & {
      model: string;
    };
    const apiKey = resolveApiKey(config);
    const loaded = loadAllFixtures(resolve(options.root, 'evals'));
    const fixtures = new Map(
      loaded.fixtures.map((fixture) => [fixture.name, fixture]),
    );

    diagnostics.tasks = await mapWithConcurrency(
      failures,
      diagnosticConcurrency,
      async (failure) => {
        const fixture = fixtures.get(failure.evalName);
        if (!fixture) {
          throw new Error(`Missing eval fixture: ${failure.evalName}`);
        }
        const confirmations: ConfirmationAttempt[] = [];
        for (let attempt = 1; attempt <= confirmationAttempts; attempt++) {
          const confirmation = await runValidConfirmation({
            config: singleModelConfig,
            fixture,
            apiKey,
            experiment: options.experiment,
            attempt,
            resultsRoot: options.resultsRoot,
          });
          confirmations.push(confirmation);
          if (confirmation.outcome === 'unavailable') {
            for (
              let skipped = attempt + 1;
              skipped <= confirmationAttempts;
              skipped++
            ) {
              confirmations.push({
                attempt: skipped,
                outcome: 'unavailable',
                infrastructureRetries: 0,
                failureReason:
                  'Skipped after a previous confirmation exhausted infrastructure retries',
              });
            }
            break;
          }
        }
        return {
          evalName: failure.evalName,
          scoredFailureReason: failure.reason,
          confirmations,
        };
      },
    );
  }

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(
    options.outputPath,
    `${JSON.stringify(diagnostics, null, 2)}\n`,
  );
  return diagnostics;
}

export async function mergeDiagnostics(options: {
  partsDir: string;
  outputPath: string;
  expectedExperiments?: readonly string[];
}): Promise<ReleaseDiagnostics> {
  const files = (await readdir(options.partsDir))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const experiments = await Promise.all(
    files.map(
      async (name) =>
        JSON.parse(
          await readFile(join(options.partsDir, name), 'utf8'),
        ) as ExperimentDiagnostics,
    ),
  );
  const expected = new Set(
    options.expectedExperiments ?? TIER_ONE_RELEASE_MATRIX,
  );
  const actual = new Set(experiments.map((part) => part.experiment));
  const missing = [...expected].filter((experiment) => !actual.has(experiment));
  const unexpected = [...actual].filter(
    (experiment) => !expected.has(experiment),
  );
  if (
    experiments.length !== actual.size ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      `Incomplete diagnostic matrix: missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}]`,
    );
  }
  for (const part of experiments) {
    if (
      part.schemaVersion !== 1 ||
      part.metric !== 'pass@1' ||
      part.confirmationAttempts !== confirmationAttempts ||
      part.tasks.some(
        (task) => task.confirmations.length !== confirmationAttempts,
      )
    ) {
      throw new Error(`Invalid diagnostic part for ${part.experiment}`);
    }
  }
  const diagnostics: ReleaseDiagnostics = {
    schemaVersion: 1,
    metric: 'pass@1',
    confirmationAttemptsPerFailure: confirmationAttempts,
    experiments: experiments.sort((a, b) =>
      a.experiment.localeCompare(b.experiment),
    ),
  };
  await writeFile(
    options.outputPath,
    `${JSON.stringify(diagnostics, null, 2)}\n`,
  );
  return diagnostics;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'run') {
    const experiment = process.env.EXPERIMENT ?? '';
    if (!experiment) throw new Error('EXPERIMENT is required');
    const outputDir = process.env.DIAGNOSTIC_OUTPUT_DIR ?? '';
    const resultsRoot = process.env.DIAGNOSTIC_RESULTS_DIR ?? '';
    if (!outputDir || !resultsRoot) {
      throw new Error(
        'DIAGNOSTIC_OUTPUT_DIR and DIAGNOSTIC_RESULTS_DIR are required',
      );
    }
    const diagnostics = await diagnoseExperiment({
      root: resolve(requiredEnv('RELEASE_EVAL_WORKSPACE')),
      experiment,
      startedAt: process.env.EVALUATED_AT ?? '',
      outputPath: join(outputDir, `${experiment}.json`),
      resultsRoot,
    });
    console.log(
      `${experiment}: confirmed ${diagnostics.tasks.length} scored failure(s) with two diagnostic attempts each.`,
    );
    return;
  }

  if (command === 'merge') {
    const partsDir = process.env.DIAGNOSTIC_PARTS_DIR ?? '';
    if (!partsDir) throw new Error('DIAGNOSTIC_PARTS_DIR is required');
    const diagnostics = await mergeDiagnostics({
      partsDir,
      outputPath: resolve(requiredEnv('RELEASE_DIAGNOSTICS_PATH')),
    });
    console.log(
      `Merged diagnostics for ${diagnostics.experiments.length} experiments.`,
    );
    return;
  }

  throw new Error('Usage: release-diagnostics.ts <run|merge>');
}

if (process.argv[1]?.endsWith('release-diagnostics.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
