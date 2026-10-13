import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  buildReleaseNotification,
  buildReleaseReport,
  findInvalidRunReason,
  prepareReleaseWorkspace,
  validateReleaseResults,
  validateReleaseTarget,
} from './release-automation.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test('release metadata is pinned to a stable tag and full SHA', () => {
  const target = validateReleaseTarget({
    kind: 'release',
    version: '16.2.4',
    ref: 'v16.2.4',
    sha: 'a'.repeat(40),
    sourceRunUrl: 'https://github.com/vercel/next.js/actions/runs/12345',
    evaluatedAt: '2026-10-13T12:00:00.000Z',
  });
  assert.equal(target.version, '16.2.4');

  assert.throws(
    () => validateReleaseTarget({ ...target, version: '16.2.4-canary.1' }),
    /stable exact version/,
  );
  assert.throws(
    () => validateReleaseTarget({ ...target, kind: 'other' as 'release' }),
    /releaseKind/,
  );
  assert.throws(
    () => validateReleaseTarget({ ...target, ref: 'canary' }),
    /nextRef/,
  );
  assert.throws(
    () =>
      validateReleaseTarget({
        ...target,
        sourceRunUrl: 'https://example.com/actions/runs/1',
      }),
    /vercel\/next\.js/,
  );
});

test('release results are prepared outside the publishable repository tree', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'next-evals-workspace-'));
  tempDirs.push(parent);
  const root = join(parent, 'repository');
  const evals = join(parent, 'fixed-evals');
  const workspace = join(parent, 'release-workspace');
  for (const directory of ['experiments', 'lib', 'node_modules']) {
    await mkdir(join(root, directory), { recursive: true });
  }
  await mkdir(join(evals, 'task'), { recursive: true });
  await writeFile(join(root, 'experiments', 'model.ts'), 'export default {}');
  await writeFile(join(root, 'lib', 'setup.ts'), 'export const setup = true');
  await writeFile(join(evals, 'task', 'eval.ts'), 'export default {}');

  await prepareReleaseWorkspace({ root, workspace, evals });

  assert.equal(
    await readFile(join(workspace, 'experiments', 'model.ts'), 'utf8'),
    'export default {}',
  );
  assert.equal(
    await readFile(join(workspace, 'evals', 'task', 'eval.ts'), 'utf8'),
    'export default {}',
  );
  await assert.rejects(() =>
    prepareReleaseWorkspace({
      root,
      workspace: join(root, 'release-results'),
      evals,
    }),
  );
});

test('the reporting gate distinguishes assertion failures from infrastructure failures', () => {
  assert.equal(
    findInvalidRunReason({
      result: { status: 'failed' },
      hasTranscript: true,
      evalOutput: 'AssertionError: expected false to be true',
    }),
    undefined,
  );
  assert.match(
    findInvalidRunReason({
      result: { status: 'failed' },
      hasTranscript: false,
    }) ?? '',
    /no agent transcript/,
  );
  assert.match(
    findInvalidRunReason({
      result: { status: 'failed' },
      hasTranscript: true,
      evalOutput: "Startup Error: Cannot find module 'vitest/config'",
    }) ?? '',
    /evaluator startup failure/,
  );
});

test('agent notification points at the standalone workflow artifact', () => {
  const report = buildReleaseReport(
    {
      metadata: {
        measurement: {
          metric: 'pass@1',
          scoredAttempts: 1,
          infrastructureFailuresExcluded: true,
        },
        experiments: [
          {
            name: 'model',
            modelName: 'Model',
            agentHarness: 'Harness',
            docsImpact: {
              newlyPassed: ['task-b'],
              newlyFailed: [],
            },
          },
        ],
      },
      results: {
        model: [
          { evalPath: 'task-a', result: { success: true } },
          { evalPath: 'task-b', result: { success: true } },
        ],
      },
    },
    {
      metric: 'pass@1',
      confirmationAttemptsPerFailure: 2,
      experiments: [
        {
          experiment: 'model',
          tasks: [
            {
              evalName: 'task-b',
              scoredFailureReason: 'assertion failed',
              confirmations: [
                { outcome: 'failed', infrastructureRetries: 1 },
                { outcome: 'passed', infrastructureRetries: 0 },
              ],
            },
          ],
        },
      ],
    },
  );
  const notification = buildReleaseNotification({
    target: {
      kind: 'backport',
      version: '16.2.4',
      ref: 'v16.2.4',
      sha: 'a'.repeat(40),
      sourceRunUrl: 'https://github.com/vercel/next.js/actions/runs/12345',
      evaluatedAt: '2026-10-13T12:00:00.000Z',
    },
    workflowUrl: 'https://github.com/vercel/next.js/actions/runs/12345',
    artifactUrl:
      'https://github.com/vercel/next.js/actions/runs/12345/artifacts/67890',
    report,
  });

  assert.equal(notification.schemaVersion, 3);
  assert.equal(notification.metric, 'pass@1');
  assert.equal(notification.target.kind, 'backport');
  assert.equal(notification.validation.modelFailureConfirmationAttempts, 2);
  assert.equal(notification.report.scores.withoutAgentsMd.passed, 1);
  assert.equal(notification.report.scores.withAgentsMd.passed, 2);
  assert.equal(notification.report.failures[0].reproducible, false);
  assert.deepEqual(Object.keys(notification).sort(), [
    'artifactUrl',
    'metric',
    'report',
    'schemaVersion',
    'target',
    'validation',
    'workflowUrl',
  ]);
});

async function makeResult(
  options: { evalOutput?: string; transcript?: boolean } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-release-'));
  tempDirs.push(root);
  const evalName = 'agent-001-example';
  const experiment = 'model';
  const runDir = join(
    root,
    'results',
    experiment,
    '2026-10-13T12-30-00.000Z',
    evalName,
    'run-1',
  );
  await mkdir(join(root, 'evals', evalName), { recursive: true });
  await mkdir(join(runDir, 'outputs'), { recursive: true });
  await writeFile(
    join(runDir, '..', 'summary.json'),
    JSON.stringify({ totalRuns: 1, passedRuns: 0 }),
  );
  await writeFile(
    join(runDir, 'result.json'),
    JSON.stringify({ status: 'failed' }),
  );
  if (options.transcript !== false)
    await writeFile(join(runDir, 'transcript.json'), '{}');
  if (options.evalOutput !== undefined) {
    await writeFile(join(runDir, 'outputs', 'eval.txt'), options.evalOutput);
  }
  return { root, experiment };
}

test('complete model failures are reportable', async () => {
  const { root, experiment } = await makeResult({
    evalOutput: 'AssertionError: expected 1 to be 2',
  });
  await validateReleaseResults({
    root,
    experiments: [experiment],
    startedAt: '2026-10-13T12:00:00.000Z',
  });
});

test('a missing evaluator output blocks the entire release result set', async () => {
  const { root, experiment } = await makeResult();
  await assert.rejects(
    () =>
      validateReleaseResults({
        root,
        experiments: [experiment],
        startedAt: '2026-10-13T12:00:00.000Z',
      }),
    /has no evaluator output/,
  );
});
