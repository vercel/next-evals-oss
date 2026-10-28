import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/release-evals.yml',
  import.meta.url,
);
const notificationSchemaPath = new URL(
  '../apps/release-agent/agent/lib/release-notification.ts',
  import.meta.url,
);

test('release automation is standalone and restricted to merged main', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "43 7 \* \* \*"/);
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch' && 'manual' \|\| 'stable'/,
  );
  assert.match(
    workflow,
    /github\.ref == 'refs\/heads\/main'/,
  );
  assert.doesNotMatch(workflow, /workflow_call:/);
  assert.doesNotMatch(workflow, /create-github-app-token/);
  assert.doesNotMatch(workflow, /RELEASE_GITHUB_APP_PRIVATE_KEY/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /pnpm\/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6\.1\.0/);
});

test('repository write access starts only after sanitization', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const [beforePublish, publish] = workflow.split('\n  publish:\n');
  assert.ok(beforePublish);
  assert.ok(publish);
  assert.doesNotMatch(beforePublish, /contents: write/);
  assert.match(beforePublish, /release-durable-measurement/);
  assert.match(publish, /contents: write/);
  assert.match(publish, /pull-requests: write/);
  assert.match(publish, /assert-no-secrets\.mjs/);
});

test('result archive validation consumes the complete tar listing', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /tar -tzf .* \| sed -n '1p'/);
  assert.doesNotMatch(workflow, /tar -tzf .* \| head/);
});

test('the release agent accepts standalone workflow URLs', async () => {
  const schema = await readFile(notificationSchemaPath, 'utf8');
  assert.match(
    schema,
    /github\\\.com\\\/vercel\\\/next-evals-oss\\\/actions\\\/runs/,
  );
  assert.doesNotMatch(
    schema,
    /workflowUrl:[\s\S]*github\\\.com\\\/vercel\\\/next\\\.js\\\/actions\\\/runs/,
  );
});

test('release jobs use short-lived scoped credentials without a stored token', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const intake = await readFile(
    new URL(
      '../apps/release-agent/agent/channels/release-intake.ts',
      import.meta.url,
    ),
    'utf8',
  );

  assert.doesNotMatch(workflow, /Install Vercel CLI/);
  assert.match(workflow, /RELEASE_WORKFLOW_OIDC_TOKEN/);
  assert.doesNotMatch(workflow, /\$VERCEL_OIDC_TOKEN/);
  assert.match(intake, /https:\/\/token\.actions\.githubusercontent\.com/);
  assert.match(intake, /repo:vercel\/next-evals-oss:ref:refs\/heads\/main/);
});
