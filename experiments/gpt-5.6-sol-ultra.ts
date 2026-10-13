import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext, isNextApp } from "../lib/setup.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  evals: process.env.EVAL_FILTER ?? '*',
  model: "openai/gpt-5.6-sol?reasoningEffort=ultra",
  scripts: ["build"],
  runs: 1,
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
