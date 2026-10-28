import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/model-pr-evals.yml',
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
    /github\.event\.pull_request\.user\.login == 'roboeve\[bot\]'[\s\S]*startsWith\(github\.event\.pull_request\.head\.ref, 'v\/register-'\)/,
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
  assert.match(notify, /checks\.create/);
  assert.match(report, /id-token: write/);
  assert.match(report, /actions: read/);
  assert.match(report, /sessionId: process\.env\.SESSION_ID/);
  assert.match(report, /actions\.listJobsForWorkflowRun/);
  assert.match(report, /failure/);
  assert.match(report, /checks\.update/);
  assert.doesNotMatch(workflow, /SLACK_BOT_TOKEN/);
});

test('model failure notifications are classified without raw logs', async () => {
  const notification = await readFile(notificationPath, 'utf8');
  assert.match(notification, /event: z\.literal\("run_failed"\)/);
  assert.match(notification, /stage: z\.string\(\)\.min\(1\)\.max\(80\)/);
  assert.match(notification, /summary: z\.string\(\)\.min\(1\)\.max\(240\)/);
  assert.match(notification, /without adding speculation/);
  assert.match(notification, /Do not quote raw logs/);
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
