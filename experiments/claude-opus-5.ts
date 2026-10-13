import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  model: "claude-opus-5",
  evals: process.env.EVAL_FILTER ?? "*",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
  },
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
