import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/model-pr-evals.yml',
  import.meta.url,
);

test('model registration automation runs from main, not PR code', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.match(workflow, /ref: main/);
  assert.match(workflow, /roboeve\[bot\]/);
  assert.match(workflow, /v\/register-/);
});

test('only the credential-free update job can write results', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const [beforeUpdate, update] = workflow.split('\n  update:\n');
  assert.ok(beforeUpdate);
  assert.ok(update);
  assert.doesNotMatch(beforeUpdate, /contents: write/);
  assert.match(beforeUpdate, /id-token: write/);
  assert.match(beforeUpdate, /assert-no-secrets\.mjs/);
  assert.match(update, /contents: write/);
  assert.doesNotMatch(update, /id-token: write/);
  assert.match(update, /assert-no-secrets\.mjs/);
});
