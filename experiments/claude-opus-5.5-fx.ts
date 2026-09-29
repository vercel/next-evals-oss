import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/fx',
  // FX exposes model selection but not a reasoning-effort control, so this
  // measures the provider default rather than claiming the native row's high.
  model: 'anthropic/claude-opus-5.5',
  evals: process.env.EVAL_FILTER ?? '*',
  webResearch: true,
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
