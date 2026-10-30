import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/model-pr-evals.yml',
  import.meta.url,
);
const openerWorkflowPath = new URL(
  '../.github/workflows/open-model-registration-pr.yml',
  import.meta.url,
);
const detectorWorkflowPath = new URL(
  '../.github/workflows/detect-model-registration-branch.yml',
  import.meta.url,
);
const notificationPath = new URL(
  '../apps/release-agent/agent/lib/model-pr-notification.ts',
  import.meta.url,
);

function job(workflow: string, name: string) {
  const [, rest] = workflow.split(`\n  ${name}:\n`);
  assert.ok(rest, `missing ${name} job`);
  return rest.split(/\n  [a-z]+:\n/)[0];
}

test('publishing preserves log whitespace while checking the exported dataset', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const command = job(workflow, 'update').match(
    /^\s+(git diff --cached --check[^\n]*)$/m,
  )?.[1];
  assert.ok(command, 'missing staged whitespace check');
  const cwd = await mkdtemp(join(tmpdir(), 'model-result-whitespace-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' });

  try {
    git('init', '--quiet');
    const log = 'Generating static pages (2/4) \n\n';
    await writeFile(join(cwd, 'build.txt'), log);
    await writeFile(join(cwd, 'agent-results.json'), '{}\n');
    git('add', '.');
    assert.throws(() => git('diff', '--cached', '--check'));
    execFileSync('bash', ['-e', '-c', command], { cwd, stdio: 'pipe' });
    assert.equal(git('show', ':build.txt').toString(), log);

    await writeFile(join(cwd, 'agent-results.json'), '{} \n');
    git('add', 'agent-results.json');
    assert.throws(() =>
      execFileSync('bash', ['-e', '-c', command], { cwd, stdio: 'pipe' }),
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test('model registration automation is restricted to merged main', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /pull_request:\n    types: \[opened, reopened, synchronize\]/);
  assert.match(workflow, /pull_request_review:/);
  assert.match(workflow, /types: \[submitted\]/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(
    workflow,
    /run-name: Measure models from PR \$\{\{ github\.event\.pull_request\.number \|\| inputs\.prNumber \|\| 'queue' \}\}/,
  );
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.match(
    workflow,
    /github\.event_name == 'pull_request'[\s\S]*github\.event\.pull_request\.base\.ref == 'main'/,
  );
  assert.match(
    workflow,
    /contains\(fromJSON\('\["roboeve\[bot\]", "github-actions\[bot\]"\]'\), github\.event\.pull_request\.user\.login\)[\s\S]*startsWith\(github\.event\.pull_request\.head\.ref, 'v\/register-'\)/,
  );
  assert.match(
    workflow,
    /github\.event_name == 'pull_request_review'[\s\S]*github\.event\.review\.state == 'approved'[\s\S]*github\.event\.pull_request\.base\.ref == 'main'/,
  );
  assert.match(
    workflow,
    /PR_NUMBER: \$\{\{ inputs\.prNumber \|\| github\.event\.pull_request\.number \}\}/,
  );
  assert.match(workflow, /roboeve\[bot\]/);
  assert.match(workflow, /v\/register-/);
  // Credentials are granted only after two maintainers approve the head SHA.
  assert.match(workflow, /pulls\.listReviews/);
  assert.match(workflow, /getCollaboratorPermissionLevel/);
  assert.match(workflow, /review\.commit_id !== pull\.head\.sha/);
  assert.match(workflow, /latestReviewByUser/);
  assert.match(workflow, /review\.id > previous\.id/);
  assert.match(workflow, /review\.state !== 'APPROVED'/);
  assert.match(workflow, /two maintainers approve/);
  assert.match(workflow, /measuredByAutomation/);
  assert.match(workflow, /Record model evaluation results/);
  assert.match(workflow, /Model eval Slack thread/);
  assert.match(workflow, /Re-dispatch the model PR from main/);
  assert.match(workflow, /createWorkflowDispatch/);
  assert.match(workflow, /workflow_id: 'model-pr-evals\.yml'/);
  assert.match(workflow, /ref: 'main'/);
  assert.match(workflow, /force: 'false'/);
  assert.match(workflow, /FORCE: \$\{\{ inputs\.force \}\}/);
  assert.match(workflow, /approval_required/);
  assert.match(workflow, /run_succeeded/);
  assert.match(workflow, /run_failed/);
  assert.match(workflow, /eve-session:/);
  assert.match(workflow, /needs\.notify\.outputs\.session-id/);
  assert.doesNotMatch(workflow, /Install Vercel CLI/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /pnpm\/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6\.1\.0/);
});

test('RoboEve branch detection is unprivileged', async () => {
  const workflow = await readFile(detectorWorkflowPath, 'utf8');

  assert.match(workflow, /push:\n    branches:\n      - v\/register-\*/);
  assert.match(workflow, /permissions: \{\}/);
  assert.doesNotMatch(workflow, /actions\/checkout/);
  assert.doesNotMatch(workflow, /id-token: write/);
  assert.doesNotMatch(workflow, /pull-requests: write/);
});

test('RoboEve branch detection opens a draft registration PR from main', async () => {
  const workflow = await readFile(openerWorkflowPath, 'utf8');
  const open = job(workflow, 'open');

  assert.match(workflow, /workflow_run:/);
  assert.match(workflow, /workflows: \[Detect a model registration branch\]/);
  assert.match(workflow, /types: \[completed\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /schedule:/);
  assert.match(open, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(open, /github\.event\.workflow_run\.event == 'push'/);
  assert.match(open, /github\.event\.workflow_run\.actor\.login == 'roboeve\[bot\]'/);
  assert.match(open, /github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  assert.match(open, /startsWith\(github\.event\.workflow_run\.head_branch, 'v\/register-'\)/);
  assert.match(open, /github\.ref == 'refs\/heads\/main'/);
  assert.match(open, /actions: write/);
  assert.match(open, /pull-requests: write/);
  assert.doesNotMatch(open, /id-token: write/);
  assert.doesNotMatch(open, /AI_GATEWAY_API_KEY/);
  assert.doesNotMatch(open, /actions\/checkout/);
  assert.match(open, /draft: true/);
  assert.match(open, /pulls\.create/);
  assert.match(open, /body: \[/);
  assert.match(open, /\]\.join\('\\n'\)/);
  assert.match(open, /createWorkflowDispatch/);
  assert.match(open, /workflow_id: 'model-pr-evals\.yml'/);
  assert.match(open, /force: 'false'/);
});

test('duplicate model PR measurements are single-flight', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(
    workflow,
    /group: model-pr-evals-\$\{\{ github\.event\.pull_request\.number \|\| inputs\.prNumber \|\| 'manual-queue' \}\}/,
  );
  assert.match(workflow, /cancel-in-progress: false/);
});

test('model notifications use short-lived OIDC and one durable Slack thread', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const redispatch = job(workflow, 'redispatch');
  const notify = job(workflow, 'notify');
  const report = job(workflow, 'report');

  assert.match(redispatch, /github\.event_name != 'workflow_dispatch'/);
  assert.match(redispatch, /actions: write/);
  assert.doesNotMatch(redispatch, /id-token: write/);
  assert.match(redispatch, /force: 'false'/);
  assert.match(notify, /github\.event_name == 'workflow_dispatch'/);
  assert.match(notify, /id-token: write/);
  assert.match(notify, /core\.getIDToken\('https:\/\/github\.com\/vercel'\)/);
  assert.match(notify, /checks\.listForRef/);
  assert.match(notify, /confirmedPrefix = 'eve-slack-session:';/);
  assert.match(notify, /threadPrefix = 'eve-slack-thread:';/);
  assert.match(notify, /legacyThreadLink = '\[one Slack thread\]\(https:\/\/vercel\.slack\.com\/archives\/'/);
  assert.doesNotMatch(notify, /run\.details_url\?\.startsWith/);
  assert.match(notify, /checks\.create/);
  assert.match(notify, /Eve did not confirm Slack thread delivery/);
  assert.match(notify, /details_url: result\.threadUrl/);
  assert.match(report, /id-token: write/);
  assert.match(report, /actions: read/);
  assert.match(report, /sessionId: process\.env\.SESSION_ID/);
  assert.match(report, /threadTs: process\.env\.THREAD_TS/);
  assert.match(report, /actions\.listJobsForWorkflowRun/);
  assert.match(report, /failure/);
  assert.match(report, /checks\.update/);
  assert.doesNotMatch(workflow, /SLACK_BOT_TOKEN/);
});

test('a rerun reuses the Slack parent saved by the outcome step', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const script = (name: string) => job(workflow, name).split('          script: |\n')[1]
    .split('\n').map((line) => line.slice(12)).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const outputs: Record<string, string> = {};
  let check: Record<string, unknown> | undefined;
  let notifications = 0;
  const threadTs = '1793203626.792579';
  const threadUrl = 'https://vercel.slack.com/archives/C0C7VCBP4CA/p1793203626792579';
  const env = {
    RELEASE_AGENT_URL: 'https://agent.example.test',
    PR_NUMBER: '161', HEAD_SHA: 'a'.repeat(40), PAIRS_JSON: '[]',
    SESSION_ID: 'wrun_test', THREAD_TS: threadTs, CHECK_RUN_ID: '42',
    EXPORT_RESULT: 'success', UPDATE_RESULT: 'success',
  };
  const core = {
    getIDToken: async () => 'test-oidc', setSecret() {},
    setOutput: (name: string, value: string) => { outputs[name] = value; },
  };
  const github = { paginate: async () => [check], rest: { checks: {
    update: async (value: Record<string, unknown>) => { check = { ...value, id: 42 }; },
    listForRef: async () => ({ data: { check_runs: [check] } }),
  } } };
  const context = { repo: { owner: 'vercel', repo: 'next-evals-oss' }, serverUrl: 'https://github.com', runId: 123 };
  const fetch = async (_url: string, init: RequestInit) => {
    notifications++;
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.threadTs, threadTs);
    assert.equal(payload.event, 'run_succeeded');
    return Response.json({ accepted: true, threadTs, threadUrl });
  };
  await new AsyncFunction('github', 'core', 'context', 'fetch', 'process', script('report'))(
    github, core, context, fetch, { env },
  );
  assert.equal(check?.external_id, `eve-slack-thread:${threadTs}:wrun_test`);
  await new AsyncFunction('github', 'core', 'context', 'fetch', 'process', script('notify'))(
    github, core, context, fetch, { env },
  );
  assert.equal(notifications, 1);
  assert.equal(outputs['thread-ts'], threadTs);
  assert.equal(outputs['session-id'], 'wrun_test');
  assert.equal(outputs['check-run-id'], '42');
});

test('long-running model evals load the Sandbox refresh hook', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(job(workflow, 'evaluate'), /NODE_OPTIONS: --import=\$\{\{ github\.workspace \}\}\/scripts\/ci-sandbox-auth\.mjs/);
});

test('model failure notifications are classified without raw logs', async () => {
  const notification = await readFile(notificationPath, 'utf8');
  assert.match(notification, /event: z\.literal\("run_failed"\)/);
  assert.match(notification, /stage: z\.string\(\)\.min\(1\)\.max\(80\)/);
  assert.match(notification, /summary: z\.string\(\)\.min\(1\)\.max\(240\)/);
  assert.match(notification, /export function modelPrOutcomeText/);
  assert.doesNotMatch(notification, /Reply concisely in this existing Slack thread/);
});

test('credentialed model jobs run main code plus only the new experiment files', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const evaluate = job(workflow, 'evaluate');
  assert.match(evaluate, /id-token: write/);
  assert.match(evaluate, /ref: refs\/heads\/main/);
  assert.doesNotMatch(evaluate, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(evaluate, /sparse-checkout: experiments/);
  assert.match(evaluate, /rm -rf registration-pr/);
  assert.doesNotMatch(evaluate, /head-ref/);
  assert.match(evaluate, /assert-no-secrets\.mjs/);
});

test('live model access is checked before the expensive matrix', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const evaluate = job(workflow, 'evaluate');
  const probe = evaluate.indexOf('probe-model-access');
  const matrix = evaluate.indexOf('Run the complete pass@4 matrices');
  assert.ok(probe >= 0, 'missing live model access probe');
  assert.ok(matrix > probe, 'model access must be checked before the matrix');
});

test('pull request code runs only without credentials or write access', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const exportJob = job(workflow, 'export');
  assert.match(exportJob, /ref: \$\{\{ needs\.prepare\.outputs\.head-sha \}\}/);
  assert.match(exportJob, /contents: read/);
  assert.doesNotMatch(exportJob, /id-token: write/);
  assert.doesNotMatch(exportJob, /contents: write/);
  assert.doesNotMatch(exportJob, /ci-auth\.mjs/);
});

test('only the credential-free update job can write results', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const [beforeUpdate] = workflow.split('\n  update:\n');
  const update = job(workflow, 'update');
  assert.ok(beforeUpdate);
  assert.doesNotMatch(beforeUpdate, /contents: write/);
  assert.match(update, /contents: write/);
  assert.doesNotMatch(update, /id-token: write/);
  assert.doesNotMatch(update, /ci-auth\.mjs/);
  assert.match(update, /assert-no-secrets\.mjs/);
  // The write job never installs or runs anything from the pull request.
  assert.doesNotMatch(update, /pnpm/);
  assert.match(update, /rev-parse HEAD/);
});


test('a retry recovers the original parent behind newer failed and duplicate checks', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const script = job(workflow, 'notify').split('          script: |\n')[1]
    .split('\n').map((line) => line.slice(12)).join('\n');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const outputs: Record<string, string> = {};
  const listForRef = () => {};
  const github = {
    rest: { checks: { listForRef } },
    paginate: async (method: unknown, options: Record<string, unknown>) => {
      assert.equal(method, listForRef);
      assert.equal(options.filter, 'all');
      assert.equal(options.ref, 'a'.repeat(40));
      assert.equal(options.check_name, 'Model eval Slack thread');
      return [
        { id: 4, external_id: 'eve-slack-thread:1793374731.463709:wrun_duplicate' },
        { id: 3, external_id: 'eve-session:wrun_failed', output: { summary: 'The workflow failed. The existing Slack thread links to this run.' } },
        { id: 2, external_id: 'eve-session:wrun_original', output: { summary: 'Operational updates are kept in [one Slack thread](https://vercel.slack.com/archives/C0C7VCBP4CA/p1793203664141409).' } },
        // Session creation without confirmed Slack delivery is not a parent.
        { id: 1, external_id: 'eve-session:wrun_unconfirmed', output: { summary: 'Session created.' } },
      ];
    },
  };
  await new AsyncFunction('github', 'core', 'context', 'fetch', 'process', script)(
    github,
    { setOutput: (name: string, value: string) => { outputs[name] = value; } },
    { repo: { owner: 'vercel', repo: 'next-evals-oss' } },
    () => { throw new Error('Must not create another Slack parent'); },
    { env: { HEAD_SHA: 'a'.repeat(40) } },
  );
  assert.deepEqual(outputs, {
    'check-run-id': '2', 'session-id': 'wrun_original', 'thread-ts': '1793203664.141409',
  });
});


test('Slack input is ignored while automated report rendering remains enabled', async () => {
  const source = await readFile(new URL('../apps/release-agent/agent/channels/slack.ts', import.meta.url), 'utf8');
  for (const name of ['onAppMention', 'onDirectMessage', 'onMessage']) {
    const body = source.split(`  ${name}() {\n`)[1].split('\n  },')[0];
    const handler = new Function(body);
    assert.equal(handler(), null, name);
  }
  assert.match(source, /renderers: \[modelEvalThread, releaseEvalThread\]/);
});
