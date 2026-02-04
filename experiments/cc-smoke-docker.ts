import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  evals: ['agent-036-after-response'],
  scripts: ['build'],
  sandbox: 'docker',
};

export default config;
