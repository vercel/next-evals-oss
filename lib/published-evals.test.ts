import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { nonPublicEvalNames } from './published-evals.js';

const policy = JSON.parse(
  readFileSync(
    new URL('../eval-publication-overrides.json', import.meta.url),
    'utf8',
  ),
);

test('the pinned public cohort excludes tasks unpublished by the audit', () => {
  // The old source revision has none of these publication flags.
  const config = Object.fromEntries(
    [
      'agent-026-no-serial-await',
      'agent-030-app-router-migration-hard',
      'agent-044-uses-nextjs',
      'agent-048-prefetch-url-data',
    ].map((name) => [name, {}]),
  );
  const excluded = nonPublicEvalNames(config, policy, policy.suiteRef);
  assert.deepEqual(excluded.sort(), [
    'agent-026-no-serial-await',
    'agent-030-app-router-migration-hard',
    'agent-044-uses-nextjs',
  ]);
  assert.deepEqual(
    Object.keys(config).filter((name) => !excluded.includes(name)),
    ['agent-048-prefetch-url-data'],
  );
});

test('other suite revisions keep their own publication and skill decisions', () => {
  assert.deepEqual(
    nonPublicEvalNames(
      {
        public: {},
        hidden: { publish: false },
        skill: { skills: ['next-dev-loop'] },
        'agent-026-no-serial-await': {},
      },
      policy,
      'another-reviewed-revision',
    ),
    ['hidden', 'skill'],
  );
});
