import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/minimax/minimax-m2.1',
  evals: ['agent-025-prefer-next-link'],
  scripts: ['build'],
  sandbox: 'vercel',
};

export default config;
