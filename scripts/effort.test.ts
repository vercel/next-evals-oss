import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readEvalEffort, aggregateEffort } from "./effort.js";

const pricing = { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1.25 };

test("exports reported tokens including cache and retains missing-run coverage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eval-effort-"));
  try {
    await mkdir(join(dir, "run-1"));
    await writeFile(
      join(dir, "run-1/transcript-raw.jsonl"),
      JSON.stringify({
        type: "turn.completed",
        usage: {
          input_tokens: 1000,
          cached_input_tokens: 800,
          output_tokens: 50,
        },
      }),
    );
    await mkdir(join(dir, "run-2"));
    const result = await readEvalEffort(dir, 2, pricing);
    assert.deepEqual(result.tokenUsage, {
      inputTokens: 1000,
      outputTokens: 50,
      cacheReadTokens: 800,
      cacheWriteTokens: 0,
      measuredRuns: 1,
      totalRuns: 2,
    });
    assert.equal(result.costUsd, 0.00038);
    const unpriced = await readEvalEffort(dir, 2, null);
    assert.equal(unpriced.tokenUsage.inputTokens, 1000);
    assert.equal(unpriced.costUsd, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("keeps unreported tokens unknown rather than treating estimates as reported usage", async () => {
  const dir = await mkdtemp(join(tmpdir(), "eval-effort-"));
  try {
    await mkdir(join(dir, "run-1"));
    await writeFile(
      join(dir, "run-1/transcript-raw.jsonl"),
      JSON.stringify({
        type: "item.completed",
        item: {
          type: "agent_message",
          text: "Some text without provider token counts.",
        },
      }),
    );
    const result = await readEvalEffort(dir, 1, pricing);
    assert.equal(result.tokenUsage.inputTokens, null);
    assert.equal(result.tokenUsage.measuredRuns, 0);
    assert.equal(result.tokenUsage.totalRuns, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("includes failed attempts in effort, excludes unavailable placeholders, and preserves separate conditions", () => {
  const base = [
    {
      tokenUsage: {
        inputTokens: 1000,
        outputTokens: 50,
        cacheReadTokens: 800,
        cacheWriteTokens: 0,
        measuredRuns: 1,
        totalRuns: 2,
      },
      costUsd: 0.2,
      result: { duration: 2000 },
    },
    { notAvailable: true, result: { duration: 0 } },
  ];
  const docs = [
    {
      tokenUsage: {
        inputTokens: 500,
        outputTokens: 20,
        cacheReadTokens: 300,
        cacheWriteTokens: 0,
        measuredRuns: 1,
        totalRuns: 1,
      },
      costUsd: 0.1,
      result: { duration: 1000 },
    },
  ];
  assert.equal(aggregateEffort(base).avgInputTokens, 1000);
  assert.equal(aggregateEffort(base).avgDuration, 2);
  assert.equal(aggregateEffort(docs).avgInputTokens, 500);
  assert.equal(aggregateEffort([...base, ...docs]).avgInputTokens, 750);
  assert.equal(aggregateEffort(base).totalRuns, 2);
  assert.equal(aggregateEffort([]).avgInputTokens, null);
});
