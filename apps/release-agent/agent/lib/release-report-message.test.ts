import assert from "node:assert/strict";
import { test } from "node:test";

import {
  releaseEvalThreadSeparator,
  splitReleaseEvalSlackReport,
} from "./release-report-message";

test("splits a release report into one root and three replies", () => {
  const message = ["root", "tasks", "agents", "verification"].join(
    `\n\n${releaseEvalThreadSeparator}\n\n`,
  );

  assert.deepEqual(splitReleaseEvalSlackReport(message), {
    root: "root",
    replies: ["tasks", "agents", "verification"],
  });
});

test("leaves ordinary and malformed replies to the default renderer", () => {
  assert.equal(splitReleaseEvalSlackReport("ordinary reply"), null);
  assert.equal(
    splitReleaseEvalSlackReport(
      ["root", "tasks", "agents"].join(releaseEvalThreadSeparator),
    ),
    null,
  );
});
