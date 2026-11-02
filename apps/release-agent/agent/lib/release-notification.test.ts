import assert from "node:assert/strict";
import test from "node:test";
import { releaseNotificationSchema } from "./release-notification";

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
