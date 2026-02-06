import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/moonshotai/kimi-k2.5',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  sandbox: 'vercel',
  timeout: 1200,
};

export default config;
