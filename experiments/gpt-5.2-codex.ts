import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/openai/gpt-5.2-codex',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
};

export default config;
