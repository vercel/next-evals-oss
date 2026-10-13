import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';

import {
  findInvalidRunReason,
  formatReleaseSummary,
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

test('the publish gate distinguishes assertion failures from infrastructure failures', () => {
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

test('Slack summary separates AGENTS.md and lists changed task/agent cells', () => {
  const text = formatReleaseSummary({
    target: {
      kind: 'backport',
      version: '16.2.4',
      ref: 'v16.2.4',
      sha: 'a'.repeat(40),
      sourceRunUrl: 'https://github.com/vercel/next.js/actions/runs/12345',
      evaluatedAt: '2026-10-13T12:00:00.000Z',
    },
    prUrl: 'https://github.com/vercel/next-evals-oss/pull/123',
    snapshots: [
      {
        experiment: 'kimi-k3',
        evalName: 'agent-030-hard',
        previous: false,
        current: true,
      },
      {
        experiment: 'kimi-k3--agents-md',
        evalName: 'agent-030-hard',
        previous: true,
        current: false,
      },
    ],
  });

  assert.match(text, /v16\.2\.4 backport evals — pass@1/);
  assert.match(text, /Without AGENTS\.md: 1\/1 passed/);
  assert.match(text, /kimi-k3 without AGENTS\.md ❌→✅/);
  assert.match(text, /kimi-k3 with AGENTS\.md ✅→❌/);
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

test('complete model failures are publishable', async () => {
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
