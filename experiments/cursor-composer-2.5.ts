import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  agent: 'cursor',
  model: 'composer-2.5',
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Install the requested Next.js version
    await installNext(sandbox);
  },
};

export default config;
