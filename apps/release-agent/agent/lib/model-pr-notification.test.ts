import assert from "node:assert/strict";
import { test } from "node:test";

import {
  modelPrNotificationPrompt,
  modelPrNotificationRoot,
  modelPrThreadReady,
  modelPrOutcomeText,
  modelPrNotificationSchema,
} from "./model-pr-notification";

const approval = {
  event: "approval_required" as const,
  headSha: "0123456789abcdef0123456789abcdef01234567",
  pairs: [
    {
      base: "kimi-k3.1-pro",
      experiments: ["kimi-k3.1-pro", "kimi-k3.1-pro--agents-md"] as [
        string,
        string,
      ],
    },
  ],
  prNumber: 159,
  prUrl: "https://github.com/vercel/next-evals-oss/pull/159",
  workflowUrl:
    "https://github.com/vercel/next-evals-oss/actions/runs/40717964503",
};

test("builds the model approval thread root before starting Eve", () => {
  assert.equal(
    modelPrNotificationRoot(approval),
    "<https://github.com/vercel/next-evals-oss/pull/159|Model registration PR #159> needs two maintainers to approve `0123456` before credentialed evals can run. Models: `kimi-k3.1-pro`.",
  );
});

test("suppresses the bootstrap turn after the thread root is posted", () => {
  assert.match(
    modelPrNotificationPrompt(approval),
    new RegExp(modelPrThreadReady),
  );
});

const completed = {
  ...approval,
  event: "run_succeeded" as const,
  sessionId: "wrun_test",
  results: [
    {
      experiment: "kimi-k3.1-pro",
      model: "Kimi K3.1 Pro",
      tier: 2 as const,
      total: 31,
      basePassed: 28,
      agentsMdPassed: 27,
      newlyPassed: [],
      newlyFailed: ["agent-026-no-serial-await"],
      failedBoth: [
        "agent-044-uses-nextjs",
        "agent-049-prefetch-stage",
        "agent-051-prefetch-until-navigation",
      ],
    },
  ],
};

test("completion replies contain exact scores, condition differences, and review action", () => {
  const text = modelPrOutcomeText(
    modelPrNotificationSchema.parse(completed) as typeof completed,
  );
  assert.match(text, /Base:\* 28\/31 · 90.3%/);
  assert.match(text, /AGENTS.md:\* 27\/31 · 87.1%/);
  assert.match(text, /Passed only in Base: `026-no-serial-await`/);
  assert.match(
    text,
    /Failed in both: `044-uses-nextjs`, `049-prefetch-stage`, `051-prefetch-until-navigation`/,
  );
  assert.match(text, /Public-board tier: 2. Confirm this during review/);
  assert.match(text, /pull\/159\|PR #159/);
  assert.match(text, /Review the failed attempts and graders, then merge/);
  assert.match(text, /<https:\/\/nextjs.org\/evals\|nextjs.org\/evals>/);
  assert.match(text, /not release regressions/);
});

test("does not silently show a result from another model", () => {
  assert.throws(
    () =>
      modelPrOutcomeText({
        ...completed,
        results: [{ ...completed.results[0], experiment: "different-model" }],
      }),
    /does not match/,
  );
  assert.equal(
    modelPrNotificationSchema.safeParse({
      ...completed,
      results: [{ ...completed.results[0], total: 10 }],
    }).success,
    false,
  );
});

test("keeps older completion payloads usable and escapes Slack control text", () => {
  assert.match(
    modelPrOutcomeText({ ...completed, results: undefined }),
    /Scores are unavailable/,
  );
  const text = modelPrOutcomeText({
    ...completed,
    results: [{ ...completed.results[0], model: "<!channel> Fake *heading*" }],
  });
  assert.doesNotMatch(text, /<!channel>/);
  assert.match(text, /&lt;!channel&gt;/);
});
