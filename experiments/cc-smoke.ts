import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  evals: ['agent-031-proxy-middleware'],
  scripts: ['build'],
};

export default config;
