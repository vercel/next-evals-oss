import type { ExperimentConfig } from "@vercel/agent-eval";
import { installNext, isNextApp } from "../lib/setup.js";
import { releaseEvalRuns } from "../lib/release-runs.js";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  evals: process.env.EVAL_FILTER ?? "*",
  // `openai/gpt-6.1-terra` is in the AI Gateway catalog (/v1/models, checked
  // 2026-10-28), which lists none/low/medium/high/xhigh/max, matching OpenAI's
  // model page. `high` follows the board's reasoning-effort policy.
  model: "openai/gpt-6.1-terra?reasoningEffort=high",
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
