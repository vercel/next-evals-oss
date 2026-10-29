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
    threadTs: z
      .string()
      .regex(/^\d+\.\d{6}$/)
      .optional(),
    ...common,
  }),
  z.object({
    event: z.literal("run_failed"),
    sessionId: z.string().min(1).max(256),
    threadTs: z
      .string()
      .regex(/^\d+\.\d{6}$/)
      .optional(),
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

export type ModelPrOutcome = Extract<
  ModelPrNotification,
  {
    event: "run_succeeded" | "run_failed";
  }
>;

export function modelPrOutcomeText(payload: ModelPrOutcome) {
  const pr = `<${payload.prUrl}|PR #${payload.prNumber}>`;
  const run = `<${payload.workflowUrl}|Workflow>`;
  if (payload.event === "run_succeeded") {
    return `Model evals finished. Validated results were added to ${pr} for review and merge. ${run}`;
  }
  if (payload.failure) {
    return `Model evals for ${pr} failed during ${payload.failure.stage}: ${payload.failure.summary} ${run}`;
  }
  return `Model evals for ${pr} failed and need attention. ${run}`;
}

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

export function modelPrNotificationPrompt(
  payload: Extract<
    ModelPrNotification,
    { event: "approval_required" | "run_started" }
  >,
) {
  const subject =
    payload.event === "approval_required"
      ? "approval request"
      : "model eval start";
  return `The ${subject} is already visible in the Slack thread root. Respond with exactly ${modelPrThreadReady} and nothing else.`;
}
