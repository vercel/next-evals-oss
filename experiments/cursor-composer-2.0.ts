import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'cursor',
  model: 'composer-2',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
