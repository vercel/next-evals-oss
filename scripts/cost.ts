/**
 * List-cost estimation for nextjs.org/evals.
 *
 * Tokens are extracted from each run's transcript-raw.jsonl and multiplied by
 * public list prices. Two halves, deliberately separated: token counts are
 * facts about a run and never change; prices do, so they live in one table
 * that is refreshed when a re-export runs.
 *
 * "List cost" means the published per-token rate, not a negotiated or
 * subscription rate — a buyer comparing models at today's rack prices.
 */

/** Token usage for one run, normalized across agent harnesses. */
export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** List price per 1M tokens. */
export interface Pricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * List prices per 1M tokens, keyed by the board (base) experiment slug.
 * --agents-md variants resolve to the same entry via AGENTS_MD_PAIRS.
 *
 * Anthropic / Google / OpenAI / Moonshot / Z.ai / xAI / MiniMax values are a
 * snapshot of models.dev. Cursor Composer is not on models.dev; its rates come
 * from cursor.com/docs/models-and-pricing (Standard tier).
 *
 * null = do not estimate a cost (rendered as N/A).
 *
 * When adding a model, add its price here or /evals shows N/A for that row.
 */
export const MODEL_PRICING: Record<string, Pricing | null> = {
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  // Introductory pricing through 2026-08-31; standard is 3/15/0.3/3.75 after.
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-opus-4.6': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4.7': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-opus-4.8': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-4.5': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'claude-sonnet-4.6': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'cursor-composer-2.0': { input: 0.5, output: 2.5, cacheRead: 0.2, cacheWrite: 0 }, // cursor.com, Standard
  'cursor-composer-2.5': { input: 0.5, output: 2.5, cacheRead: 0.2, cacheWrite: 0 }, // cursor.com, Standard
  'gemini-3-pro-preview-gemini-cli': { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
  'gemini-3.1-pro-preview': { input: 2, output: 12, cacheRead: 0.2, cacheWrite: 0 },
  'gpt-5.2-codex-xhigh': { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
  'gpt-5.3-codex-xhigh': { input: 1.75, output: 14, cacheRead: 0.175, cacheWrite: 0 },
  'gpt-5.4-xhigh': { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
  'gpt-5.5-pro': { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 }, // never caches; cacheRead moot
  // Cut from 5/30/0.5/6.25; gateway and models.dev vercel entry agree as of
  // 2026-08-26. OpenAI-direct lists 4/20/0.4/5 (8/30 over 200k context), but
  // these runs bill at the gateway rate.
  'gpt-5.6-sol-ultra': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'kimi-k2.5': { input: 0.6, output: 3, cacheRead: 0.1, cacheWrite: 0 },
  'kimi-k2.6': { input: 0.95, output: 4, cacheRead: 0.16, cacheWrite: 0 },
  'kimi-k2.7-code': { input: 0.95, output: 4, cacheRead: 0.19, cacheWrite: 0 },
  'kimi-k3': { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 },
  'glm-5.1-opencode': { input: 1.4, output: 4.4, cacheRead: 0.26, cacheWrite: 0 },
  // Cut from 1.4/4.4/0.26 (zai's own rate); gateway and models.dev vercel
  // entry agree as of 2026-08-26.
  'glm-5.2': { input: 0.8, output: 2.55, cacheRead: 0.16, cacheWrite: 0 },
  'grok-4.5': { input: 2, output: 6, cacheRead: 0.3, cacheWrite: 0 },
  'grok-4.6': { input: 2, output: 6, cacheRead: 0.5, cacheWrite: 0 }, // same in/out as 4.5, pricier cache reads
  'minimax-m2.7': { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0.375 },
  'minimax-m3': { input: 0.3, output: 1.2, cacheRead: 0.06, cacheWrite: 0 },
};

/** USD for one run at the given list price. */
export function priceUsage(u: Usage, p: Pricing): number {
  return (
    (u.input * p.input +
      u.output * p.output +
      u.cacheRead * p.cacheRead +
      u.cacheWrite * p.cacheWrite) /
    1_000_000
  );
}

const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

function parseLines(raw: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      events.push(JSON.parse(t));
    } catch {
      // skip non-JSON lines
    }
  }
  return events;
}

/**
 * Extract normalized token usage from one run's raw transcript. Returns null
 * if the transcript carries no usage (e.g. a timed-out run saves none, and the
 * old Cursor CLI never wrote any).
 *
 * The format is sniffed from event shape rather than passed in, so it stays
 * correct as harnesses are added:
 * - codex: one `turn.completed` with cumulative usage; input_tokens includes
 *   cached_input_tokens, so uncached input = input_tokens - cached.
 * - opencode: per `step-finish` part; reasoning tokens billed as output.
 * - claude-code: one API response spans several content-block events that
 *   repeat the same message.id + usage — dedupe by id (max per field) or it
 *   double-counts (~2.5x). input_tokens excludes cache.
 * - gemini: final `result.stats` (input excludes cache; cached separate).
 * - cursor: final `result.usage` with inputTokens/outputTokens/cacheReadTokens.
 */
export function extractRunTokens(raw: string): Usage | null {
  const events = parseLines(raw);
  const u: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  let got = false;
  const claudeById = new Map<string, Usage>();

  for (const d of events) {
    const type = d.type as string | undefined;

    if (type === 'turn.completed' && d.usage) {
      const x = obj(d.usage);
      const cached = num(x.cached_input_tokens);
      u.input += num(x.input_tokens) - cached;
      u.cacheRead += cached;
      u.output += num(x.output_tokens);
      got = true;
    } else if (type === 'step_finish' && d.part) {
      const p = obj(d.part);
      if (p.type === 'step-finish') {
        const tk = obj(p.tokens);
        const c = obj(tk.cache);
        u.input += num(tk.input);
        u.output += num(tk.output) + num(tk.reasoning);
        u.cacheRead += num(c.read);
        u.cacheWrite += num(c.write);
        got = true;
      }
    } else if (type === 'assistant') {
      const msg = obj(d.message);
      const x = msg.usage ? obj(msg.usage) : undefined;
      if (x) {
        got = true;
        const mid = (msg.id as string) ?? String(claudeById.size);
        const prev = claudeById.get(mid) ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        claudeById.set(mid, {
          input: Math.max(prev.input, num(x.input_tokens)),
          cacheRead: Math.max(prev.cacheRead, num(x.cache_read_input_tokens)),
          cacheWrite: Math.max(prev.cacheWrite, num(x.cache_creation_input_tokens)),
          output: Math.max(prev.output, num(x.output_tokens)),
        });
      }
    } else if (type === 'result') {
      const stats = obj(d.stats);
      const usage = obj(d.usage);
      if (stats.input_tokens !== undefined) {
        return {
          input: num(stats.input),
          cacheRead: num(stats.cached),
          cacheWrite: 0,
          output: num(stats.output_tokens),
        };
      }
      if (usage.inputTokens !== undefined) {
        // Cursor: inputTokens is uncached; cacheReadTokens is separate.
        u.input += num(usage.inputTokens);
        u.cacheRead += num(usage.cacheReadTokens);
        u.cacheWrite += num(usage.cacheWriteTokens);
        u.output += num(usage.outputTokens);
        got = true;
      }
    }
  }

  if (claudeById.size > 0) {
    for (const mu of claudeById.values()) {
      u.input += mu.input;
      u.output += mu.output;
      u.cacheRead += mu.cacheRead;
      u.cacheWrite += mu.cacheWrite;
    }
  }

  return got ? u : null;
}
