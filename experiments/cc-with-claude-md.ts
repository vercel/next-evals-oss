import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,

  setup: async (sandbox) => {
    // Generate CLAUDE.md documentation before agent starts
    await sandbox.runCommand('npx', [
      '@next/codemod@canary',
      'agents-md',
      '--output',
      'CLAUDE.md'
    ]);
  },
};

export default config;
