/**
 * Tests for token extraction + pricing. Run with: pnpm test:cost
 *
 * The load-bearing case is claude-code dedupe: one API response is split across
 * content-block events that repeat the same message.id + usage, so summing
 * naively double-counts (~2.5x observed). Everything else is one golden fixture
 * per harness format.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRunTokens, priceUsage, MODEL_PRICING } from './cost.ts';

const jsonl = (...events: unknown[]): string =>
  events.map((e) => JSON.stringify(e)).join('\n');

test('codex: single turn.completed, input includes cached', () => {
  const raw = jsonl({
    type: 'turn.completed',
    usage: {
      input_tokens: 1000,
      cached_input_tokens: 800,
      output_tokens: 50,
      reasoning_output_tokens: 20,
    },
  });
  // uncached input = 1000 - 800; cacheRead = 800; output as reported (200 incl reasoning)
  assert.deepEqual(extractRunTokens(raw), {
    input: 200,
    output: 50,
    cacheRead: 800,
    cacheWrite: 0,
  });
});

test('opencode: sums step-finish parts, reasoning billed as output', () => {
  const raw = jsonl(
    { type: 'step_finish', part: { type: 'step-finish', tokens: { input: 10, output: 5, reasoning: 3, cache: { read: 100, write: 2 } } } },
    { type: 'step_finish', part: { type: 'step-finish', tokens: { input: 20, output: 7, reasoning: 0, cache: { read: 200, write: 0 } } } },
  );
  assert.deepEqual(extractRunTokens(raw), {
    input: 30,
    output: 15,
    cacheRead: 300,
    cacheWrite: 2,
  });
});

test('claude-code: dedupe repeated message.id (no double-count)', () => {
  const usage = {
    input_tokens: 1,
    output_tokens: 327,
    cache_read_input_tokens: 32176,
    cache_creation_input_tokens: 0,
  };
  // Same response emitted 4x (text block, tool_use block, ...), then a 2nd response.
  const raw = jsonl(
    { type: 'assistant', message: { id: 'gen_A', usage } },
    { type: 'assistant', message: { id: 'gen_A', usage } },
    { type: 'assistant', message: { id: 'gen_A', usage } },
    { type: 'assistant', message: { id: 'gen_A', usage } },
    { type: 'assistant', message: { id: 'gen_B', usage: { input_tokens: 2, output_tokens: 10, cache_read_input_tokens: 40000, cache_creation_input_tokens: 100 } } },
  );
  assert.deepEqual(extractRunTokens(raw), {
    input: 1 + 2,
    output: 327 + 10,
    cacheRead: 32176 + 40000,
    cacheWrite: 0 + 100,
  });
});

test('gemini: final result.stats (input excludes cache)', () => {
  const raw = jsonl({
    type: 'result',
    stats: { input_tokens: 95082, input: 18732, cached: 76350, output_tokens: 1072 },
  });
  assert.deepEqual(extractRunTokens(raw), {
    input: 18732,
    output: 1072,
    cacheRead: 76350,
    cacheWrite: 0,
  });
});

test('cursor: result.usage, inputTokens is uncached', () => {
  const raw = jsonl({
    type: 'result',
    usage: { inputTokens: 12280, outputTokens: 1976, cacheReadTokens: 114916, cacheWriteTokens: 0 },
  });
  assert.deepEqual(extractRunTokens(raw), {
    input: 12280,
    output: 1976,
    cacheRead: 114916,
    cacheWrite: 0,
  });
});

test('no usage (e.g. timeout) returns null', () => {
  assert.equal(extractRunTokens(''), null);
  assert.equal(extractRunTokens(jsonl({ type: 'result', subtype: 'success', is_error: false })), null);
});

test('priceUsage: cache-heavy Claude run', () => {
  // Fable 5 rates: 10 / 50 / 1 / 12.5 per 1M
  const cost = priceUsage(
    { input: 0, output: 20000, cacheRead: 1_000_000, cacheWrite: 200_000 },
    MODEL_PRICING['claude-fable-5']!,
  );
  // 20000*50 + 1e6*1 + 200000*12.5 = 1e6 + 1e6 + 2.5e6 = 4.5e6 tok-$ / 1e6 = $4.50
  assert.equal(cost, 4.5);
});

test('cursor-composer-1.5 is N/A (null price)', () => {
  assert.equal(MODEL_PRICING['cursor-composer-1.5'], null);
});
