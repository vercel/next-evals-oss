import type { ExperimentConfig } from "@vercel/agent-eval";
import { isNextApp } from "../lib/setup.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  evals: process.env.EVAL_FILTER ?? "*",
  // The live AI Gateway catalog and API both resolve `openai/gpt-6-sol`.
  // `high`, rather than the `max` ceiling, follows the board's reasoning-
  // effort policy; the API advertises none/minimal/low/medium/high/xhigh/max.
  model: "openai/gpt-6-sol?reasoningEffort=high",
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
