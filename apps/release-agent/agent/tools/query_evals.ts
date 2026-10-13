import { defineTool } from "eve/tools";
import { z } from "zod";

const publishedResultsUrl =
  "https://raw.githubusercontent.com/vercel/next-evals-oss/main/agent-results.json";
const maxResponseBytes = 16 * 1024 * 1024;

const resultSchema = z
  .object({
    evalPath: z.string().min(1),
    notAvailable: z.boolean().optional(),
    costUsd: z.number().nonnegative().optional(),
    result: z
      .object({
        success: z.boolean(),
        duration: z.number().nonnegative().optional(),
        timestamp: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

const evalDataSchema = z.object({
  metadata: z
    .object({
      exportedAt: z.string(),
      experiments: z.array(
        z
          .object({
            name: z.string().min(1),
            modelName: z.string().min(1),
            agentHarness: z.string().min(1),
            tier: z.union([z.literal(1), z.literal(2)]),
            docsImpact: z
              .object({
                baseSuccessRate: z.number(),
                docsSuccessRate: z.number(),
                delta: z.number(),
                newlyPassed: z.array(z.string()),
                newlyFailed: z.array(z.string()),
              })
              .optional(),
          })
          .passthrough(),
      ),
    })
    .passthrough(),
  results: z.record(z.string(), z.array(resultSchema)),
});

type EvalData = z.infer<typeof evalDataSchema>;
type EvalResult = z.infer<typeof resultSchema>;

async function loadPublishedData(): Promise<EvalData> {
  const response = await fetch(publishedResultsUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "next-evals-release-agent",
    },
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxResponseBytes) {
    throw new Error("GitHub response is too large");
  }
  const body = await response.text();
  if (body.length > maxResponseBytes) {
    throw new Error("GitHub response is too large");
  }
  return evalDataSchema.parse(JSON.parse(body) as unknown);
}

function allowedExperiments(
  data: EvalData,
  includeTier2: boolean,
): Set<string> {
  return new Set(
    data.metadata.experiments
      .filter((experiment) => includeTier2 || experiment.tier === 1)
      .map((experiment) => experiment.name),
  );
}

function percentage(passed: number, total: number): number | null {
  return total === 0 ? null : Math.round((passed / total) * 1000) / 10;
}

function experimentMetadata(data: EvalData, experiment: string) {
  return data.metadata.experiments.find((item) => item.name === experiment);
}

function conditionSuccess(
  data: EvalData,
  experiment: string,
  cell: EvalResult,
  agentsMd: boolean,
): boolean | undefined {
  const impact = experimentMetadata(data, experiment)?.docsImpact;
  if (agentsMd) return impact ? cell.result.success : undefined;
  if (!impact) return cell.result.success;
  if (impact.newlyPassed.includes(cell.evalPath)) return false;
  if (impact.newlyFailed.includes(cell.evalPath)) return true;
  return cell.result.success;
}

function conditionScore(data: EvalData, names: Set<string>, agentsMd: boolean) {
  const values = [...names].flatMap((experiment) =>
    (data.results[experiment] ?? []).flatMap((cell) => {
      if (cell.notAvailable) return [];
      const success = conditionSuccess(data, experiment, cell, agentsMd);
      return success === undefined ? [] : [success];
    }),
  );
  const passed = values.filter(Boolean).length;
  return {
    passed,
    total: values.length,
    percentage: percentage(passed, values.length),
  };
}

function compactResult(cell: EvalResult | undefined) {
  if (!cell) return undefined;
  return {
    success: cell.result.success,
    notAvailable: cell.notAvailable ?? false,
    timestamp: cell.result.timestamp,
    duration: cell.result.duration,
    costUsd: cell.costUsd,
  };
}

function compactConditions(
  data: EvalData,
  experiment: string,
  cell: EvalResult | undefined,
) {
  if (!cell) return undefined;
  const shared = compactResult(cell);
  const withoutAgentsMd = conditionSuccess(data, experiment, cell, false);
  const withAgentsMd = conditionSuccess(data, experiment, cell, true);
  return {
    withoutAgentsMd:
      withoutAgentsMd === undefined
        ? undefined
        : { ...shared, success: withoutAgentsMd },
    withAgentsMd:
      withAgentsMd === undefined
        ? undefined
        : { ...shared, success: withAgentsMd },
  };
}

function modelName(data: EvalData, experiment: string): string {
  return experimentMetadata(data, experiment)?.modelName ?? experiment;
}

function findResult(data: EvalData, experiment: string, evalName: string) {
  return data.results[experiment]?.find((cell) => cell.evalPath === evalName);
}

export default defineTool({
  description:
    "Query the currently published pass@4 Next.js eval leaderboard. Standalone release and backport pass@1 reports arrive in the Slack thread context instead.",
  inputSchema: z.object({
    experiment: z.string().min(1).optional(),
    evalName: z.string().min(1).optional(),
    includeTier2: z.boolean().default(false),
  }),
  async execute({ experiment, evalName, includeTier2 }) {
    const data = await loadPublishedData();
    const names = allowedExperiments(data, includeTier2);
    if (experiment && !names.has(experiment)) {
      return {
        source: publishedResultsUrl,
        error: `No ${includeTier2 ? "available" : "tier-1"} experiment named ${experiment}`,
      };
    }

    const selectedNames = experiment ? new Set([experiment]) : names;
    if (evalName || experiment) {
      const selectedResults = evalName
        ? [...selectedNames].flatMap((name) => {
            const cell = findResult(data, name, evalName);
            if (!cell) return [];
            return [
              {
                experiment: name,
                model: modelName(data, name),
                result: compactConditions(data, name, cell),
              },
            ];
          })
        : (data.results[experiment!] ?? []).map((cell) => ({
            evalName: cell.evalPath,
            result: compactConditions(data, experiment!, cell),
          }));

      return {
        source: publishedResultsUrl,
        metric: "pass@4",
        exportedAt: data.metadata.exportedAt,
        experiment,
        model: experiment ? modelName(data, experiment) : undefined,
        evalName,
        results: selectedResults,
      };
    }

    return {
      source: publishedResultsUrl,
      metric: "pass@4",
      exportedAt: data.metadata.exportedAt,
      scores: {
        withoutAgentsMd: conditionScore(data, names, false),
        withAgentsMd: conditionScore(data, names, true),
      },
      experiments: [...names].sort().map((name) => ({
        name,
        model: modelName(data, name),
        withoutAgentsMd: conditionScore(data, new Set([name]), false),
        withAgentsMd: conditionScore(data, new Set([name]), true),
      })),
    };
  },
});
