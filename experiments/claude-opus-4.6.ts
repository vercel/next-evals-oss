import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  sandbox: 'vercel',
};

export default config;
