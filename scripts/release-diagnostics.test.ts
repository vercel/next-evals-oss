import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  findScoredModelFailures,
  mergeDiagnostics,
  type ExperimentDiagnostics,
} from './release-diagnostics.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function makeEvalResult(options: {
  root: string;
  evalName: string;
  passed: boolean;
  failureType?: 'model' | 'infra' | 'timeout';
}) {
  const evalDir = join(
    options.root,
    'results',
    'model',
    '2026-10-13T12-30-00.000Z',
    options.evalName,
  );
  await mkdir(evalDir, { recursive: true });
  await writeFile(
    join(evalDir, 'summary.json'),
    JSON.stringify({ totalRuns: 1, passedRuns: options.passed ? 1 : 0 }),
  );
  if (options.failureType) {
    await writeFile(
      join(evalDir, 'classification.json'),
      JSON.stringify({
        failureType: options.failureType,
        failureReason: `${options.failureType} reason`,
      }),
    );
  }
}

test('only scored model failures receive confirmation attempts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-diagnostics-'));
  tempDirs.push(root);
  await makeEvalResult({
    root,
    evalName: 'failed',
    passed: false,
    failureType: 'model',
  });
  await makeEvalResult({ root, evalName: 'passed', passed: true });

  assert.deepEqual(
    await findScoredModelFailures({
      root,
      experiment: 'model',
      startedAt: '2026-10-13T12:00:00.000Z',
    }),
    [{ evalName: 'failed', reason: 'model reason' }],
  );
});

test('a remaining infrastructure failure cannot become a diagnostic model failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-diagnostics-'));
  tempDirs.push(root);
  await makeEvalResult({
    root,
    evalName: 'failed',
    passed: false,
    failureType: 'infra',
  });

  await assert.rejects(
    () =>
      findScoredModelFailures({
        root,
        experiment: 'model',
        startedAt: '2026-10-13T12:00:00.000Z',
      }),
    /non-model failure remained/,
  );
});

test('diagnostic parts merge into one auditable release file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-diagnostics-'));
  tempDirs.push(root);
  const partsDir = join(root, 'parts');
  const outputPath = join(root, 'release-diagnostics.json');
  await mkdir(partsDir);

  const part = (experiment: string): ExperimentDiagnostics => ({
    schemaVersion: 1,
    experiment,
    metric: 'pass@1',
    confirmationAttempts: 2,
    tasks: [],
  });
  await writeFile(join(partsDir, 'b.json'), JSON.stringify(part('b')));
  await writeFile(join(partsDir, 'a.json'), JSON.stringify(part('a')));

  const merged = await mergeDiagnostics({
    partsDir,
    outputPath,
    expectedExperiments: ['a', 'b'],
  });
  assert.deepEqual(
    merged.experiments.map((experiment) => experiment.experiment),
    ['a', 'b'],
  );
  assert.equal(merged.confirmationAttemptsPerFailure, 2);
  assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), merged);
});

test('diagnostic merge rejects an incomplete matrix', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-diagnostics-'));
  tempDirs.push(root);
  const partsDir = join(root, 'parts');
  await mkdir(partsDir);
  await writeFile(
    join(partsDir, 'a.json'),
    JSON.stringify({
      schemaVersion: 1,
      experiment: 'a',
      metric: 'pass@1',
      confirmationAttempts: 2,
      tasks: [],
    }),
  );

  await assert.rejects(
    () =>
      mergeDiagnostics({
        partsDir,
        outputPath: join(root, 'release-diagnostics.json'),
        expectedExperiments: ['a', 'b'],
      }),
    /missing \[b\]/,
  );
});
