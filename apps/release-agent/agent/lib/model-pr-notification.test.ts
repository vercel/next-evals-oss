import assert from "node:assert/strict";
import { test } from "node:test";

import {
  modelPrNotificationPrompt,
  modelPrNotificationRoot,
  modelPrThreadReady,
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
  assert.match(modelPrNotificationPrompt(approval), new RegExp(modelPrThreadReady));
});
