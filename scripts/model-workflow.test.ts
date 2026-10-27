import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/model-pr-evals.yml',
  import.meta.url,
);

function job(workflow: string, name: string) {
  const [, rest] = workflow.split(`\n  ${name}:\n`);
  assert.ok(rest, `missing ${name} job`);
  return rest.split(/\n  [a-z]+:\n/)[0];
}

test('model registration automation is restricted to merged main', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.match(
    workflow,
    /github\.repository == 'vercel\/next-evals-oss' && github\.ref == 'refs\/heads\/main'/,
  );
  assert.match(workflow, /roboeve\[bot\]/);
  assert.match(workflow, /v\/register-/);
  // Credentials are granted only for a head SHA a maintainer approved.
  assert.match(workflow, /pulls\.listReviews/);
  assert.match(workflow, /getCollaboratorPermissionLevel/);
  assert.match(workflow, /review\.commit_id !== pull\.head\.sha/);
  assert.match(workflow, /latestReviewByUser/);
  assert.match(workflow, /review\.id > previous\.id/);
  assert.match(workflow, /review\.state !== 'APPROVED'/);
  assert.match(workflow, /measuredByAutomation/);
  assert.match(workflow, /Record model evaluation results/);
  assert.match(workflow, /Model eval Slack thread/);
  assert.match(workflow, /approval_required/);
  assert.match(workflow, /run_succeeded/);
  assert.match(workflow, /run_failed/);
  assert.match(workflow, /eve-session:/);
  assert.match(workflow, /needs\.notify\.outputs\.session-id/);
  assert.doesNotMatch(workflow, /Install Vercel CLI/);
});

test('model notifications use short-lived OIDC and one durable Slack thread', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const notify = job(workflow, 'notify');
  const report = job(workflow, 'report');

  assert.match(notify, /id-token: write/);
  assert.match(notify, /core\.getIDToken\('https:\/\/github\.com\/vercel'\)/);
  assert.match(notify, /checks\.listForRef/);
  assert.match(notify, /checks\.create/);
  assert.match(report, /id-token: write/);
  assert.match(report, /sessionId: process\.env\.SESSION_ID/);
  assert.match(report, /checks\.update/);
  assert.doesNotMatch(workflow, /SLACK_BOT_TOKEN/);
});

test('credentialed model jobs run main code plus only the new experiment files', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const evaluate = job(workflow, 'evaluate');
  assert.match(evaluate, /id-token: write/);
  assert.match(evaluate, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(evaluate, /sparse-checkout: experiments/);
  assert.match(evaluate, /rm -rf registration-pr/);
  assert.doesNotMatch(evaluate, /head-ref/);
  assert.match(evaluate, /assert-no-secrets\.mjs/);
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
