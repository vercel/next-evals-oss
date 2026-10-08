import type { ExperimentConfig } from "@vercel/agent-eval";
import { isNextApp } from "../lib/setup.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  // The Gateway's Anthropic-compatible endpoint resolves unprefixed ids, as
  // with claude-opus-5.5. `anthropic/claude-sonnet-5.5` is in the AI Gateway
  // catalog (/v1/models, 2026-10-07); live-API resolution still needs a
  // credentialed `pnpm preflight` + smoke run before the matrix.
  model: "claude-sonnet-5.5",
  evals: process.env.EVAL_FILTER ?? "*",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    // The catalog lists low/medium/high/xhigh/max; the board publishes
    // `high`, not the ceiling (README, "Reasoning effort").
    effort: "high",
  },
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
