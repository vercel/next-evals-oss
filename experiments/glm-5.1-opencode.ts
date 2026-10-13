import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? "*",
  model: 'vercel/zai/glm-5.1',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'zai/glm-5.1': { name: 'GLM 5.1' },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 1,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
