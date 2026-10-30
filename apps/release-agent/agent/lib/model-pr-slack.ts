import type { SlackApiResponse } from "eve/channels/slack";
import {
  type ModelPrOutcome,
  type ModelPrNotification,
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

// A new commit needs fresh approvals, but it belongs in the same PR thread.
export async function findModelPrParent(
  payload: ModelPrNotification,
  channel: string,
  api: SlackApi,
) {
  const identity = await api("auth.test", {});
  if (!identity.ok || typeof identity.user_id !== "string") {
    throw new Error("Could not identify the Slack bot for thread recovery");
  }
  const pr = `<${payload.prUrl}|Model registration PR #${payload.prNumber}>`;
  const prefixes = [
    `${pr} needs two maintainers to approve `,
    `${pr} is approved and its model evals are starting for `,
  ];
  let cursor: string | undefined;
  let oldest: string | undefined;
  for (let page = 0; page < 10; page++) {
    const history = await api("conversations.history", {
      channel,
      limit: 200,
      ...(cursor ? { cursor } : {}),
    });
    if (!history.ok || !Array.isArray(history.messages)) {
      throw new Error("Could not read the original model eval Slack thread");
    }
    const parents = history.messages.filter(
      (message) =>
        message.user === identity.user_id &&
        (!message.thread_ts || message.thread_ts === message.ts) &&
        typeof message.ts === "string" &&
        typeof message.text === "string" &&
        prefixes.some((prefix) => message.text.startsWith(prefix)),
    );
    for (const parent of parents) {
      if (!oldest || Number(parent.ts) < Number(oldest))
        oldest = parent.ts as string;
    }
    cursor = history.response_metadata?.next_cursor;
    if (!cursor) return oldest;
  }
  throw new Error(
    "Model eval Slack history is incomplete; refusing to create a duplicate thread",
  );
}

export async function postModelPrNotification(
  payload: Extract<
    ModelPrNotification,
    { event: "approval_required" | "run_started" }
  >,
  channel: string,
  api: SlackApi,
) {
  const threadTs = await findModelPrParent(payload, channel, api);
  const text = modelPrNotificationRoot(payload);
  if (threadTs) {
    let cursor: string | undefined;
    let parentUser: string | undefined;
    for (let page = 0; page < 10; page++) {
      const replies = await api("conversations.replies", {
        channel,
        ts: threadTs,
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      if (!replies.ok || !Array.isArray(replies.messages))
        throw new Error("Could not read model eval thread replies");
      const parent = replies.messages.find(
        (message) => message.ts === threadTs,
      );
      if (parent && typeof parent.user === "string") parentUser = parent.user;
      if (!parentUser)
        throw new Error("Could not verify the model eval thread author");
      // The first page includes the parent, whose bot identity was verified above.
      const existing = replies.messages.find(
        (message) => message.text === text && message.user === parentUser,
      );
      if (existing)
        return { threadTs, messageTs: existing.ts as string, created: false };
      cursor = replies.response_metadata?.next_cursor;
      if (!cursor) break;
      if (page === 9)
        throw new Error("Model eval thread replies are incomplete");
    }
  }
  const posted = await api("chat.postMessage", {
    channel,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
    reply_broadcast: false,
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!posted.ok || typeof posted.ts !== "string")
    throw new Error(
      `Slack rejected the model notification: ${String(posted.error ?? "missing_ts")}`,
    );
  return {
    threadTs: threadTs ?? posted.ts,
    messageTs: posted.ts,
    created: true,
  };
}

export async function postModelPrOutcome(
  payload: ModelPrOutcome,
  channel: string,
  api: SlackApi,
) {
  let threadTs = payload.threadTs;
  if (threadTs) {
    const history = await api("conversations.history", {
      channel,
      oldest: threadTs,
      latest: threadTs,
      inclusive: true,
      limit: 1,
    });
    if (!history.ok || !Array.isArray(history.messages)) {
      throw new Error("Could not verify the saved model eval Slack thread");
    }
    if (!history.messages.some((message) => message.ts === threadTs)) {
      threadTs = undefined;
    }
  }
  threadTs ??= await findModelPrParent(payload, channel, api);
  if (!threadTs)
    throw new Error(
      "Original model eval Slack thread not found; refusing to post a new root",
    );
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
