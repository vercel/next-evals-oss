import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: "claude-code",
  evals: process.env.EVAL_FILTER ?? "*",
  model: "claude-opus-4-7",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    effort: "max",
  },
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
