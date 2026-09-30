import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/fx',
  model: 'zai/glm-5.2',
  agentOptions: { effort: 'high' },
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
