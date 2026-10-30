import { connectSlackCredentials } from "@vercel/connect/eve";
import {
  defaultSlackAuth,
  defineSlackRenderer,
  postCompletedSlackReply,
  slackChannel,
} from "eve/channels/slack";

import { modelPrThreadReady } from "../lib/model-pr-notification";
import { splitReleaseEvalSlackReport } from "../lib/release-report-message";

export const measurementsChannelId = "C0C7VCBP4CA";
export const vercelWorkspaceId = "T0CAQ00TU";
export const slackCredentials = connectSlackCredentials(
  "slack/next-evals-release-agent",
);

const modelEvalThread = defineSlackRenderer({
  events: {
    async "message.completed"(event, _channel, _ctx, next) {
      if (
        event.finishReason !== "tool-calls" &&
        event.message?.trim() === modelPrThreadReady
      ) {
        return;
      }
      await next();
    },
  },
});

const releaseEvalThread = defineSlackRenderer({
  events: {
    async "message.completed"(event, channel, _ctx, next) {
      if (event.finishReason === "tool-calls" || !event.message) return next();

      const report = splitReleaseEvalSlackReport(event.message);
      if (!report) return next();

      await postCompletedSlackReply(channel, report.root);

      try {
        for (const reply of report.replies) {
          await channel.thread.post(reply);
        }
      } catch (error) {
        console.error("Failed to post release eval detail thread", error);
        try {
          await channel.thread.post(
            "I could not post every detailed result. Ask me in this thread for the missing breakdown.",
          );
        } catch (fallbackError) {
          console.error(
            "Failed to post release eval detail fallback",
            fallbackError,
          );
        }
      }
    },
  },
});

export default slackChannel({
  credentials: slackCredentials,
  renderers: [modelEvalThread, releaseEvalThread],
  onAppMention(ctx, message) {
    if (message.channelId !== measurementsChannelId || message.author?.isBot) {
      return null;
    }
    return {
      auth: defaultSlackAuth(message, ctx),
      title: "Next.js evals question",
    };
  },
  onDirectMessage() {
    return null;
  },
  onMessage(ctx, message) {
    if (message.channelId !== measurementsChannelId || message.author?.isBot) {
      return null;
    }
    if (!ctx.isBotMentioned()) return null;
    return { auth: defaultSlackAuth(message, ctx) };
  },
});
