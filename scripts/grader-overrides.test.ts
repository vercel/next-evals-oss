import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pinnedGraderOverrides } from './grader-overrides.js';

const suiteRef = 'a'.repeat(40);
const ref = 'b'.repeat(40);

test('imports exact reviewed companion files while retaining legacy grader pins', () => {
  const policy = {
    suiteRef,
    graders: {
      'agent-043-view-transitions': {
        ref,
        files: ['EVAL.ts', 'PROMPT.md', 'tsconfig.json'],
      },
      'agent-049-prefetch-stage': ref,
    },
  };
  assert.deepEqual(pinnedGraderOverrides(policy, suiteRef), [
    {
      evalName: 'agent-043-view-transitions',
      ref,
      files: ['EVAL.ts', 'PROMPT.md', 'tsconfig.json'],
    },
    { evalName: 'agent-049-prefetch-stage', ref, files: ['EVAL.ts'] },
  ]);
  assert.deepEqual(pinnedGraderOverrides(policy, 'c'.repeat(40)), []);
});

test('rejects app replacement, path traversal, missing graders and unpinned refs', () => {
  for (const override of [
    { ref, files: ['EVAL.ts', 'app/page.tsx'] },
    { ref, files: ['EVAL.ts', '../PROMPT.md'] },
    { ref, files: ['PROMPT.md'] },
    { ref, files: ['EVAL.ts', 'EVAL.ts'] },
    { ref: 'canary', files: ['EVAL.ts'] },
  ]) {
    assert.throws(
      () =>
        pinnedGraderOverrides(
          {
            suiteRef,
            graders: { 'agent-043-view-transitions': override },
          },
          suiteRef,
        ),
      /Invalid pinned grader override/,
    );
  }
});
