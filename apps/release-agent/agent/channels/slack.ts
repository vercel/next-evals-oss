import { connectSlackCredentials } from "@vercel/connect/eve";
import {
  defaultSlackAuth,
  slackChannel,
} from "eve/channels/slack";

export const measurementsChannelId = "C0C7VCBP4CA";
export const vercelWorkspaceId = "T0CAQ00TU";

export default slackChannel({
  credentials: connectSlackCredentials("slack/next-evals-release-agent"),
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
  async onMessage(ctx, message) {
    if (message.channelId !== measurementsChannelId || message.author?.isBot) {
      return null;
    }
    if (!ctx.isBotMentioned() && !(await ctx.isSubscribed())) return null;
    return { auth: defaultSlackAuth(message, ctx) };
  },
});
