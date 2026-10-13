import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  model: "openai/gpt-5.5-pro",
  scripts: ["build"],
  runs: 1,
  earlyExit: true,
  timeout: 1800,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
