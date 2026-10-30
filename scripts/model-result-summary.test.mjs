import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeModelResults } from './model-result-summary.mjs';

const pairs = [{ base: 'test-model' }];
function dataset() {
  return {
    metadata: {
      experiments: [
        {
          name: 'test-model',
          modelName: 'Test Model',
          tier: 2,
          docsImpact: {
            baseSuccessRate: 50,
            docsSuccessRate: 50,
            newlyPassed: ['docs-only'],
            newlyFailed: ['base-only'],
          },
        },
      ],
    },
    results: {
      'test-model': [
        { evalPath: 'both-pass', result: { success: true } },
        { evalPath: 'docs-only', result: { success: true } },
        { evalPath: 'base-only', result: { success: false } },
        { evalPath: 'both-fail', result: { success: false } },
      ],
    },
  };
}

test('recovers exact Base and AGENTS.md counts and keeps the chosen tier', () => {
  assert.deepEqual(summarizeModelResults(dataset(), pairs), [
    {
      experiment: 'test-model',
      model: 'Test Model',
      tier: 2,
      total: 4,
      basePassed: 2,
      agentsMdPassed: 2,
      newlyPassed: ['docs-only'],
      newlyFailed: ['base-only'],
      failedBoth: ['both-fail'],
    },
  ]);
});

test('does not derive counts from the rounded public percentages', () => {
  const data = dataset();
  data.results['test-model'] = Array.from({ length: 301 }, (_, i) => ({
    evalPath: `task-${i}`,
    result: { success: i < 299 },
  }));
  data.metadata.experiments[0].docsImpact = {
    baseSuccessRate: 99,
    docsSuccessRate: 99,
    newlyPassed: ['task-0'],
    newlyFailed: [],
  };
  const [result] = summarizeModelResults(data, pairs);
  assert.equal(result.basePassed, 298);
  assert.equal(result.agentsMdPassed, 299);
});

test('rejects partial exports, missing pairs, and inconsistent task comparisons', () => {
  for (const corrupt of [
    (d) => {
      d.results['test-model'][0].notAvailable = true;
    },
    (d) => {
      delete d.metadata.experiments[0].docsImpact;
    },
    (d) => {
      d.metadata.experiments[0].docsImpact.newlyPassed = ['missing'];
    },
    (d) => {
      d.metadata.experiments[0].docsImpact.newlyPassed = ['both-fail'];
    },
    (d) => {
      d.metadata.experiments[0].docsImpact.newlyFailed = ['docs-only'];
    },
    (d) => {
      d.metadata.experiments[0].docsImpact.baseSuccessRate = 100;
    },
    (d) => {
      d.results['test-model'].push(d.results['test-model'][0]);
    },
  ]) {
    const data = dataset();
    corrupt(data);
    assert.throws(() => summarizeModelResults(data, pairs));
  }
  assert.throws(() => summarizeModelResults(dataset(), [{ base: 'missing' }]));
});

test('summarizes every requested model and excludes unrelated models', () => {
  const data = dataset();
  data.metadata.experiments.push({
    ...data.metadata.experiments[0],
    name: 'second',
    tier: 1,
  });
  data.results.second = data.results['test-model'];
  assert.deepEqual(
    summarizeModelResults(data, [{ base: 'second' }, ...pairs]).map(
      ({ experiment, tier }) => [experiment, tier],
    ),
    [
      ['second', 1],
      ['test-model', 2],
    ],
  );
  assert.equal(summarizeModelResults(data, pairs).length, 1);
});
