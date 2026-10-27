import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  type PullRequestFile,
  type PullRequestSnapshot,
  findIncompleteResults,
  selectModelCandidate,
  selectModelExperiments,
} from './model-pr.js';

const pullRequest: PullRequestSnapshot = {
  number: 132,
  state: 'open',
  user: { login: 'roboeve[bot]' },
  base: { ref: 'main' },
  head: {
    ref: 'v/register-new-models-2026-10-07',
    sha: 'a'.repeat(40),
    repo: { full_name: 'vercel/next-evals-oss' },
  },
};

const files: PullRequestFile[] = [
  { filename: 'experiments/gpt-6.1-sol-high.ts', status: 'added' },
  {
    filename: 'experiments/gpt-6.1-sol-high--agents-md.ts',
    status: 'added',
  },
  { filename: 'scripts/cost.ts', status: 'modified' },
  { filename: 'scripts/export-results.ts', status: 'modified' },
  { filename: 'scripts/check-stale.mjs', status: 'modified' },
];

test('selects paired experiments from a RoboEve registration PR', () => {
  assert.deepEqual(
    selectModelExperiments(pullRequest, files, 'vercel/next-evals-oss'),
    {
      number: 132,
      headRef: 'v/register-new-models-2026-10-07',
      headSha: 'a'.repeat(40),
      pairs: [
        {
          base: 'gpt-6.1-sol-high',
          experiments: ['gpt-6.1-sol-high', 'gpt-6.1-sol-high--agents-md'],
        },
      ],
    },
  );
});

test('rejects a missing AGENTS.md pair', () => {
  assert.throws(
    () =>
      selectModelExperiments(pullRequest, [files[0]], 'vercel/next-evals-oss'),
    /missing its --agents-md experiment/,
  );
});

test('rejects non-bot and cross-repository pull requests', () => {
  assert.throws(
    () =>
      selectModelExperiments(
        { ...pullRequest, user: { login: 'someone' } },
        files,
        'vercel/next-evals-oss',
      ),
    /only RoboEve-authored/,
  );
  assert.throws(
    () =>
      selectModelExperiments(
        {
          ...pullRequest,
          head: {
            ...pullRequest.head,
            repo: { full_name: 'someone/next-evals-oss' },
          },
        },
        files,
        'vercel/next-evals-oss',
      ),
    /head branch must belong/,
  );
});

test('rejects changes outside model-registration paths', () => {
  assert.throws(
    () =>
      selectModelExperiments(
        pullRequest,
        [...files, { filename: 'package.json', status: 'modified' }],
        'vercel/next-evals-oss',
      ),
    /unexpected changed path package.json/,
  );
});

test('scheduled discovery skips a registration that already has results', () => {
  const measuredFiles = [
    ...files,
    { filename: 'agent-results.json', status: 'modified' },
    {
      filename: 'results/gpt-6.1-sol-high/run/summary.json',
      status: 'added',
    },
    {
      filename: 'results/gpt-6.1-sol-high--agents-md/run/summary.json',
      status: 'added',
    },
  ];
  assert.equal(
    selectModelCandidate(
      [{ pullRequest, files: measuredFiles }],
      'vercel/next-evals-oss',
    ),
    null,
  );
  assert.ok(
    selectModelCandidate(
      [{ pullRequest, files: measuredFiles }],
      'vercel/next-evals-oss',
      true,
    ),
  );
});

async function writeResult(
  root: string,
  evalName: string,
  options: {
    batch?: string;
    passedRuns?: number;
    totalRuns?: number;
    valid?: boolean;
    classification?: { failureType: string };
    transcript?: boolean;
    evalOutput?: string;
  } = {},
) {
  const evalDir = join(
    root,
    'results',
    'gpt-6.1-sol-high',
    options.batch ?? '2026-10-27T12-00-00.000Z',
    evalName,
  );
  const totalRuns = options.totalRuns ?? 1;
  await mkdir(evalDir, { recursive: true });
  await writeFile(
    join(evalDir, 'summary.json'),
    JSON.stringify({
      totalRuns,
      passedRuns: options.passedRuns ?? 1,
      ...(options.valid === undefined ? {} : { valid: options.valid }),
    }),
  );
  if (options.classification) {
    await writeFile(
      join(evalDir, 'classification.json'),
      JSON.stringify(options.classification),
    );
  }
  for (let run = 1; run <= totalRuns; run++) {
    const runDir = join(evalDir, `run-${run}`);
    await mkdir(join(runDir, 'outputs'), { recursive: true });
    await writeFile(join(runDir, 'result.json'), JSON.stringify({}));
    if (options.transcript !== false) {
      await writeFile(join(runDir, 'transcript-raw.jsonl'), '{}\n');
    }
    await writeFile(
      join(runDir, 'outputs', 'eval.txt'),
      options.evalOutput ?? 'Tests passed\n',
    );
  }
}

test('accepts complete passing and classified model-failure results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-model-pr-'));
  try {
    await writeResult(root, 'agent-000', { totalRuns: 2, passedRuns: 1 });
    await writeResult(root, 'agent-021', {
      totalRuns: 4,
      passedRuns: 0,
      classification: { failureType: 'model' },
    });
    assert.deepEqual(
      findIncompleteResults(root, 'gpt-6.1-sol-high', ['agent-000', 'agent-021']),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects unclassified, non-model, invalid, and transcript-less results', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-model-pr-'));
  try {
    await writeResult(root, 'agent-000', { passedRuns: 0 });
    await writeResult(root, 'agent-021', {
      passedRuns: 0,
      classification: { failureType: 'infra' },
    });
    await writeResult(root, 'agent-022', { valid: false });
    await writeResult(root, 'agent-023', { transcript: false });
    await writeResult(root, 'agent-024', {
      evalOutput: 'Error: failed to load config from vitest.config.ts',
    });
    const problems = findIncompleteResults(root, 'gpt-6.1-sol-high', [
      'agent-000',
      'agent-021',
      'agent-022',
      'agent-023',
      'agent-024',
      'agent-025',
    ]);
    assert.deepEqual(problems, [
      'agent-000: failure was never classified',
      'agent-021: infra failure is not model signal',
      'agent-022: summary is marked invalid',
      'agent-023/run-1: has no agent transcript',
      'agent-024/run-1: contains an evaluator startup failure',
      'agent-025: no result',
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('validates only the newest batch that contains each eval', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-model-pr-'));
  try {
    await writeResult(root, 'agent-000', {
      batch: '2026-10-27T10-00-00.000Z',
      passedRuns: 0,
    });
    await writeResult(root, 'agent-000', {
      batch: '2026-10-27T11-00-00.000Z',
      passedRuns: 1,
    });
    assert.deepEqual(
      findIncompleteResults(root, 'gpt-6.1-sol-high', ['agent-000']),
      [],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
