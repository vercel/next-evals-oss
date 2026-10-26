import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyReleaseRuns,
  isVerifiedMeasurementPull,
  selectScheduledVersions,
  sourceBranchesForRelease,
} from './release-discovery.js';

const sha = 'a'.repeat(40);

function sourceDiscoveryClient(options: {
  parentCount?: number;
  statuses?: Record<
    string,
    'ahead' | 'behind' | 'diverged' | 'identical' | 'missing'
  >;
}) {
  const parent = 'b'.repeat(40);
  return {
    async get<T>(path: string): Promise<T> {
      if (path === `/repos/vercel/next.js/commits/${sha}`) {
        return {
          parents: Array.from({ length: options.parentCount ?? 1 }, () => ({
            sha: parent,
          })),
        } as T;
      }
      const prefix = `/repos/vercel/next.js/compare/${parent}...`;
      assert.equal(path.startsWith(prefix), true, `unexpected request: ${path}`);
      const branch = decodeURIComponent(path.slice(prefix.length));
      const status = options.statuses?.[branch] ?? 'diverged';
      if (status === 'missing') {
        throw new Error('GitHub request failed with status 404');
      }
      return { status } as T;
    },
  };
}

test('scheduled stable discovery includes backports and proceeds oldest first', () => {
  assert.deepEqual(
    selectScheduledVersions({
      publishedAt: {
        '16.2.3': '2026-10-13T10:00:00.000Z',
        '15.5.9': '2026-10-14T10:00:00.000Z',
        '16.2.4': '2026-10-14T12:00:00.000Z',
        '16.3.0-canary.1': '2026-10-14T09:00:00.000Z',
      },
      stablePublishedAfter: '2026-10-14T00:00:00.000Z',
    }),
    ['15.5.9', '16.2.4'],
  );
});

test('release provenance distinguishes releases, backports, and canaries', () => {
  const tagRun = {
    conclusion: 'success',
    event: 'push',
    head_branch: 'v16.2.4',
    head_sha: sha,
    html_url: 'https://github.com/vercel/next.js/actions/runs/1',
  };
  assert.deepEqual(
    classifyReleaseRuns({
      version: '16.2.4',
      sha,
      runs: [tagRun, { ...tagRun, head_branch: 'canary' }],
    }),
    { kind: 'release', sourceRunUrl: tagRun.html_url },
  );
  assert.deepEqual(
    classifyReleaseRuns({
      version: '16.2.4',
      sha,
      runs: [tagRun],
      sourceBranches: ['releases/lts/active'],
    }),
    { kind: 'backport', sourceRunUrl: tagRun.html_url },
  );
  const canaryTagRun = {
    ...tagRun,
    head_branch: 'v16.3.0-canary.12',
  };
  assert.deepEqual(
    classifyReleaseRuns({
      version: '16.3.0-canary.12',
      sha,
      runs: [canaryTagRun],
    }),
    { kind: 'canary', sourceRunUrl: tagRun.html_url },
  );
});

test('release provenance rejects missing or ambiguous source branches', () => {
  const tagRun = {
    conclusion: 'success',
    event: 'push',
    head_branch: 'v16.2.4',
    head_sha: sha,
    html_url: 'https://github.com/vercel/next.js/actions/runs/1',
  };

  assert.throws(
    () =>
      classifyReleaseRuns({
        version: '16.2.4',
        sha,
        runs: [tagRun],
        sourceBranches: [],
      }),
    /found: none/,
  );
  assert.throws(
    () =>
      classifyReleaseRuns({
        version: '16.2.4',
        sha,
        runs: [tagRun],
        sourceBranches: ['canary', 'next-16-2'],
      }),
    /found: canary, next-16-2/,
  );
});

test('an exact successful source run overrides ambiguous branch ancestry', () => {
  const tagRun = {
    conclusion: 'success',
    event: 'push',
    head_branch: 'v16.2.4',
    head_sha: sha,
    html_url: 'https://github.com/vercel/next.js/actions/runs/1',
  };

  assert.deepEqual(
    classifyReleaseRuns({
      version: '16.2.4',
      sha,
      runs: [tagRun, { ...tagRun, head_branch: 'next-16-2' }],
      sourceBranches: ['canary', 'next-16-2'],
    }),
    { kind: 'backport', sourceRunUrl: tagRun.html_url },
  );
});

test('release source discovery follows the release parent after branches advance', async () => {
  assert.deepEqual(
    await sourceBranchesForRelease(
      sourceDiscoveryClient({
        statuses: {
          'next-16-2': 'ahead',
          'releases/lts/active': 'missing',
        },
      }),
      '16.2.4',
      sha,
    ),
    ['next-16-2'],
  );
  assert.deepEqual(
    await sourceBranchesForRelease(
      sourceDiscoveryClient({ statuses: { canary: 'identical' } }),
      '16.2.4',
      sha,
    ),
    ['canary'],
  );
});

test('release source discovery rejects merge commits', async () => {
  await assert.rejects(
    () =>
      sourceBranchesForRelease(
        sourceDiscoveryClient({ parentCount: 2 }),
        '16.2.4',
        sha,
      ),
    /single-parent release commit/,
  );
});

test('only bot-authored measurement pull requests suppress a release', () => {
  const pull = {
    title: 'Record Next.js v16.2.4 pass@1 measurement',
    user: { login: 'github-actions[bot]' },
    base: { ref: 'main' },
    head: {
      ref: 'automation/measure-next-16.2.4-12345',
      repo: { full_name: 'vercel/next-evals-oss' },
    },
  };

  assert.equal(isVerifiedMeasurementPull(pull, '16.2.4'), true);
  assert.equal(
    isVerifiedMeasurementPull(
      { ...pull, user: { login: 'someone-else' } },
      '16.2.4',
    ),
    false,
  );
  assert.equal(
    isVerifiedMeasurementPull(
      {
        ...pull,
        head: { ...pull.head, ref: 'lookalike-branch' },
      },
      '16.2.4',
    ),
    false,
  );
  assert.equal(
    isVerifiedMeasurementPull(
      {
        ...pull,
        head: {
          ...pull.head,
          repo: { full_name: 'someone-else/next-evals-oss' },
        },
      },
      '16.2.4',
    ),
    false,
  );
});

test('release provenance requires a successful tag run', () => {
  assert.equal(
    classifyReleaseRuns({
      version: '16.2.4',
      sha,
      runs: [
        {
          conclusion: 'failure',
          event: 'push',
          head_branch: 'v16.2.4',
          head_sha: sha,
          html_url: 'https://github.com/vercel/next.js/actions/runs/1',
        },
      ],
    }),
    undefined,
  );
});
