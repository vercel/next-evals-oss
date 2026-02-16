import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'claude-code',
  model: 'claude-sonnet-4-5',
  scripts: ['build'],
  runs: 2,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@16.2.0-canary.41']);

    // Create AGENTS.md at the root
    await sandbox.writeFiles({
      'AGENTS.md': `<!-- BEGIN:nextjs-agent-rules -->
# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in \`node_modules/next/dist/docs/\`. Your training data is outdated — the docs are the source of truth.
<!-- END:nextjs-agent-rules -->
`,
      'CLAUDE.md': '@AGENTS.md\n',
    });
  },
};

export default config;
