import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'gemini',
  evals: process.env.EVAL_FILTER ?? "*",
  model: 'gemini-3-pro-preview',
  scripts: ['build'],
  runs: 1,
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
