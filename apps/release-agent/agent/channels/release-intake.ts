import { defineChannel, POST } from "eve/channels";
import {
  createUnauthorizedResponse,
  extractBearerToken,
  verifyOidc,
} from "eve/channels/auth";

import {
  releaseNotificationSchema,
  releaseSummaryPrompt,
} from "../lib/release-notification";
import slack, {
  measurementsChannelId,
  vercelWorkspaceId,
} from "./slack";

const maxPayloadBytes = 512 * 1024;
const releaseWorkflowSubject =
  "repo:vercel/next-evals-oss:ref:refs/heads/main";
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
        return createUnauthorizedResponse({ challenges: [{ scheme: "Bearer" }] });
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
  ],
});
