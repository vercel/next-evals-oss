import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'codex',
  model: 'gpt-5.3-codex-api-preview?reasoningEffort=xhigh',
  scripts: ['build'],
  runs: 3,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
};

export default config;
