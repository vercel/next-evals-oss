import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/release-evals.yml',
  import.meta.url,
);

test('release automation is standalone and restricted to merged main', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(
    workflow,
    /github\.ref == 'refs\/heads\/main'/,
  );
  assert.doesNotMatch(workflow, /workflow_call:/);
  assert.doesNotMatch(workflow, /create-github-app-token/);
  assert.doesNotMatch(workflow, /RELEASE_GITHUB_APP_PRIVATE_KEY/);
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
