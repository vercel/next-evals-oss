import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext } from '../lib/setup.js';
import { releaseEvalRuns } from "../lib/release-runs.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  model: "claude-sonnet-5",
  evals: process.env.EVAL_FILTER ?? "*",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
  },
  scripts: ["build"],
  runs: releaseEvalRuns(),
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
