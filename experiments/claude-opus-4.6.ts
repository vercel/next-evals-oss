import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  model: 'claude-opus-4-6',
  scripts: ['build'],
  runs: 3,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
};

export default config;
