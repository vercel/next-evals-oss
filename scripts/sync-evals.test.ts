import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';

import { copyEvalFixtures } from './sync-evals.js';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'sync-evals-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const source = join(root, 'upstream');
  const destination = join(root, 'evals');
  for (const name of [
    'regression-task',
    'competency-task',
    'unpublished-task',
    'skill-task',
  ]) {
    mkdirSync(join(source, 'evals/evals', name, 'app'), { recursive: true });
    writeFileSync(
      join(source, 'evals/evals', name, 'EVAL.ts'),
      `grader: ${name}`,
    );
    writeFileSync(
      join(source, 'evals/evals', name, 'app/page.tsx'),
      `app: ${name}`,
    );
  }
  writeFileSync(
    join(source, 'evals/eval.config.json'),
    JSON.stringify({
      'unpublished-task': { publish: false },
      'skill-task': { skills: ['test-skill'] },
    }),
  );
  const manifest = join(source, 'evals/eval.suites.json');
  writeFileSync(
    manifest,
    JSON.stringify({
      regression: ['regression-task'],
      competency: ['competency-task'],
    }),
  );
  mkdirSync(destination);
  writeFileSync(join(destination, 'previous'), 'existing fixtures');
  return { source, destination, manifest };
}

test('a selected suite copies complete fixtures and excludes every other task', (t) => {
  const { source, destination } = fixture(t);
  assert.deepEqual(copyEvalFixtures(source, destination, 'regression'), [
    'regression-task',
  ]);
  assert.deepEqual(readdirSync(destination), ['regression-task']);
  assert.equal(
    readFileSync(join(destination, 'regression-task/EVAL.ts'), 'utf8'),
    'grader: regression-task',
  );
  assert.equal(
    readFileSync(join(destination, 'regression-task/app/page.tsx'), 'utf8'),
    'app: regression-task',
  );
});

test('normal sync retains the public suite without requiring classifications', (t) => {
  const { source, destination, manifest } = fixture(t);
  rmSync(manifest);
  assert.deepEqual(copyEvalFixtures(source, destination).sort(), [
    'competency-task',
    'regression-task',
  ]);
  assert.deepEqual(readdirSync(destination).sort(), [
    'competency-task',
    'regression-task',
  ]);
});

test('an invalid or missing selection fails before replacing existing fixtures', (t) => {
  const { source, destination, manifest } = fixture(t);
  for (const regression of [
    undefined,
    [],
    ['regression-task', 'regression-task'],
    ['missing'],
    ['unpublished-task'],
    ['skill-task'],
    [42],
    ['../outside'],
  ]) {
    writeFileSync(manifest, JSON.stringify({ regression }));
    assert.throws(
      () => copyEvalFixtures(source, destination, 'regression'),
      /Suite regression/,
    );
    assert.equal(
      readFileSync(join(destination, 'previous'), 'utf8'),
      'existing fixtures',
    );
  }
  rmSync(manifest);
  assert.throws(
    () => copyEvalFixtures(source, destination, 'regression'),
    /ENOENT/,
  );
  assert.equal(
    readFileSync(join(destination, 'previous'), 'utf8'),
    'existing fixtures',
  );
});
