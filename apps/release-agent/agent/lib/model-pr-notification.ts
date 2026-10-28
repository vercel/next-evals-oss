import { z } from "zod";

const githubUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).hostname === "github.com");

const modelPair = z.object({
  base: z.string().min(1).max(120),
  experiments: z.array(z.string().min(1).max(160)).min(2).max(2),
});

const common = {
  prNumber: z.number().int().positive(),
  prUrl: githubUrl,
  headSha: z.string().regex(/^[a-f0-9]{40}$/),
  pairs: z.array(modelPair).min(1).max(20),
  workflowUrl: githubUrl,
};

export const modelPrNotificationSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.enum(["approval_required", "run_started"]),
    ...common,
  }),
  z.object({
    event: z.literal("run_succeeded"),
    sessionId: z.string().min(1).max(256),
    ...common,
  }),
  z.object({
    event: z.literal("run_failed"),
    sessionId: z.string().min(1).max(256),
    failure: z
      .object({
        stage: z.string().min(1).max(80),
        summary: z.string().min(1).max(240),
      })
      .optional(),
    ...common,
  }),
]);

export type ModelPrNotification = z.infer<typeof modelPrNotificationSchema>;

export const modelPrThreadReady = "MODEL_EVAL_THREAD_READY";

function models(payload: ModelPrNotification) {
  return payload.pairs.map((pair) => `\`${pair.base}\``).join(", ");
}

export function modelPrNotificationRoot(payload: ModelPrNotification) {
  const pullRequest = `<${payload.prUrl}|Model registration PR #${payload.prNumber}>`;
  const head = `\`${payload.headSha.slice(0, 7)}\``;

  if (payload.event === "approval_required") {
    return `${pullRequest} needs two maintainers to approve ${head} before credentialed evals can run. Models: ${models(payload)}.`;
  }
  if (payload.event === "run_started") {
    return `${pullRequest} is approved and its model evals are starting for ${head}. Models: ${models(payload)}.`;
  }
  throw new Error("Only a new model eval thread has a root notification");
}

export function modelPrNotificationPrompt(payload: ModelPrNotification) {
  const shared = [
    `Pull request: ${payload.prUrl}`,
    `Exact head SHA: ${payload.headSha}`,
    `Models: ${models(payload)}`,
    `Workflow: ${payload.workflowUrl}`,
  ].join("\n");

  if (payload.event === "approval_required") {
    return `The approval request is already visible in the Slack thread root. Respond with exactly ${modelPrThreadReady} and nothing else.`;
  }
  if (payload.event === "run_started") {
    return `The model eval start is already visible in the Slack thread root. Respond with exactly ${modelPrThreadReady} and nothing else.`;
  }
  if (payload.event === "run_succeeded") {
    return `Reply concisely in this existing Slack thread that the model eval run finished successfully, the validated results were added to PR #${payload.prNumber}, and the PR is ready for human review and merge. Include the PR and workflow links. Do not repeat the original message or start a new report.\n\n${shared}`;
  }
  if (payload.event === "run_failed" && payload.failure) {
    return `Reply concisely in this existing Slack thread that the model eval run failed during ${payload.failure.stage}. Use this exact failure description without adding speculation: ${payload.failure.summary} Include PR #${payload.prNumber} and the workflow link. Do not quote raw logs, repeat the original message, or start a new report.\n\n${shared}`;
  }
  return `Reply concisely in this existing Slack thread that the model eval run failed and needs attention. Include PR #${payload.prNumber} and the workflow link. Do not repeat the original message or start a new report.\n\n${shared}`;
}
