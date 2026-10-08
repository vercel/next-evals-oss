import type { ExperimentConfig } from "@vercel/agent-eval";
import { isNextApp } from "../lib/setup.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  evals: process.env.EVAL_FILTER ?? "*",
  // `openai/gpt-6.1-sol` is in the AI Gateway catalog (/v1/models,
  // 2026-10-07), which lists low/medium/high/xhigh/max. `high` follows the
  // board's reasoning-effort policy. Confirm the rung with the 400 probe in
  // the README before running the matrix.
  model: "openai/gpt-6.1-sol?reasoningEffort=high",
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await sandbox.runCommand("npm", ["install", "next@canary"]);
  },
};

export default config;
