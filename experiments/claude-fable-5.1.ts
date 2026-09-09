import type { ExperimentConfig } from "@vercel/agent-eval";
import { isNextApp } from "../lib/setup.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  // `claude-fable-5.1` is the id the AI Gateway serves — catalog entry
  // `anthropic/claude-fable-5.1`, reached through the gateway's Anthropic-
  // compatible endpoint the way `claude-fable-5` is. An id the gateway does not
  // know answers 404 `model_not_found` rather than silently resolving to a
  // fallback, so a 200 for this string is real resolution.
  model: "claude-fable-5.1",
  evals: process.env.EVAL_FILTER ?? "*",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    // `high`, not the ceiling — see "Reasoning effort" in the README. The rungs
    // the gateway accepts for this id are none/minimal/low/medium/high/xhigh/max
    // (its own 400 enumerates them), and `high` is the rung people run Next.js
    // work at.
    effort: "high",
  },
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  // Same budget as the claude-fable-5 pair. Fable-tier turns run long, so this
  // is the first number to revisit if runs start timing out rather than failing.
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand("npm", ["install", "next@canary"]);
  },
};

export default config;
