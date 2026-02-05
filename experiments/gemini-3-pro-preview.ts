import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/google/gemini-3-pro-preview',
  scripts: ['build'],
  runs: 1,
  earlyExit: true,
  sandbox: 'vercel',
};

export default config;
