import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? "*",
  model: 'vercel/minimax/minimax-m3',
  agentOptions: {
    binaryUrl: 'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-minimax-m3',
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // minimax-m3 serving is slow under current demand; heavy evals need a longer budget
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
