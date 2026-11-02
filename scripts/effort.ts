import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  extractRunTokens,
  estimateUsageFromTranscript,
  priceUsage,
  type Pricing,
  type Usage,
} from "./cost.js";

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  measuredRuns: number;
  totalRuns: number;
}

export interface EffortMetrics {
  avgInputTokens: number | null;
  avgOutputTokens: number | null;
  avgCacheReadTokens: number | null;
  avgCacheWriteTokens: number | null;
  avgDuration: number | null;
  avgCostUsd: number | null;
  measuredRuns: number;
  totalRuns: number;
}

interface EffortResult {
  notAvailable?: boolean;
  costUsd?: number;
  tokenUsage?: TokenUsage;
  result: { duration: number };
}

const mean = (values: number[]): number | null =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

export async function readEvalEffort(
  evalDir: string,
  totalRuns: number,
  pricing?: Pricing | null,
): Promise<{ costUsd?: number; tokenUsage: TokenUsage }> {
  const costs: number[] = [];
  const usages: Usage[] = [];
  for (const entry of await readdir(evalDir)) {
    if (!/^run-\d+$/.test(entry)) continue;
    let raw: string;
    try {
      raw = await readFile(
        join(evalDir, entry, "transcript-raw.jsonl"),
        "utf8",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const usage = extractRunTokens(raw);
    if (usage) usages.push(usage);
    // Preserve the existing list-cost estimate, but never present text-length
    // estimates as provider-reported token counts.
    const pricedUsage = usage ?? estimateUsageFromTranscript(raw);
    if (pricing && pricedUsage) costs.push(priceUsage(pricedUsage, pricing));
  }
  const cost = mean(costs);
  return {
    ...(cost !== null ? { costUsd: cost } : {}),
    tokenUsage: {
      inputTokens: mean(
        usages.map((u) => u.input + u.cacheRead + u.cacheWrite),
      ),
      outputTokens: mean(usages.map((u) => u.output)),
      cacheReadTokens: mean(usages.map((u) => u.cacheRead)),
      cacheWriteTokens: mean(usages.map((u) => u.cacheWrite)),
      measuredRuns: usages.length,
      totalRuns,
    },
  };
}

export function aggregateEffort(results: EffortResult[]): EffortMetrics {
  const available = results.filter((r) => !r.notAvailable);
  const tokens = available.flatMap((r) => (r.tokenUsage ? [r.tokenUsage] : []));
  const tokenMean = (
    key:
      | "inputTokens"
      | "outputTokens"
      | "cacheReadTokens"
      | "cacheWriteTokens",
  ) => mean(tokens.flatMap((t) => (t[key] === null ? [] : [t[key]])));
  return {
    avgInputTokens: tokenMean("inputTokens"),
    avgOutputTokens: tokenMean("outputTokens"),
    avgCacheReadTokens: tokenMean("cacheReadTokens"),
    avgCacheWriteTokens: tokenMean("cacheWriteTokens"),
    avgDuration: mean(available.map((r) => r.result.duration / 1000)),
    avgCostUsd: mean(
      available.flatMap((r) =>
        typeof r.costUsd === "number" ? [r.costUsd] : [],
      ),
    ),
    measuredRuns: tokens.reduce((sum, t) => sum + t.measuredRuns, 0),
    totalRuns: tokens.reduce((sum, t) => sum + t.totalRuns, 0),
  };
}
