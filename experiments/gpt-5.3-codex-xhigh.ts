import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'codex',
  evals: process.env.EVAL_FILTER ?? "*",
  model: 'gpt-5.3-codex?reasoningEffort=xhigh',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
