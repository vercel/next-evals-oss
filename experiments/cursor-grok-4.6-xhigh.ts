import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'cursor',
  // Effort is baked into the Cursor CLI model id (no --effort / ?reasoningEffort).
  // Catalog ids: cursor-grok-4.6-{low,medium,high,xhigh}[+ -fast].
  model: 'cursor-grok-4.6-xhigh',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // Match grok-4.6 OpenCode / heavier non-Composer budgets; xhigh runs are slower.
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
