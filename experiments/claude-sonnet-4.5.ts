import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  model: 'sonnet',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
};

export default config;
