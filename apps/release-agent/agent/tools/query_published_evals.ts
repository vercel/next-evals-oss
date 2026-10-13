import { defineTool } from "eve/tools";
import { z } from "zod";

const publishedResultsUrl =
  "https://raw.githubusercontent.com/vercel/next-evals-oss/main/agent-results.json";

interface PublishedEvalData {
  metadata: {
    exportedAt: string;
    evaluationTarget?: Record<string, unknown>;
    experiments: Array<{
      name: string;
      modelName: string;
      agentHarness: string;
      tier: 1 | 2;
      docsImpact?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
  };
  results: Record<
    string,
    Array<{
      evalPath: string;
      notAvailable?: boolean;
      result: { success: boolean; [key: string]: unknown };
      [key: string]: unknown;
    }>
  >;
}

export default defineTool({
  description:
    "Query the currently published nextjs.org/evals dataset by model or task. With no model or task, returns a compact score summary.",
  inputSchema: z.object({
    experiment: z.string().min(1).optional(),
    evalName: z.string().min(1).optional(),
    includeTier2: z.boolean().default(false),
  }),
  async execute({ experiment, evalName, includeTier2 }) {
    const response = await fetch(publishedResultsUrl, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Published eval data returned HTTP ${response.status}`);
    }
    const data = (await response.json()) as PublishedEvalData;
    const allowed = new Set(
      data.metadata.experiments
        .filter((item) => includeTier2 || item.tier === 1)
        .map((item) => item.name),
    );
    const names = Object.keys(data.results).filter(
      (name) => allowed.has(name) && (!experiment || name === experiment),
    );

    if (experiment && names.length === 0) {
      return {
        source: publishedResultsUrl,
        error: `No ${includeTier2 ? "published" : "tier-1"} experiment named ${experiment}`,
      };
    }

    if (evalName) {
      return {
        source: publishedResultsUrl,
        exportedAt: data.metadata.exportedAt,
        evaluationTarget: data.metadata.evaluationTarget,
        evalName,
        results: names.flatMap((name) => {
          const cell = data.results[name]?.find(
            (result) => result.evalPath === evalName,
          );
          return cell ? [{ experiment: name, ...cell }] : [];
        }),
      };
    }

    if (experiment) {
      return {
        source: publishedResultsUrl,
        exportedAt: data.metadata.exportedAt,
        evaluationTarget: data.metadata.evaluationTarget,
        experiment: data.metadata.experiments.find(
          (item) => item.name === experiment,
        ),
        results: data.results[experiment],
      };
    }

    return {
      source: publishedResultsUrl,
      exportedAt: data.metadata.exportedAt,
      evaluationTarget: data.metadata.evaluationTarget,
      experiments: data.metadata.experiments
        .filter((item) => allowed.has(item.name))
        .map((item) => {
          const results = data.results[item.name] ?? [];
          const available = results.filter((result) => !result.notAvailable);
          const passed = available.filter(
            (result) => result.result.success,
          ).length;
          return {
            name: item.name,
            modelName: item.modelName,
            agentHarness: item.agentHarness,
            tier: item.tier,
            passed,
            total: available.length,
            successRate:
              available.length === 0
                ? null
                : Math.round((passed / available.length) * 1000) / 10,
            docsImpact: item.docsImpact,
          };
        }),
    };
  },
});
