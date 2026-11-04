import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { comparisonInputs, comparisonKey, loadReleaseComparison } from './release-comparison.js';
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
    'eval-publication-overrides.json',
    'lib/published-evals.ts',
    'scripts/sync-evals.ts',
    'scripts/grader-overrides.ts',
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
  await writeFile(
    join(root, 'scripts/grader-overrides.ts'),
    'changed import policy',
  );
  assert.notEqual(await comparisonKey(root, ['sol']), original);
});

test('release Slack omits unpublished scores and confirmation failures', () => {
  const data = measurement('16.4.4');
  data.results.sol.push({ evalPath: 'unpublished', result: { success: false } });
  const report = buildReleaseReport(data, {
    ...diagnostics,
    experiments: [{ experiment: 'sol', tasks: [{
      evalName: 'unpublished', scoredFailureReason: 'Not used for release checks',
      confirmations: [{ outcome: 'failed', infrastructureRetries: 0 }, { outcome: 'failed', infrastructureRetries: 0 }],
    }] }],
  }, ['unpublished']);
  assert.deepEqual(report.scores.withoutAgentsMd, { passed: 1, total: 1, percentage: 100 });
  assert.deepEqual(report.scores.withAgentsMd, { passed: 1, total: 1, percentage: 100 });
  assert.deepEqual(report.tasks.map(task => task.name), ['task']);
  assert.deepEqual(report.failures, []);
});


test('legacy comparisons omit unpublished regressions and improvements', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-legacy-public-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = measurement('16.4.2', false);
  old.results.sol.push({ evalPath: 'unpublished', result: { success: true } });
  const current = measurement('16.4.4', true);
  current.metadata.evaluationTarget!.evaluatedAt = '2026-11-02T00:00:00.000Z';
  current.results.sol.push({ evalPath: 'unpublished', result: { success: false } });
  const dir = join(root, '16.4.2/123');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'measurement.json'), JSON.stringify(old));
  const report = buildReleaseReport(current, diagnostics, ['unpublished']);
  const comparison = await loadReleaseComparison(root, current, report, ['unpublished']);
  assert.ok(comparison.available);
  if (!comparison.available) return;
  assert.deepEqual(comparison.regressions, []);
  assert.deepEqual(comparison.improvements.map(change => change.evalName), ['task', 'task']);
});

test('publication-only compatibility reuses a larger historical cohort without changing scores', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'release-publication-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = measurement('16.4.2', false);
  old.results.sol.push({ evalPath: 'unpublished', result: { success: true } });
  const current = measurement('16.4.4', true);
  current.metadata.evaluationTarget!.evaluatedAt = '2026-11-02T00:00:00.000Z';
  current.metadata.evaluationTarget!.comparisonKey = 'd'.repeat(64);
  const report = buildReleaseReport(current, diagnostics);
  const dir = join(root, '16.4.2/123');
  await mkdir(dir, { recursive: true });
  const save = () =>
    writeFile(join(dir, 'measurement.json'), JSON.stringify(old));
  await save();
  assert.equal(
    (await loadReleaseComparison(root, current, report, ['unpublished']))
      .available,
    false,
  );

  old.metadata.evaluationTarget!.publicationComparison = {
    originalComparisonKey: 'c'.repeat(64),
    comparisonKey: 'd'.repeat(64),
    excludedEvals: ['unpublished'],
    note: 'Reviewed publication-only exclusion.',
  };
  await save();
  const comparison = await loadReleaseComparison(root, current, report, [
    'unpublished',
  ]);
  assert.ok(comparison.available);
  if (comparison.available) {
    assert.equal(comparison.baseline.version, '16.4.2');
    assert.deepEqual(
      comparison.improvements.map((change) => change.evalName),
      ['task', 'task'],
    );
  }
  assert.equal(old.metadata.evaluationTarget!.comparisonKey, 'c'.repeat(64));
  assert.equal(old.results.sol.length, 2);
  assert.equal(old.results.sol[0].result.success, false);

  for (const mutate of [
    (data: ExportedReleaseData) => {
      data.metadata.evaluationTarget!.publicationComparison!.originalComparisonKey =
        'e'.repeat(64);
    },
    (data: ExportedReleaseData) => {
      data.metadata.evaluationTarget!.publicationComparison!.comparisonKey =
        'e'.repeat(64);
    },
    (data: ExportedReleaseData) => {
      data.metadata.evaluationTarget!.publicationComparison!.excludedEvals = [];
    },
    (data: ExportedReleaseData) => {
      data.metadata.evaluationTarget!.publicationComparison!.excludedEvals = [
        'different',
      ];
    },
    (data: ExportedReleaseData) => {
      data.results.sol[0].evalPath = 'different-published-task';
    },
    (data: ExportedReleaseData) => {
      data.metadata.experiments[0].agentHarness = 'Other';
    },
  ]) {
    const invalid = structuredClone(old);
    mutate(invalid);
    await writeFile(join(dir, 'measurement.json'), JSON.stringify(invalid));
    assert.equal(
      (await loadReleaseComparison(root, current, report, ['unpublished']))
        .available,
      false,
    );
  }
});

test('the retained 16.4.4 run supports its reviewed setup, not changed graders', async () => {
  const repo = fileURLToPath(new URL('..', import.meta.url));
  const baselinePath = join(
    repo,
    'measurements/releases/16.4.4/41470970834/measurement.json',
  );
  const saved = await readFile(baselinePath, 'utf8');
  const baseline: ExportedReleaseData = JSON.parse(saved);
  const current = structuredClone(baseline);
  const policy = JSON.parse(
    await readFile(join(repo, 'eval-publication-overrides.json'), 'utf8'),
  );
  const excluded = Object.keys(policy.evals);
  const target = current.metadata.evaluationTarget!;
  target.version = '16.4.5';
  target.ref = 'v16.4.5';
  target.sha = 'f'.repeat(40);
  target.evaluatedAt = '2026-11-03T00:00:00.000Z';
  const currentKey = await comparisonKey(repo, Object.keys(current.results));
  // Publication-only retention does not authorize a later grader change.
  target.comparisonKey = target.publicationComparison!.comparisonKey;
  delete target.publicationComparison;
  for (const experiment of current.metadata.experiments) {
    current.results[experiment.name] = current.results[experiment.name].filter(
      (row) => !excluded.includes(row.evalPath),
    );
    assert.equal(current.results[experiment.name].length, 28);
  }
  const report = buildReleaseReport(current, diagnostics, excluded);
  const comparison = await loadReleaseComparison(
    join(repo, 'measurements/releases'),
    current,
    report,
    excluded,
  );
  assert.ok(comparison.available);
  if (comparison.available) {
    assert.equal(comparison.baseline.version, '16.4.4');
    assert.deepEqual(comparison.regressions, []);
    assert.deepEqual(comparison.improvements, []);
  }
  const experiment = current.metadata.experiments[0];
  const changed = current.results[experiment.name].find(
    (row) =>
      row.result.success &&
      !experiment.docsImpact!.newlyPassed.includes(row.evalPath) &&
      !experiment.docsImpact!.newlyFailed.includes(row.evalPath),
  )!;
  changed.result.success = false;
  const changedReport = buildReleaseReport(current, diagnostics, excluded);
  const regressed = await loadReleaseComparison(
    join(repo, 'measurements/releases'),
    current,
    changedReport,
    excluded,
  );
  assert.ok(regressed.available);
  if (regressed.available) {
    assert.deepEqual(
      regressed.regressions.map((row) => [row.evalName, row.agentsMd]),
      [
        [changed.evalPath, false],
        [changed.evalPath, true],
      ],
    );
  }
  assert.notEqual(currentKey, target.comparisonKey);
  target.comparisonKey = currentKey;
  delete target.comparisonInputs; // Legacy records still require their reviewed key.
  assert.equal(
    (
      await loadReleaseComparison(
        join(repo, 'measurements/releases'),
        current,
        changedReport,
        excluded,
      )
    ).available,
    false,
  );
  assert.equal(await readFile(baselinePath, 'utf8'), saved);
});

test("grader changes exclude only affected tasks; unrelated changes still compare", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "release-partial-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = measurement();
  old.results.sol.push({ evalPath: "changed", result: { success: true } });
  old.metadata.evaluationTarget!.comparisonInputs = {
    executionKey: "a".repeat(64),
    graders: { changed: "old" },
  };
  const dir = join(root, "16.4.2/123");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "measurement.json"), JSON.stringify(old));
  const current = structuredClone(old);
  Object.assign(current.metadata.evaluationTarget!, {
    version: "16.4.5",
    evaluatedAt: "2026-11-04T00:00:00.000Z",
    comparisonKey: "d".repeat(64),
    comparisonInputs: {
      executionKey: "a".repeat(64),
      graders: { changed: "new" },
    },
  });
  current.results.sol.forEach((row) => (row.result.success = false));
  let comparison = await loadReleaseComparison(
    root,
    current,
    buildReleaseReport(current, diagnostics),
  );
  assert.ok(comparison.available);
  if (comparison.available) {
    assert.deepEqual(comparison.changedEvals, ["changed"]);
    assert.deepEqual(
      comparison.regressions.map((c) => c.evalName),
      ["task", "task"],
    );
  }
  current.metadata.evaluationTarget!.comparisonInputs!.executionKey =
    "b".repeat(64);
  comparison = await loadReleaseComparison(
    root,
    current,
    buildReleaseReport(current, diagnostics),
  );
  assert.equal(
    comparison.available,
    false,
    "runner changes must still invalidate comparison",
  );
});

test("reviewed 16.4.4 baseline remains useful after React and prefetch grader updates", async () => {
  const repo = fileURLToPath(new URL("..", import.meta.url));
  const old: ExportedReleaseData = JSON.parse(
    await readFile(
      join(repo, "measurements/releases/16.4.4/41470970834/measurement.json"),
      "utf8",
    ),
  );
  const current = structuredClone(old);
  const target = current.metadata.evaluationTarget!;
  Object.assign(target, {
    version: "16.4.5",
    evaluatedAt: "2026-11-04T00:00:00.000Z",
    comparisonKey: await comparisonKey(repo, [
      "gpt-6-sol-high",
      "gpt-6-sol-high--agents-md",
    ]),
    comparisonInputs: await comparisonInputs(repo, [
      "gpt-6-sol-high",
      "gpt-6-sol-high--agents-md",
    ]),
  });
  const excluded = [
    "agent-026-no-serial-await",
    "agent-030-app-router-migration-hard",
    "agent-044-uses-nextjs",
  ];
  for (const name of Object.keys(current.results))
    current.results[name] = current.results[name].filter(
      (row) => !excluded.includes(row.evalPath),
    );
  const result = await loadReleaseComparison(
    join(repo, "measurements/releases"),
    current,
    buildReleaseReport(current, diagnostics, excluded),
    excluded,
  );
  assert.ok(result.available);
  if (result.available) {
    assert.deepEqual(result.changedEvals, [
      "agent-043-view-transitions",
      "agent-049-prefetch-stage",
    ]);
    assert.deepEqual(result.regressions, []);
  }
});
