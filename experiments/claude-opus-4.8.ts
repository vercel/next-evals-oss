import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: "claude-code",
  model: "claude-opus-4-8",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
  },
  scripts: ["build"],
  runs: 1,
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
