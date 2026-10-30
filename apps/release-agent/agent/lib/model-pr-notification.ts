import { z } from "zod";

const githubUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).hostname === "github.com");

const modelPair = z.object({
  base: z.string().min(1).max(120),
  experiments: z.array(z.string().min(1).max(160)).min(2).max(2),
});

const taskNames = z.array(z.string().min(1).max(160)).max(1000);
const modelResult = z
  .object({
    experiment: z.string().min(1).max(120),
    model: z.string().min(1).max(120),
    tier: z.union([z.literal(1), z.literal(2)]),
    total: z.number().int().positive(),
    basePassed: z.number().int().nonnegative(),
    agentsMdPassed: z.number().int().nonnegative(),
    newlyPassed: taskNames,
    newlyFailed: taskNames,
    failedBoth: taskNames,
  })
  .refine(
    (result) =>
      result.basePassed <= result.total &&
      result.agentsMdPassed <= result.total,
  );

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
    // Optional while the workflow and the separately deployed app roll out.
    results: z.array(modelResult).min(1).max(20).optional(),
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
    const selected = new Set(payload.pairs.map((pair) => pair.base));
    if (
      payload.results &&
      (payload.results.length !== selected.size ||
        new Set(payload.results.map((result) => result.experiment)).size !==
          selected.size ||
        payload.results.some((result) => !selected.has(result.experiment)))
    ) {
      throw new Error("Model summary does not match the measured model pairs");
    }
    const summaries = payload.results
      ?.map((result) => {
        const score = (passed: number) =>
          `${passed}/${result.total} · ${((100 * passed) / result.total).toFixed(1)}%`;
        const tasks = (names: string[]) => {
          const shown = names
            .slice(0, 6)
            .map(
              (name) =>
                `\`${slackText(name.replace(/^agent-/, "")).slice(0, 80)}\``,
            );
          return (
            shown.join(", ") +
            (names.length > shown.length
              ? ` (+${names.length - shown.length} more in the PR)`
              : "")
          );
        };
        return [
          `*${slackText(result.model)} · results ready for review*`,
          `• *Base:* ${score(result.basePassed)}`,
          `• *AGENTS.md:* ${score(result.agentsMdPassed)}`,
          ...(result.newlyPassed.length
            ? [`• Passed only with AGENTS.md: ${tasks(result.newlyPassed)}`]
            : []),
          ...(result.newlyFailed.length
            ? [`• Passed only in Base: ${tasks(result.newlyFailed)}`]
            : []),
          ...(result.failedBoth.length
            ? [`• Failed in both: ${tasks(result.failedBoth)}`]
            : []),
          `Public-board tier: ${result.tier}. Confirm this during review.`,
        ].join("\n");
      })
      .join("\n\n");
    return [
      summaries ??
        "*Model evals finished*\nScores are unavailable in this reply. Open the PR to review the results.",
      `${pr} · ${run}`,
      "Review the failed attempts and graders, then merge the PR to publish to <https://nextjs.org/evals|nextjs.org/evals>. These are Base/AGENTS.md results, not release regressions.",
    ].join("\n\n");
  }
  if (payload.failure) {
    return `Model evals for ${pr} failed during ${payload.failure.stage}: ${payload.failure.summary} ${run}`;
  }
  return `Model evals for ${pr} failed and need attention. ${run}`;
}

function slackText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[*_`\r\n]/g, " ");
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
  return `The ${subject} is already visible in the Slack thread. Respond with exactly ${modelPrThreadReady} and nothing else.`;
}
