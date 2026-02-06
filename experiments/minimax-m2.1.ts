import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/minimax/minimax-m2.1',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  sandbox: 'vercel',
};

export default config;
