import { defineTool } from "eve/tools";
import { z } from "zod";

const repository = "vercel/next-evals-oss";
const publishedResultsUrl =
  "https://raw.githubusercontent.com/vercel/next-evals-oss/main/agent-results.json";
const pullRequestPattern =
  /^https:\/\/github\.com\/vercel\/next-evals-oss\/pull\/(\d+)$/;
const shaPattern = /^[0-9a-f]{40}$/i;
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
      measurement: z
        .object({
          metric: z.literal("pass@1"),
          scoredAttempts: z.literal(1),
          infrastructureFailuresExcluded: z.literal(true),
        })
        .optional(),
      evaluationTarget: z.record(z.string(), z.unknown()).optional(),
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

const releaseDiagnosticsSchema = z.object({
  schemaVersion: z.literal(1),
  metric: z.literal("pass@1"),
  confirmationAttemptsPerFailure: z.literal(2),
  experiments: z.array(
    z.object({
      schemaVersion: z.literal(1),
      experiment: z.string().min(1),
      metric: z.literal("pass@1"),
      confirmationAttempts: z.literal(2),
      tasks: z.array(
        z.object({
          evalName: z.string().min(1),
          scoredFailureReason: z.string().min(1),
          confirmations: z.array(
            z.object({
              attempt: z.number().int().positive(),
              outcome: z.enum(["passed", "failed"]),
              infrastructureRetries: z.number().int().nonnegative(),
              failureReason: z.string().optional(),
            }),
          ),
        }),
      ),
    }),
  ),
});

type EvalData = z.infer<typeof evalDataSchema>;
type EvalResult = z.infer<typeof resultSchema>;
type ReleaseDiagnostics = z.infer<typeof releaseDiagnosticsSchema>;

interface EvalSource {
  kind: "published" | "pull-request";
  resultsUrl: string;
  diagnosticsUrl?: string;
  prUrl?: string;
  headSha?: string;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "next-evals-release-agent",
    },
  });
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);

  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > maxResponseBytes) {
    throw new Error("GitHub response is too large");
  }
  const body = await response.text();
  if (body.length > maxResponseBytes)
    throw new Error("GitHub response is too large");
  return JSON.parse(body) as unknown;
}

async function loadData(url: string): Promise<EvalData> {
  return evalDataSchema.parse(await fetchJson(url));
}

async function loadOptionalDiagnostics(
  url: string,
): Promise<ReleaseDiagnostics | undefined> {
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "next-evals-release-agent",
    },
  });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
  const body = await response.text();
  if (body.length > maxResponseBytes)
    throw new Error("GitHub response is too large");
  return releaseDiagnosticsSchema.parse(JSON.parse(body) as unknown);
}

async function resolveSource(prUrl?: string): Promise<{
  source: EvalSource;
  data: EvalData;
  diagnostics?: ReleaseDiagnostics;
}> {
  if (!prUrl) {
    return {
      source: { kind: "published", resultsUrl: publishedResultsUrl },
      data: await loadData(publishedResultsUrl),
    };
  }

  const match = pullRequestPattern.exec(prUrl);
  if (!match) {
    throw new Error(`PR URL must belong to ${repository}`);
  }
  const pull = z
    .object({
      head: z.object({
        sha: z.string(),
        repo: z.object({ full_name: z.string() }).nullable(),
      }),
      base: z.object({
        ref: z.string(),
        repo: z.object({ full_name: z.string() }),
      }),
    })
    .parse(
      await fetchJson(
        `https://api.github.com/repos/${repository}/pulls/${match[1]}`,
      ),
    );
  if (
    pull.head.repo?.full_name !== repository ||
    pull.base.repo.full_name !== repository ||
    pull.base.ref !== "main" ||
    !shaPattern.test(pull.head.sha)
  ) {
    throw new Error(
      "Results PR must be a same-repository pull request into main",
    );
  }

  const resultsUrl = `https://raw.githubusercontent.com/${repository}/${pull.head.sha}/agent-results.json`;
  const diagnosticsUrl = `https://raw.githubusercontent.com/${repository}/${pull.head.sha}/release-diagnostics.json`;
  const [data, diagnostics] = await Promise.all([
    loadData(resultsUrl),
    loadOptionalDiagnostics(diagnosticsUrl),
  ]);
  return {
    source: {
      kind: "pull-request",
      prUrl,
      headSha: pull.head.sha,
      resultsUrl,
      diagnosticsUrl,
    },
    data,
    diagnostics,
  };
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

function compareResults(
  current: EvalData,
  previous: EvalData,
  names: Set<string>,
  limit: number,
) {
  const changes = [...names]
    .flatMap((experiment) =>
      (current.results[experiment] ?? []).flatMap((cell) => {
        if (cell.notAvailable) return [];
        const prior = findResult(previous, experiment, cell.evalPath);
        if (!prior || prior.notAvailable) return [];
        return [false, true].flatMap((agentsMd) => {
          const currentSuccess = conditionSuccess(
            current,
            experiment,
            cell,
            agentsMd,
          );
          const previousSuccess = conditionSuccess(
            previous,
            experiment,
            prior,
            agentsMd,
          );
          if (
            currentSuccess === undefined ||
            previousSuccess === undefined ||
            currentSuccess === previousSuccess
          ) {
            return [];
          }
          return [
            {
              evalName: cell.evalPath,
              experiment,
              model: modelName(current, experiment),
              agentsMd,
              previous: previousSuccess,
              current: currentSuccess,
            },
          ];
        });
      }),
    )
    .sort(
      (a, b) =>
        a.evalName.localeCompare(b.evalName) ||
        a.experiment.localeCompare(b.experiment),
    );

  return {
    changedTaskCount: new Set(changes.map((change) => change.evalName)).size,
    changedCellCount: changes.length,
    changes: changes.slice(0, limit),
    truncated: changes.length > limit,
  };
}

function measurementsAreComparable(current: EvalData, previous: EvalData) {
  return (
    current.metadata.measurement?.metric === "pass@1" &&
    previous.metadata.measurement?.metric === "pass@1"
  );
}

function summarizeDiagnostics(
  diagnostics: ReleaseDiagnostics | undefined,
  data: EvalData,
  names: Set<string>,
  evalName: string | undefined,
  limit: number,
) {
  if (!diagnostics) return undefined;
  const entries = diagnostics.experiments
    .flatMap((experiment) => {
      const agentsMd = experiment.experiment.endsWith("--agents-md");
      const baseExperiment = experiment.experiment.replace(/--agents-md$/, "");
      if (!names.has(baseExperiment)) return [];
      return experiment.tasks
        .filter((task) => !evalName || task.evalName === evalName)
        .map((task) => {
          const confirmationPasses = task.confirmations.filter(
            (attempt) => attempt.outcome === "passed",
          ).length;
          return {
            experiment: baseExperiment,
            model: modelName(data, baseExperiment),
            evalName: task.evalName,
            agentsMd,
            scoredOutcome: "failed" as const,
            confirmationPasses,
            confirmationFailures:
              task.confirmations.length - confirmationPasses,
            reproducible: confirmationPasses === 0,
            infrastructureRetries: task.confirmations.reduce(
              (total, attempt) => total + attempt.infrastructureRetries,
              0,
            ),
            scoredFailureReason: task.scoredFailureReason,
          };
        });
    })
    .sort(
      (a, b) =>
        a.evalName.localeCompare(b.evalName) ||
        a.experiment.localeCompare(b.experiment) ||
        Number(a.agentsMd) - Number(b.agentsMd),
    );

  return {
    scoredFailureCount: entries.length,
    reproducibleFailureCount: entries.filter((entry) => entry.reproducible)
      .length,
    unstableFailureCount: entries.filter((entry) => !entry.reproducible).length,
    confirmationAttemptsPerFailure: diagnostics.confirmationAttemptsPerFailure,
    failures: entries.slice(0, limit),
    truncated: entries.length > limit,
  };
}

export default defineTool({
  description:
    "Query Next.js eval results from the published board or a validated same-repository results PR. PR summaries compare the proposed immutable result data with main.",
  inputSchema: z.object({
    prUrl: z.string().optional(),
    experiment: z.string().min(1).optional(),
    evalName: z.string().min(1).optional(),
    includeTier2: z.boolean().default(false),
    changeLimit: z.number().int().min(1).max(100).default(50),
  }),
  async execute({ prUrl, experiment, evalName, includeTier2, changeLimit }) {
    const current = await resolveSource(prUrl);
    const names = allowedExperiments(current.data, includeTier2);
    if (experiment && !names.has(experiment)) {
      return {
        source: current.source,
        error: `No ${includeTier2 ? "available" : "tier-1"} experiment named ${experiment}`,
      };
    }

    const selectedNames = experiment ? new Set([experiment]) : names;
    const published = prUrl ? await resolveSource() : undefined;
    const failureDiagnostics = summarizeDiagnostics(
      current.diagnostics,
      current.data,
      selectedNames,
      evalName,
      changeLimit,
    );
    const selectedResults = evalName
      ? [...selectedNames].flatMap((name) => {
          const cell = findResult(current.data, name, evalName);
          if (!cell) return [];
          return [
            {
              experiment: name,
              model: modelName(current.data, name),
              current: compactConditions(current.data, name, cell),
              published: published
                ? compactConditions(
                    published.data,
                    name,
                    findResult(published.data, name, evalName),
                  )
                : undefined,
            },
          ];
        })
      : undefined;

    if (evalName || experiment) {
      return {
        source: current.source,
        exportedAt: current.data.metadata.exportedAt,
        evaluationTarget: current.data.metadata.evaluationTarget,
        experiment,
        model: experiment ? modelName(current.data, experiment) : undefined,
        evalName,
        failureDiagnostics,
        results:
          selectedResults ??
          (current.data.results[experiment!] ?? []).map((cell) => ({
            evalName: cell.evalPath,
            current: compactConditions(current.data, experiment!, cell),
            published: published
              ? compactConditions(
                  published.data,
                  experiment!,
                  findResult(published.data, experiment!, cell.evalPath),
                )
              : undefined,
          })),
      };
    }

    return {
      source: current.source,
      exportedAt: current.data.metadata.exportedAt,
      evaluationTarget: current.data.metadata.evaluationTarget,
      scores: {
        withoutAgentsMd: conditionScore(current.data, names, false),
        withAgentsMd: conditionScore(current.data, names, true),
      },
      experiments: [...names].sort().map((name) => ({
        name,
        model: modelName(current.data, name),
        withoutAgentsMd: conditionScore(current.data, new Set([name]), false),
        withAgentsMd: conditionScore(current.data, new Set([name]), true),
      })),
      failureDiagnostics,
      comparison: published
        ? measurementsAreComparable(current.data, published.data)
          ? {
              source: published.source,
              comparable: true,
              scores: {
                withoutAgentsMd: conditionScore(published.data, names, false),
                withAgentsMd: conditionScore(published.data, names, true),
              },
              ...compareResults(
                current.data,
                published.data,
                names,
                changeLimit,
              ),
            }
          : {
              source: published.source,
              comparable: false,
              note: "The published baseline does not identify itself as pass@1. This run establishes the pass@1 baseline, so performance deltas are intentionally omitted.",
            }
        : undefined,
    };
  },
});
