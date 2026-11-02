import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { comparisonKey, loadReleaseComparison } from './release-comparison.js';
import { buildReleaseReport } from './release-automation.js';
import type { ExportedReleaseData } from './release-automation.js';

function measurement(version = '16.4.2', passed = true): ExportedReleaseData {
  return {
    metadata: {
      evaluationTarget: {
        kind: 'backport',
        version,
        ref: `v${version}`,
        sha: 'a'.repeat(40),
        sourceRunUrl: 'https://github.com/vercel/next.js/actions/runs/1',
        evaluatedAt: '2026-11-01T00:00:00.000Z',
        suite: 'published',
        suiteRef: 'b'.repeat(40),
        comparisonKey: 'c'.repeat(64),
      },
      measurement: {
        metric: 'pass@1',
        scoredAttempts: 1,
        infrastructureFailuresExcluded: true,
      },
      experiments: [
        {
          name: 'sol',
          modelName: 'Sol',
          agentHarness: 'Codex',
          docsImpact: { newlyPassed: [], newlyFailed: [] },
        },
      ],
    },
    results: { sol: [{ evalPath: 'task', result: { success: passed } }] },
  };
}

const diagnostics = {
  metric: 'pass@1',
  confirmationAttemptsPerFailure: 2,
  experiments: [],
};

test('first reviewed run becomes usable; both condition changes reach the Slack payload', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-baselines-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const current = measurement('16.4.4', false);
  current.metadata.evaluationTarget!.evaluatedAt = '2026-11-02T00:00:00.000Z';
  const report = buildReleaseReport(current, diagnostics);
  assert.equal(
    (await loadReleaseComparison(root, current, report)).available,
    false,
  );
  const dir = join(root, '16.4.2/123');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'measurement.json'), JSON.stringify(measurement()));
  report.comparison = await loadReleaseComparison(root, current, report);
  assert.equal(report.comparison.available, true);
  if (!report.comparison.available) return;
  assert.equal(report.comparison.regressions.length, 2);
  assert.deepEqual(
    report.comparison.regressions.map((c) => c.agentsMd),
    [false, true],
  );
  assert.equal(report.comparison.baseline.version, '16.4.2');
  assert.equal(report.comparison.regressions[0].reproducible, false);
  const confirmed = buildReleaseReport(current, {
    ...diagnostics,
    experiments: [
      {
        experiment: 'sol',
        tasks: [
          {
            evalName: 'task',
            scoredFailureReason: 'AssertionError',
            confirmations: [
              { outcome: 'failed', infrastructureRetries: 0 },
              { outcome: 'failed', infrastructureRetries: 0 },
            ],
          },
        ],
      },
    ],
  });
  const confirmedComparison = await loadReleaseComparison(
    root,
    current,
    confirmed,
  );
  assert.ok(confirmedComparison.available);
  if (confirmedComparison.available) {
    assert.equal(
      confirmedComparison.regressions.find((c) => !c.agentsMd)?.reproducible,
      true,
    );
    assert.equal(
      confirmedComparison.regressions.find((c) => c.agentsMd)?.reproducible,
      false,
    );
  }

  current.metadata.experiments[0].docsImpact!.newlyFailed = ['task'];
  report.comparison = await loadReleaseComparison(
    root,
    current,
    buildReleaseReport(current, diagnostics),
  );
  assert.ok(report.comparison.available);
  if (report.comparison.available)
    assert.deepEqual(
      report.comparison.regressions.map((c) => c.agentsMd),
      [true],
    );
});

test('incompatible, incomplete, same-version, future, and unrelated releases are excluded', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-baselines-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const current = measurement('16.4.4');
  current.metadata.evaluationTarget!.evaluatedAt = '2026-11-02T00:00:00.000Z';
  const report = buildReleaseReport(current, diagnostics);
  const invalid = [
    (d: ExportedReleaseData) => {
      d.metadata.evaluationTarget!.comparisonKey = 'd'.repeat(64);
    },
    (d: ExportedReleaseData) => {
      d.metadata.evaluationTarget!.suiteRef = 'e'.repeat(40);
    },
    (d: ExportedReleaseData) => {
      delete d.metadata.evaluationTarget;
    },
    (d: ExportedReleaseData) => {
      d.metadata.measurement!.metric = 'pass@4';
    },
    (d: ExportedReleaseData) => {
      d.metadata.experiments[0].agentHarness = 'Other';
    },
    (d: ExportedReleaseData) => {
      d.results.sol[0].notAvailable = true;
    },
    (d: ExportedReleaseData) => {
      d.results.sol[0].evalPath = 'different-task';
    },
    (d: ExportedReleaseData) => {
      d.metadata.evaluationTarget!.evaluatedAt = '2026-11-03T00:00:00.000Z';
    },
  ];
  const dir = join(root, '16.4.2/123');
  await mkdir(dir, { recursive: true });
  for (const mutate of invalid) {
    const prior = measurement();
    mutate(prior);
    await writeFile(join(dir, 'measurement.json'), JSON.stringify(prior));
    assert.equal(
      (await loadReleaseComparison(root, current, report)).available,
      false,
    );
  }
  await rm(join(root, '16.4.2'), { recursive: true });
  for (const version of [
    '16.4.4',
    '16.4.5',
    '16.5.0',
    '15.4.2',
    '16.4.3-canary.1',
  ]) {
    const dir = join(root, version, '123');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'measurement.json'),
      JSON.stringify(measurement(version)),
    );
  }
  assert.equal(
    (await loadReleaseComparison(root, current, report)).available,
    false,
  );
});

test('latest earlier compatible version wins and improvements are condition-specific', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-baselines-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const version of ['16.4.2', '16.4.3']) {
    const dir = join(root, version, '123');
    await mkdir(dir, { recursive: true });
    await writeFile(
      join(dir, 'measurement.json'),
      JSON.stringify(measurement(version, false)),
    );
  }
  const current = measurement('16.4.4');
  current.metadata.evaluationTarget!.evaluatedAt = '2026-11-02T00:00:00.000Z';
  current.metadata.experiments[0].docsImpact!.newlyPassed = ['task'];
  const report = buildReleaseReport(current, diagnostics);
  const result = await loadReleaseComparison(root, current, report);
  assert.ok(result.available);
  if (result.available) {
    assert.equal(result.baseline.version, '16.4.3');
    assert.deepEqual(
      result.improvements.map((c) => c.agentsMd),
      [true],
    );
    assert.equal(result.regressions.length, 0);
  }
});

test('execution configuration changes invalidate the comparison key', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-key-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of [
    'eval-suite-ref.txt',
    'eval-grader-overrides.json',
    'scripts/sync-evals.ts',
    'pnpm-lock.yaml',
    'lib/setup.ts',
    'lib/release-runs.ts',
    'experiments/sol.ts',
  ]) {
    const file = join(root, path);
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, 'original');
  }
  const original = await comparisonKey(root, ['sol']);
  await writeFile(join(root, 'experiments/sol.ts'), 'changed timeout or model');
  assert.notEqual(await comparisonKey(root, ['sol']), original);
  await writeFile(join(root, 'experiments/sol.ts'), 'original');
  assert.equal(await comparisonKey(root, ['sol']), original);
});
