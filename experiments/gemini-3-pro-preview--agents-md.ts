import fs from 'fs';
import path from 'path';
import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'gemini',
  model: 'gemini-3-pro-preview',
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@16.2.0-canary.41']);

    // Read the actual AGENTS.md from the next.js repo
    const agentsMdPath = path.join(process.cwd(), '..', '..', 'next.js', 'AGENTS.md');
    const agentsMdContent = fs.existsSync(agentsMdPath)
      ? fs.readFileSync(agentsMdPath, 'utf-8')
      : `# Next.js Development Guide\n\nThis is NOT the Next.js you know. APIs, conventions, and file structure may differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code.`;

    // Create documentation files at the root
    // AGENTS.md: for Claude and general documentation
    // GEMINI.md: symlink to AGENTS.md for Gemini models
    // CLAUDE.md: symlink to AGENTS.md for Claude models
    await sandbox.writeFiles({
      'AGENTS.md': agentsMdContent,
      'CLAUDE.md': '@AGENTS.md\n',
      'GEMINI.md': '@AGENTS.md\n',
    });
  },
};

export default config;
