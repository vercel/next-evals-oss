import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyReleaseRuns,
  classifyPublishedCanaryRun,
  isMonitoredRelease,
  isVerifiedMeasurementPull,
  selectScheduledVersions,
  sourceBranchesForRelease,
  resolveTarget,
} from './release-discovery.js';

const sha = 'a'.repeat(40);

const publishedCanary = {
  version: '16.5.0-canary.65',
  sha,
  run: {
    id: 123,
    conclusion: 'failure',
    event: 'push',
    head_branch: 'v16.5.0-canary.65',
    head_sha: sha,
    html_url: 'https://github.com/vercel/next.js/actions/runs/123',
  },
  totalCount: 4,
  jobs: [
    { name: 'build', status: 'completed', conclusion: 'success' },
    { name: 'build-wasm (nodejs)', status: 'completed', conclusion: 'success' },
    {
      name: 'Potentially publish release',
      status: 'completed',
      conclusion: 'failure',
    },
    {
      name: 'Un-draft GitHub release',
      status: 'completed',
      conclusion: 'skipped',
    },
  ],
};

test('published canaries retain their exact tag run when only publication failed', async () => {
  const expected = {
    kind: 'canary',
    sourceRunUrl: publishedCanary.run.html_url,
  };
  assert.deepEqual(classifyPublishedCanaryRun(publishedCanary), expected);
  const requests: string[] = [];
  const target = await resolveTarget(
    {
      async get<T>(path: string): Promise<T> {
        requests.push(path);
        if (path.includes('/git/ref/tags/'))
          return { object: { sha, type: 'commit' } } as T;
        if (path.includes('/workflows/build_and_deploy.yml/runs?'))
          return { workflow_runs: [publishedCanary.run] } as T;
        assert.equal(
          path,
          '/repos/vercel/next.js/actions/runs/123/jobs?per_page=100',
        );
        return {
          total_count: publishedCanary.totalCount,
          jobs: publishedCanary.jobs,
        } as T;
      },
    },
    publishedCanary.version,
  );
  assert.deepEqual(target, {
    ...expected,
    version: publishedCanary.version,
    ref: `v${publishedCanary.version}`,
    sha,
  });
  assert.equal(requests.length, 3);
});

test('a published canary still requires complete successful build jobs', () => {
  for (const jobs of [
    publishedCanary.jobs.filter((job) => job.name !== 'build'),
    publishedCanary.jobs.map((job) =>
      job.name === 'build' ? { ...job, conclusion: 'failure' } : job,
    ),
    publishedCanary.jobs.map((job) =>
      job.name === 'build-wasm (nodejs)'
        ? { ...job, conclusion: 'failure' }
        : job,
    ),
    publishedCanary.jobs.map((job) =>
      job.name === 'build-wasm (nodejs)'
        ? { ...job, status: 'in_progress', conclusion: null }
        : job,
    ),
    publishedCanary.jobs.map((job) =>
      job.name === 'Potentially publish release'
        ? { ...job, conclusion: 'cancelled' }
        : job,
    ),
  ]) {
    assert.equal(
      classifyPublishedCanaryRun({
        ...publishedCanary,
        jobs,
        totalCount: jobs.length,
      }),
      undefined,
    );
  }
  assert.equal(
    classifyPublishedCanaryRun({ ...publishedCanary, totalCount: 101 }),
    undefined,
  );
});

test('the publication fallback never accepts another version, commit, event, or stable release', () => {
  for (const run of [
    { ...publishedCanary.run, head_sha: 'b'.repeat(40) },
    { ...publishedCanary.run, head_branch: 'canary' },
    { ...publishedCanary.run, head_branch: 'v16.5.0-canary.64' },
    { ...publishedCanary.run, event: 'workflow_dispatch' },
    { ...publishedCanary.run, conclusion: 'cancelled' },
  ]) {
    assert.equal(
      classifyPublishedCanaryRun({ ...publishedCanary, run }),
      undefined,
    );
  }
  assert.equal(
    classifyPublishedCanaryRun({
      ...publishedCanary,
      version: '16.4.6',
      run: { ...publishedCanary.run, head_branch: 'v16.4.6' },
    }),
    undefined,
  );
});

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
      assert.equal(
        path.startsWith(prefix),
        true,
        `unexpected request: ${path}`,
      );
      const branch = decodeURIComponent(path.slice(prefix.length));
      const status = options.statuses?.[branch] ?? 'diverged';
      if (status === 'missing') {
        throw new Error('GitHub request failed with status 404');
      }
      return { status } as T;
    },
  };
}

test('scheduled discovery includes only 16.x backports and proceeds oldest first', () => {
  assert.deepEqual(
    selectScheduledVersions({
      publishedAt: {
        '16.2.3': '2026-10-13T10:00:00.000Z',
        '15.5.9': '2026-10-14T10:00:00.000Z',
        '14.2.99': '2026-10-14T10:30:00.000Z',
        '16.1.9': '2026-10-14T11:00:00.000Z',
        '17.0.0': '2026-10-14T11:30:00.000Z',
        '16.2.4': '2026-10-14T12:00:00.000Z',
        '16.3.0-canary.1': '2026-10-14T09:00:00.000Z',
      },
      stablePublishedAfter: '2026-10-14T00:00:00.000Z',
    }),
    ['16.1.9', '16.2.4'],
  );
});

test('manual release policy accepts exact 16.x stable and canary versions only', () => {
  for (const version of ['16.1.0', '16.4.5', '16.5.0-canary.42'])
    assert.equal(isMonitoredRelease(version), true);
  for (const version of [
    '15.5.29',
    '14.2.99',
    '17.0.0',
    '^16',
    '16.5.0-beta.1',
  ])
    assert.equal(isMonitoredRelease(version), false);
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
