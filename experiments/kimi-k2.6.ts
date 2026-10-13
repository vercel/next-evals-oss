import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? "*",
  model: 'vercel/moonshotai/kimi-k2.6',
  agentOptions: {
    binaryUrl: 'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-kimi-k2.6-v1',
  },
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
