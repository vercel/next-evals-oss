import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'cursor',
  model: 'composer-1.5',
  scripts: ['build'],
  runs: 3,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
};

export default config;
