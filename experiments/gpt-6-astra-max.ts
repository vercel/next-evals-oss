import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/codex',
  evals: process.env.EVAL_FILTER ?? '*',
  // `openai/gpt-6-astra` is the id the AI Gateway serves (it is in
  // ai-gateway.vercel.sh/v1/models and in models.dev's `vercel` entry), so
  // Codex resolves real model metadata for it rather than the fallback that
  // sank the bogus gpt-5.6 runs. Both catalogs list low/medium/high/xhigh/max
  // for it, so `max` is its ceiling — the same "publish the flagship GPT at
  // its top effort" choice as gpt-5.6-sol at ultra.
  model: 'openai/gpt-6-astra?reasoningEffort=max',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // Same budget as the gpt-5.6-sol-ultra pair. Worth watching on the first
  // full run: max effort on a new flagship may need the 2400 the old
  // gpt-5.6-xhigh docs variant did.
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
