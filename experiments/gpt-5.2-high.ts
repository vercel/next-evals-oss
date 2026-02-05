import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/openai/gpt-5.2-codex',
  scripts: ['build'],
  runs: 1,
  earlyExit: true,
  sandbox: 'vercel',
};

export default config;
