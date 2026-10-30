import type { SlackApiResponse } from "eve/channels/slack";
import {
  type ModelPrOutcome,
  modelPrNotificationRoot,
  modelPrOutcomeText,
} from "./model-pr-notification";

type SlackApi = (
  operation: string,
  body: Record<string, unknown>,
) => Promise<SlackApiResponse>;

export function modelThreadUrl(channel: string, ts: string) {
  return `https://vercel.slack.com/archives/${channel}/p${ts.replace(".", "")}`;
}

// Older checks stored only an Eve session, and their outcome overwrote the
// summary containing the Slack link. Recover only our bot's exact PR/head root.
async function findLegacyParent(
  payload: ModelPrOutcome,
  channel: string,
  api: SlackApi,
) {
  const identity = await api("auth.test", {});
  if (!identity.ok || typeof identity.user_id !== "string") {
    throw new Error("Could not identify the Slack bot for thread recovery");
  }
  const roots = ["approval_required", "run_started"].map((event) =>
    modelPrNotificationRoot({
      ...payload,
      event: event as "approval_required" | "run_started",
    }),
  );
  let cursor: string | undefined;
  for (let page = 0; page < 10; page++) {
    const history = await api("conversations.history", {
      channel,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!history.ok || !Array.isArray(history.messages)) {
      throw new Error("Could not read the original model eval Slack thread");
    }
    const parent = history.messages.find(
      (message) =>
        message.user === identity.user_id &&
        (!message.thread_ts || message.thread_ts === message.ts) &&
        typeof message.ts === "string" &&
        roots.includes(message.text),
    );
    if (parent) return parent.ts as string;
    cursor = history.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  throw new Error(
    "Original model eval Slack thread not found; refusing to post a new root",
  );
}

export async function postModelPrOutcome(
  payload: ModelPrOutcome,
  channel: string,
  api: SlackApi,
) {
  let threadTs = payload.threadTs;
  if (threadTs) {
    const history = await api("conversations.history", {
      channel, oldest: threadTs, latest: threadTs, inclusive: true, limit: 1,
    });
    if (!history.ok || !Array.isArray(history.messages)) {
      throw new Error("Could not verify the saved model eval Slack thread");
    }
    if (!history.messages.some((message) => message.ts === threadTs)) {
      threadTs = undefined;
    }
  }
  threadTs ??= await findLegacyParent(payload, channel, api);
  const posted = await api("chat.postMessage", {
    channel,
    thread_ts: threadTs,
    text: modelPrOutcomeText(payload),
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!posted.ok || typeof posted.ts !== "string") {
    throw new Error(
      `Slack rejected the model outcome: ${String(posted.error ?? "missing_ts")}`,
    );
  }
  return { threadTs, threadUrl: modelThreadUrl(channel, threadTs) };
}
