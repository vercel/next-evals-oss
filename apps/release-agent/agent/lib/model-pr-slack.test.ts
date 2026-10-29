import assert from "node:assert/strict";
import test from "node:test";
import {
  modelPrNotificationRoot,
  type ModelPrOutcome,
} from "./model-pr-notification";
import { postModelPrOutcome } from "./model-pr-slack";

const channel = "C0C7VCBP4CA";
const threadTs = "1793203626.792579";
const outcome: ModelPrOutcome = {
  event: "run_failed",
  sessionId: "wrun_test",
  prNumber: 161,
  prUrl: "https://github.com/vercel/next-evals-oss/pull/161",
  headSha: "e1940063c9ab52d78115a5df76c9fca6f9d0dab1",
  workflowUrl: "https://github.com/vercel/next-evals-oss/actions/runs/123",
  pairs: [
    {
      base: "gpt-6.1-terra-high",
      experiments: ["gpt-6.1-terra-high", "gpt-6.1-terra-high--agents-md"],
    },
  ],
  failure: { stage: "evaluation", summary: "The result matrix is incomplete." },
};

test("success and failure post to the saved Slack parent and confirm delivery", async () => {
  for (const event of ["run_failed", "run_succeeded"] as const) {
    const calls: Record<string, unknown>[] = [];
    const result = await postModelPrOutcome(
      { ...outcome, event, threadTs },
      channel,
      async (operation, body) => {
        assert.equal(operation, "chat.postMessage");
        calls.push(body);
        return { ok: true, ts: "1793203999.000001" };
      },
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].channel, channel);
    assert.equal(calls[0].thread_ts, threadTs);
    assert.equal(calls[0].unfurl_links, false);
    assert.match(String(calls[0].text), /PR #161/);
    assert.equal(result.threadTs, threadTs);
    assert.equal(
      result.threadUrl,
      `https://vercel.slack.com/archives/${channel}/p1793203626792579`,
    );
  }
});

test("a rejected Slack reply is a reporting failure, not an accepted Eve session", async () => {
  await assert.rejects(
    postModelPrOutcome({ ...outcome, threadTs }, channel, async () => ({
      ok: false,
      error: "thread_not_found",
    })),
    /Slack rejected.*thread_not_found/,
  );
});

test("recovers older checks from the bot's exact PR/head root, including roots with replies", async () => {
  const root = modelPrNotificationRoot({
    ...outcome,
    event: "approval_required",
  });
  let pages = 0;
  const result = await postModelPrOutcome(
    outcome,
    channel,
    async (operation, body) => {
      if (operation === "auth.test") return { ok: true, user_id: "Ubot" };
      if (operation === "conversations.history") {
        pages++;
        if (pages === 1) {
          return {
            ok: true,
            messages: [
              { user: "Uhuman", ts: threadTs, text: root },
              {
                user: "Ubot",
                ts: threadTs,
                text: root.replace("e194006", "0000000"),
              },
              {
                user: "Ubot",
                ts: threadTs,
                text: root.replace("pull/161", "pull/159"),
              },
              {
                user: "Ubot",
                ts: "1793203999.000001",
                thread_ts: threadTs,
                text: root,
              },
            ],
            response_metadata: { next_cursor: "older" },
          };
        }
        assert.equal(body.cursor, "older");
        return {
          ok: true,
          messages: [
            { user: "Ubot", ts: threadTs, thread_ts: threadTs, text: root },
          ],
        };
      }
      assert.equal(operation, "chat.postMessage");
      assert.equal(body.thread_ts, threadTs);
      return { ok: true, ts: "1793203999.000001" };
    },
  );
  assert.equal(pages, 2);
  assert.equal(result.threadTs, threadTs);
});

test("does not create a replacement root when an old thread cannot be recovered", async () => {
  await assert.rejects(
    postModelPrOutcome(outcome, channel, async (operation) => {
      if (operation === "auth.test") return { ok: true, user_id: "Ubot" };
      assert.equal(operation, "conversations.history");
      return { ok: true, messages: [] };
    }),
    /refusing to post a new root/,
  );
});
