import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/codex',
  evals: process.env.EVAL_FILTER ?? '*',
  // `openai/gpt-6-astra` is the id the AI Gateway serves (it is in
  // ai-gateway.vercel.sh/v1/models and in models.dev's `vercel` entry), so
  // Codex resolves real model metadata for it rather than the fallback that
  // sank the bogus gpt-5.6 runs.
  //
  // `high`, not the `max` ceiling: see "Reasoning effort" in the README. The
  // ladder the gateway accepts for this id is
  // none/minimal/low/medium/high/xhigh/max (its own 400 enumerates them), and
  // `high` is the rung people actually run Next.js work at. Publishing the
  // ceiling would price and rank the model on a setting nobody pays for.
  model: 'openai/gpt-6-astra?reasoningEffort=high',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // Same budget as the gpt-5.6-sol-ultra pair, and `high` is a cheaper rung
  // than the ceiling this pair used to sit on, so it has more headroom than
  // the number suggests.
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
