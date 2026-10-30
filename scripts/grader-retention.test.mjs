import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fixtureDigest, retainsGraderResult } from './grader-retention.mjs';

test('grader-only retention expires for changed tasks, scores, and newer runs', () => {
  const root = mkdtempSync(join(tmpdir(), 'grader-retention-'));
  try {
    mkdirSync(join(root, 'evals/task/app'), { recursive: true });
    writeFileSync(join(root, 'evals/task/EVAL.ts'), 'reviewed grader');
    writeFileSync(join(root, 'evals/task/app/page.tsx'), 'original app');
    const path = 'results/model/2026-10-30/task/summary.json';
    mkdirSync(join(root, 'results/model/2026-10-30/task'), { recursive: true });
    writeFileSync(join(root, path), '{"passedRuns":1}');
    const policy = {
      task: {
        fixtureDigest: fixtureDigest(join(root, 'evals/task')),
        summaries: {
          [path]: createHash('sha256')
            .update(readFileSync(join(root, path)))
            .digest('hex'),
        },
      },
    };
    const retained = () => retainsGraderResult(root, 'model', 'task', policy);
    assert.equal(retained(), true);
    assert.equal(retainsGraderResult(root, 'model', 'new-task', policy), false);
    writeFileSync(join(root, 'evals/task/EVAL.ts'), 'another grader');
    assert.equal(retained(), false);
    writeFileSync(join(root, 'evals/task/EVAL.ts'), 'reviewed grader');
    writeFileSync(join(root, 'evals/task/app/page.tsx'), 'changed app');
    assert.equal(retained(), false);
    writeFileSync(join(root, 'evals/task/app/page.tsx'), 'original app');
    writeFileSync(join(root, path), '{"passedRuns":2}');
    assert.equal(retained(), false);
    writeFileSync(join(root, path), '{"passedRuns":1}');
    mkdirSync(join(root, 'results/model/2026-10-31/task'), { recursive: true });
    writeFileSync(
      join(root, 'results/model/2026-10-31/task/summary.json'),
      '{"passedRuns":1}',
    );
    assert.equal(retained(), false);
    writeFileSync(
      join(root, 'results/model/2026-10-31/task/summary.json'),
      '{"valid":false}',
    );
    assert.equal(retained(), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
