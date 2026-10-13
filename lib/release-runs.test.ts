import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { releaseEvalRuns } from './release-runs.js';

afterEach(() => {
  delete process.env.NEXT_RELEASE_EVAL_RUNS;
});

test('normal experiments keep their configured run count', () => {
  assert.equal(releaseEvalRuns(), 4);
  assert.equal(releaseEvalRuns(2), 2);
});

test('release automation can require one scored attempt', () => {
  process.env.NEXT_RELEASE_EVAL_RUNS = '1';
  assert.equal(releaseEvalRuns(), 1);
});

test('release automation rejects unsupported run-count overrides', () => {
  process.env.NEXT_RELEASE_EVAL_RUNS = '4';
  assert.throws(() => releaseEvalRuns(), /must be 1/);
});
