import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext, isNextApp } from "../lib/setup.js";
import { releaseEvalRuns } from "../lib/release-runs.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  // The Gateway's Anthropic-compatible endpoint resolves this unprefixed id.
  model: "claude-opus-5.5",
  evals: process.env.EVAL_FILTER ?? "*",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    // The board publishes a representative effort, rather than the ceiling.
    effort: "high",
  },
  scripts: ["build"],
  runs: releaseEvalRuns(),
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
