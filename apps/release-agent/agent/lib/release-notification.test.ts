import assert from "node:assert/strict";
import test from "node:test";
import { releaseNotificationSchema, releaseSummaryPrompt } from "./release-notification";

test("release notifications accept a compatible baseline and retain condition changes", () => {
  const change = {
    experiment: "sol",
    model: "Sol",
    evalName: "task",
    agentsMd: true,
    reproducible: false,
  };
  const comparison = {
    available: true,
    baseline: {
      version: "16.4.2",
      evaluatedAt: "2026-11-01T00:00:00.000Z",
      measurementUrl:
        "https://github.com/vercel/next-evals-oss/blob/main/measurements/releases/16.4.2/123/measurement.json",
    },
    costs: [{ experiment: "sol", model: "Sol", agentsMd: false,
      beforeUsd: 0.1, afterUsd: 0.12, changePercent: 20,
      totalTasks: 3, matchedTasks: 1, excludedFailedTasks: 1, missingUsageTasks: 1,
      pricing: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1 },
      tasks: [{ evalName: "task", beforeUsd: 0.1, afterUsd: 0.12, changePercent: 20 }],
    }, { experiment: "sol", model: "Sol", agentsMd: true,
      beforeUsd: null, afterUsd: null, changePercent: null,
      totalTasks: 3, matchedTasks: 0, excludedFailedTasks: 1, missingUsageTasks: 2,
      pricing: null, tasks: [],
    }],
    regressions: [change],
    improvements: [],
    note: "Compatible earlier measurement",
  };
  const score = { passed: 0, total: 1, percentage: 0 };
  const notification = {
    schemaVersion: 5,
    target: {
      kind: "backport",
      version: "16.4.3",
      ref: "v16.4.3",
      sha: "a".repeat(40),
      sourceRunUrl: "https://github.com/vercel/next.js/actions/runs/1",
      evaluatedAt: "2026-11-02T00:00:00.000Z",
    },
    workflowUrl: "https://github.com/vercel/next-evals-oss/actions/runs/123",
    measurementUrl: "https://github.com/vercel/next-evals-oss/pull/1",
    metric: "pass@1",
    validation: {
      complete: true,
      infrastructureFailuresExcluded: true,
      modelFailureConfirmationAttempts: 2,
    },
    report: {
      scores: { withoutAgentsMd: score, withAgentsMd: score },
      tasks: [],
      experiments: [],
      failures: [],
      comparison,
    },
  };
  const parsed = releaseNotificationSchema.parse(notification);
  assert.deepEqual(parsed.report.comparison, comparison);
  const prompt = releaseSummaryPrompt(parsed);
  assert.match(prompt, /increases AND decreases/);
  assert.match(prompt, /Zero matched tasks means unavailable/);
  assert.match(prompt, /including increases hidden by an overall decrease/);
  const legacy = structuredClone(notification);
  delete (legacy.report.comparison as { costs?: unknown }).costs;
  assert.equal(releaseNotificationSchema.safeParse(legacy).success, true);
  assert.equal(
    releaseNotificationSchema.safeParse({
      ...notification,
      report: {
        ...notification.report,
        comparison: {
          ...comparison,
          baseline: {
            ...comparison.baseline,
            measurementUrl: "https://example.com/untrusted",
          },
        },
      },
    }).success,
    false,
  );
});
