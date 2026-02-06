import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/deepseek/deepseek-v3.2',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  sandbox: 'vercel',
};

export default config;
