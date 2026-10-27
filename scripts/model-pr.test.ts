import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type PullRequestFile,
  type PullRequestSnapshot,
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
