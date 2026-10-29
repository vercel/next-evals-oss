import { defineChannel, POST } from "eve/channels";
import {
  createUnauthorizedResponse,
  extractBearerToken,
  verifyOidc,
} from "eve/channels/auth";
import { callSlackApi } from "eve/channels/slack";

import {
  modelPrNotificationRoot,
  modelPrNotificationPrompt,
  modelPrNotificationSchema,
} from "../lib/model-pr-notification";
import { modelThreadUrl, postModelPrOutcome } from "../lib/model-pr-slack";
import {
  releaseNotificationSchema,
  releaseSummaryPrompt,
} from "../lib/release-notification";
import slack, {
  measurementsChannelId,
  slackCredentials,
  vercelWorkspaceId,
} from "./slack";

const maxPayloadBytes = 512 * 1024;
const releaseWorkflowSubject = "repo:vercel/next-evals-oss:ref:refs/heads/main";
const releaseWorkflowIssuer = "https://token.actions.githubusercontent.com";
const releaseWorkflowAudience = "https://github.com/vercel";

export default defineChannel({
  routes: [
    POST("/release-evals", async (request, ctx) => {
      const authResult = await verifyOidc(
        extractBearerToken(request.headers.get("authorization")),
        {
          audiences: [releaseWorkflowAudience],
          issuer: releaseWorkflowIssuer,
          subjects: [releaseWorkflowSubject],
        },
      );
      if (!authResult.ok) {
        return createUnauthorizedResponse({
          challenges: [{ scheme: "Bearer" }],
        });
      }
      const auth = authResult.sessionAuth;

      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxPayloadBytes) {
        return Response.json({ error: "payload_too_large" }, { status: 413 });
      }

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }

      const parsed = releaseNotificationSchema.safeParse(payload);
      if (!parsed.success) {
        return Response.json({ error: "invalid_payload" }, { status: 400 });
      }

      ctx.waitUntil(
        ctx
          .to(slack, {
            channelId: measurementsChannelId,
            installationTeamId: vercelWorkspaceId,
          })
          .send(releaseSummaryPrompt(parsed.data), {
            auth,
          }),
      );

      return Response.json({ accepted: true }, { status: 202 });
    }),
    POST("/model-evals", async (request, ctx) => {
      const authResult = await verifyOidc(
        extractBearerToken(request.headers.get("authorization")),
        {
          audiences: [releaseWorkflowAudience],
          issuer: releaseWorkflowIssuer,
          subjects: [releaseWorkflowSubject],
        },
      );
      if (!authResult.ok) {
        return createUnauthorizedResponse({
          challenges: [{ scheme: "Bearer" }],
        });
      }
      const auth = authResult.sessionAuth;

      const contentLength = Number(request.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > maxPayloadBytes) {
        return Response.json({ error: "payload_too_large" }, { status: 413 });
      }

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ error: "invalid_json" }, { status: 400 });
      }

      const parsed = modelPrNotificationSchema.safeParse(payload);
      if (!parsed.success) {
        return Response.json({ error: "invalid_payload" }, { status: 400 });
      }

      if (
        parsed.data.event === "run_succeeded" ||
        parsed.data.event === "run_failed"
      ) {
        const thread = await postModelPrOutcome(
          parsed.data,
          measurementsChannelId,
          (operation, body) =>
            callSlackApi({
              botToken: slackCredentials.botToken,
              context: { teamId: vercelWorkspaceId },
              operation,
              body,
            }),
        );
        return Response.json({ accepted: true, ...thread });
      }

      const posted = await callSlackApi({
        botToken: slackCredentials.botToken,
        context: { teamId: vercelWorkspaceId },
        operation: "chat.postMessage",
        body: {
          channel: measurementsChannelId,
          text: modelPrNotificationRoot(parsed.data),
          unfurl_links: false,
          unfurl_media: false,
        },
      });
      if (!posted.ok || typeof posted.ts !== "string") {
        throw new Error(
          `Slack rejected the model notification: ${String(posted.error ?? "missing_ts")}`,
        );
      }

      let session;
      try {
        session = await ctx
          .to(slack, {
            channelId: measurementsChannelId,
            installationTeamId: vercelWorkspaceId,
            threadTs: posted.ts,
          })
          .send(modelPrNotificationPrompt(parsed.data), { auth });
      } catch (error) {
        await callSlackApi({
          botToken: slackCredentials.botToken,
          context: { teamId: vercelWorkspaceId },
          operation: "chat.delete",
          body: { channel: measurementsChannelId, ts: posted.ts },
        }).catch(() => undefined);
        throw error;
      }

      const threadUrl = modelThreadUrl(measurementsChannelId, posted.ts);
      return Response.json(
        {
          accepted: true,
          sessionId: session.id,
          threadTs: posted.ts,
          threadUrl,
        },
        { status: 202 },
      );
    }),
  ],
});
