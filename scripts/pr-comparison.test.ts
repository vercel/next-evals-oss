import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  assertDocsOnly,
  fileHashes,
  summarizeAttempt,
  validatePlan,
  retain,
} from './pr-comparison.js';
import type { ComparisonPlan } from './pr-comparison.js';

const plan: ComparisonPlan = JSON.parse(
  readFileSync(
    new URL('../comparisons/activity-docs.json', import.meta.url),
    'utf8',
  ),
);
const pricing = { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 };

test('only the reviewed task set and immutable revisions can be prepared', () => {
  assert.deepEqual(validatePlan(plan, 'all'), plan.tasks);
  assert.deepEqual(validatePlan(plan, plan.tasks[3]), [plan.tasks[3]]);
  assert.throws(() => validatePlan(plan, '*'));
  assert.throws(() => validatePlan({ ...plan, head: 'canary' }, 'all'));
  assert.throws(() => validatePlan({ ...plan, tasks: ['../../x'] }, 'all'));
  assert.throws(() =>
    validatePlan({ ...plan, tasks: [plan.tasks[0], plan.tasks[0]] }, 'all'),
  );
  assert.throws(() =>
    validatePlan({ ...plan, guides: ['../../secret'] }, 'all'),
  );
});

test('docs packages reject runtime differences and identical treatments', () => {
  const path = 'package/dist/docs/01-app/02-guides/preserving-ui-state.md';
  const before = { [path]: 'old', 'package/dist/server.js': 'same' };
  const after = { ...before, [path]: 'new' };
  assert.deepEqual(assertDocsOnly(before, after, plan.guides), [path]);
  assert.throws(() =>
    assertDocsOnly(
      before,
      { ...after, 'package/dist/server.js': 'different' },
      plan.guides,
    ),
  );
  assert.throws(() =>
    assertDocsOnly(before, { ...after, 'package/new.js': 'new' }, plan.guides),
  );
  assert.throws(() => assertDocsOnly(before, before, plan.guides));
});

test('summaries retain failures, provider tokens, cached pricing and missing evidence', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pr-comparison-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'outputs'));
  writeFileSync(
    join(dir, 'result.json'),
    JSON.stringify({ status: 'passed', duration: 20 }),
  );
  writeFileSync(join(dir, 'outputs/eval.txt'), 'Tests  3 passed (3)');
  writeFileSync(
    join(dir, 'transcript-raw.jsonl'),
    JSON.stringify({
      type: 'turn.completed',
      usage: {
        input_tokens: 1000,
        cached_input_tokens: 800,
        output_tokens: 100,
      },
    }) + '\n',
  );
  const result = summarizeAttempt(dir, pricing);
  assert.equal(result.status, 'passed');
  assert.equal(result.inputTokens, 1000);
  assert.equal(result.costUsd, (200 * 2 + 800 * 0.2 + 100 * 10) / 1e6);
  assert.equal(result.durationSeconds, 20);
  assert.equal(result.checks, 'Tests  3 passed (3)');
  assert.equal(summarizeAttempt(undefined, pricing).status, 'unavailable');
  writeFileSync(
    join(dir, 'result.json'),
    JSON.stringify({ status: 'failed', duration: 20 }),
  );
  assert.equal(summarizeAttempt(dir, pricing).status, 'failed');
  writeFileSync(
    join(dir, 'transcript-raw.jsonl'),
    '{"type":"message","text":"no usage"}\n',
  );
  assert.equal(summarizeAttempt(dir, pricing).costUsd, null);
  writeFileSync(
    join(dir, 'outputs/eval.txt'),
    'Startup Error: failed to load config from vitest',
  );
  assert.equal(summarizeAttempt(dir, pricing).status, 'unavailable');
  const first = fileHashes(dir);
  writeFileSync(join(dir, 'outputs/eval.txt'), 'Tests  3 passed (3)');
  assert.notEqual(
    fileHashes(dir)['outputs/eval.txt'],
    first['outputs/eval.txt'],
  );
});

test('workflow is manual, main-only, bounded, and uploads only scanned evidence', () => {
  const yaml = readFileSync(
    new URL('../.github/workflows/pr-docs-comparison.yml', import.meta.url),
    'utf8',
  );
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(
    yaml,
    /pull_request_target:|schedule:|contents: write|pull-requests: write/,
  );
  assert.match(yaml, /github.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /persist-credentials: false/);
  assert.match(yaml, /steps.retain.outputs.safe == 'true'/);
  assert.match(yaml, /retention-days: 90/);
  assert.match(yaml, /ci-sandbox-auth.mjs/);
  assert.match(yaml, /timeout-minutes: 150/);
  assert.doesNotMatch(yaml, /secrets\./);
  const config = readFileSync(
    new URL('./pr-comparison-experiment.ts', import.meta.url),
    'utf8',
  );
  assert.match(config, /runs: 1/);
  assert.match(config, /timeout: 900/);
  assert.match(config, /Installed guidance mismatch/);
});

test('retained evidence is sanitized and incomplete comparisons cannot look complete', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'pr-evidence-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const task = plan.tasks[3];
  const provenance = { ...plan, tasks: [task], pricing };
  writeFileSync(join(root, 'provenance.json'), JSON.stringify(provenance));
  mkdirSync(join(root, 'evals/evals', task), { recursive: true });
  mkdirSync(join(root, 'evals/lib'), { recursive: true });
  writeFileSync(join(root, 'evals/evals', task, 'PROMPT.md'), 'Public task');
  for (const condition of ['base', 'head'])
    for (const guide of plan.guides) {
      const path = join(
        root,
        `package-${condition}/package/dist/docs`,
        `${guide}.md`,
      );
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, 'Public guide');
    }
  const run = join(root, 'evals/results/base/model/date', task, 'run-1');
  mkdirSync(join(run, 'outputs'), { recursive: true });
  const secret = 'test-only-secret-with-at-least-16-characters';
  const previous = {
    key: process.env.COMPARISON_TEST_API_KEY,
    output: process.env.GITHUB_OUTPUT,
    summary: process.env.GITHUB_STEP_SUMMARY,
  };
  process.env.COMPARISON_TEST_API_KEY = secret;
  process.env.GITHUB_OUTPUT = join(root, 'outputs.txt');
  process.env.GITHUB_STEP_SUMMARY = join(root, 'summary.md');
  try {
    writeFileSync(
      join(run, 'result.json'),
      JSON.stringify({ status: 'passed', duration: 1 }),
    );
    writeFileSync(join(run, 'outputs/eval.txt'), 'Tests  3 passed (3)');
    writeFileSync(
      join(run, 'transcript-raw.jsonl'),
      JSON.stringify({ text: secret }),
    );
    await retain(root);
    const artifact = join(root, 'artifact');
    assert.doesNotMatch(
      readFileSync(
        join(
          artifact,
          'results/base/model/date',
          task,
          'run-1/transcript-raw.jsonl',
        ),
        'utf8',
      ),
      new RegExp(secret),
    );
    const report = JSON.parse(
      readFileSync(join(artifact, 'comparison.json'), 'utf8'),
    );
    assert.deepEqual(
      report.records.map((row: { status: string }) => row.status),
      ['passed', 'unavailable'],
    );
    assert.match(
      readFileSync(join(root, 'outputs.txt'), 'utf8'),
      /safe=true\ncomplete=false/,
    );
    assert.match(readFileSync(join(artifact, 'README.md'), 'utf8'), /90 days/);
  } finally {
    for (const [key, value] of Object.entries({
      COMPARISON_TEST_API_KEY: previous.key,
      GITHUB_OUTPUT: previous.output,
      GITHUB_STEP_SUMMARY: previous.summary,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
