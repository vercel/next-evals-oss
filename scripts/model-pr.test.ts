import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  type PullRequestFile,
  type PullRequestSnapshot,
  checkGatewayModelAccess,
  findIncompleteResults,
  gatewayModelId,
  hasRequiredModelApprovals,
  selectModelCandidate,
  selectModelExperiments,
  selectModelNotificationCandidate,
  validateModelRegistrationBranch,
} from './model-pr.js';

test('normalizes harness model ids for the live Gateway probe', () => {
  assert.equal(
    gatewayModelId('vercel/meta/muse-wonder-1.0'),
    'meta/muse-wonder-1.0',
  );
  assert.equal(
    gatewayModelId('openai/gpt-6.1-terra?reasoningEffort=high'),
    'openai/gpt-6.1-terra',
  );
  assert.equal(
    gatewayModelId('claude-sonnet-5.5', 'vercel-ai-gateway/claude-code'),
    'anthropic/claude-sonnet-5.5',
  );
});

test('fails before the matrix when Gateway model access is denied', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    assert.equal(
      (init?.headers as Record<string, string>).authorization,
      'Bearer test-key',
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      model: 'meta/muse-wonder-1.0',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'ok' }],
    });
    return new Response(
      JSON.stringify({
        error: 'Your team has restricted access to this provider',
      }),
      { status: 403 },
    );
  };

  await assert.rejects(
    checkGatewayModelAccess(
      'vercel/meta/muse-wonder-1.0',
      'test-key',
      fetchImpl,
    ),
    /rejected meta\/muse-wonder-1\.0 before the eval matrix started \(403\).*restricted access/,
  );
});

test('accepts a successful live Gateway model probe', async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('{}', { status: 200 });
  assert.equal(
    await checkGatewayModelAccess(
      'openai/gpt-6.1-terra?reasoningEffort=high',
      'test-key',
      fetchImpl,
    ),
    'openai/gpt-6.1-terra',
  );
});

test('retries a transient Gateway failure before the matrix', async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async () => {
    requests++;
    return requests === 1
      ? new Response('Service temporarily unavailable', { status: 503 })
      : new Response('{}', { status: 200 });
  };
  const delays: number[] = [];

  assert.equal(
    await checkGatewayModelAccess(
      'openai/gpt-6.1-terra',
      'test-key',
      fetchImpl,
      undefined,
      async (milliseconds) => {
        delays.push(milliseconds);
      },
    ),
    'openai/gpt-6.1-terra',
  );
  assert.equal(requests, 2);
  assert.deepEqual(delays, [1_000]);
});

test('retries a Gateway connection failure before the matrix', async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async () => {
    requests++;
    if (requests === 1) throw new Error('socket reset');
    return new Response('{}', { status: 200 });
  };
  const delays: number[] = [];

  assert.equal(
    await checkGatewayModelAccess(
      'openai/gpt-6.1-terra',
      'test-key',
      fetchImpl,
      undefined,
      async (milliseconds) => {
        delays.push(milliseconds);
      },
    ),
    'openai/gpt-6.1-terra',
  );
  assert.equal(requests, 2);
  assert.deepEqual(delays, [1_000]);
});

test('reports a Gateway connection failure after the retry limit', async () => {
  let requests = 0;
  const delays: number[] = [];

  await assert.rejects(
    checkGatewayModelAccess(
      'openai/gpt-6.1-terra',
      'test-key',
      async () => {
        requests++;
        throw new Error('socket reset\nwith extra detail');
      },
      undefined,
      async (milliseconds) => {
        delays.push(milliseconds);
      },
    ),
    /failed for openai\/gpt-6\.1-terra after 3 attempts: socket reset with extra detail/,
  );
  assert.equal(requests, 3);
  assert.deepEqual(delays, [1_000, 2_000]);
});

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

const review = {
  approvals: [
    { login: 'maintainer', permission: 'write' },
    { login: 'owner', permission: 'admin' },
  ],
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
    selectModelExperiments(
      pullRequest,
      files,
      'vercel/next-evals-oss',
      review,
    ),
    {
      number: 132,
      headRef: 'v/register-new-models-2026-10-07',
      headSha: 'a'.repeat(40),
      approvedBy: ['maintainer', 'owner'],
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
      selectModelExperiments(
        pullRequest,
        [files[0]],
        'vercel/next-evals-oss',
        review,
      ),
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
        review,
      ),
    /only automation-authored/,
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
        review,
      ),
    /head branch must belong/,
  );
});

test('accepts registration PRs opened by the repository workflow', () => {
  const selection = selectModelExperiments(
    { ...pullRequest, user: { login: 'github-actions[bot]' } },
    files,
    'vercel/next-evals-oss',
    review,
  );
  assert.equal(selection.number, pullRequest.number);
});

test('validates orphan registration branches with the PR path rules', () => {
  assert.deepEqual(
    validateModelRegistrationBranch(pullRequest.head.ref, files),
    [
      {
        base: 'gpt-6.1-sol-high',
        experiments: [
          'gpt-6.1-sol-high',
          'gpt-6.1-sol-high--agents-md',
        ],
      },
    ],
  );
  assert.throws(
    () => validateModelRegistrationBranch('feature/not-registration', files),
    /must start with v\/register-/,
  );
});

test('rejects changes outside model-registration paths', () => {
  assert.throws(
    () =>
      selectModelExperiments(
        pullRequest,
        [...files, { filename: 'package.json', status: 'modified' }],
        'vercel/next-evals-oss',
        review,
      ),
    /unexpected changed path package.json/,
  );
});

test('requires two maintainer approvals of the exact head commit', () => {
  const select = (candidate: Partial<typeof review>) =>
    selectModelExperiments(pullRequest, files, 'vercel/next-evals-oss', {
      ...review,
      ...candidate,
    });
  const needsApproval = /needs approving reviews from two maintainers/;

  assert.throws(() => select({ approvals: [] }), needsApproval);
  assert.throws(
    () => select({ approvals: [{ login: 'reader', permission: 'read' }] }),
    needsApproval,
  );
  assert.throws(
    () =>
      select({ approvals: [{ login: 'maintainer', permission: 'write' }] }),
    needsApproval,
  );
  assert.throws(
    () =>
      select({
        approvals: [
          { login: 'maintainer', permission: 'write' },
          { login: 'maintainer', permission: 'write' },
        ],
      }),
    needsApproval,
  );
  assert.deepEqual(
    select({
      approvals: [
        { login: 'reader', permission: 'read' },
        { login: 'owner', permission: 'admin' },
        { login: 'maintainer', permission: 'write' },
      ],
    }).approvedBy,
    ['maintainer', 'owner'],
  );
});

test('keeps approval notifications pending until two maintainers approve', () => {
  assert.equal(hasRequiredModelApprovals([]), false);
  assert.equal(hasRequiredModelApprovals(['maintainer']), false);
  assert.equal(hasRequiredModelApprovals(['maintainer', 'owner']), true);
});

test('selects a structurally valid model PR before approval for notification', () => {
  const candidate = selectModelNotificationCandidate(
    [
      {
        pullRequest,
        files,
        approvals: [],
        measuredByAutomation: false,
      },
    ],
    'vercel/next-evals-oss',
  );

  assert.equal(candidate?.number, 132);
  assert.deepEqual(candidate?.approvedBy, []);
  assert.deepEqual(candidate?.pairs, [
    {
      base: 'gpt-6.1-sol-high',
      experiments: ['gpt-6.1-sol-high', 'gpt-6.1-sol-high--agents-md'],
    },
  ]);
});

test('an older unapproved PR does not block a newer approved PR', () => {
  const waiting = {
    pullRequest,
    files,
    approvals: [],
    measuredByAutomation: false,
  };
  const approved = {
    ...waiting,
    pullRequest: {
      ...pullRequest,
      number: 133,
      head: {
        ...pullRequest.head,
        ref: 'v/register-newer-models-2026-10-08',
        sha: 'b'.repeat(40),
      },
    },
    approvals: review.approvals,
  };

  assert.equal(
    selectModelCandidate([waiting, approved], 'vercel/next-evals-oss')?.number,
    133,
  );
});

test('scheduled discovery skips only workflow-authored complete results', () => {
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
      [
        {
          pullRequest,
          files: measuredFiles,
          ...review,
          measuredByAutomation: true,
        },
      ],
      'vercel/next-evals-oss',
    ),
    null,
  );
  assert.ok(
    selectModelCandidate(
      [
        {
          pullRequest,
          files: measuredFiles,
          ...review,
          measuredByAutomation: true,
        },
      ],
      'vercel/next-evals-oss',
      true,
    ),
  );
  assert.ok(
    selectModelCandidate(
      [
        {
          pullRequest,
          files: measuredFiles,
          ...review,
          measuredByAutomation: false,
        },
      ],
      'vercel/next-evals-oss',
    ),
    'committed smoke or partial results must not suppress measurement',
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

test('removes rejected results so the recovery pass re-runs them', async () => {
  const root = await mkdtemp(join(tmpdir(), 'next-evals-model-pr-'));
  try {
    await writeResult(root, 'agent-000', { totalRuns: 2, passedRuns: 1 });
    await writeResult(root, 'agent-021', {
      totalRuns: 2,
      passedRuns: 1,
      transcript: false,
    });
    const problems = findIncompleteResults(
      root,
      'gpt-6.1-sol-high',
      ['agent-000', 'agent-021'],
      { remove: true },
    );
    assert.deepEqual(problems, [
      'agent-021/run-1: has no agent transcript',
      'agent-021/run-2: has no agent transcript',
      'agent-021: removed so the next recovery pass re-runs it',
    ]);
    const batch = join(
      root,
      'results',
      'gpt-6.1-sol-high',
      '2026-10-27T12-00-00.000Z',
    );
    assert.ok(existsSync(join(batch, 'agent-000', 'summary.json')));
    assert.ok(!existsSync(join(batch, 'agent-021')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
