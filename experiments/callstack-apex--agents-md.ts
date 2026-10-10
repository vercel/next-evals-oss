import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // See callstack-apex.ts; only the AGENTS.md treatment below differs.
  model: 'vercel/callstack/apex',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'callstack/apex': {
            name: 'Apex',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image'], output: ['text'] },
            limit: { context: 262144, output: 131072 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Global settings survive the harness writing its project-local opencode.json.
    const settings = await sandbox.runCommand('node', ['-e', `
      const fs = require('node:fs');
      const path = require('node:path');
      const os = require('node:os');
      const dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
        autoupdate: false,
        small_model: 'vercel/callstack/apex'
      }), { mode: 0o600 });
    `]);
    if (settings.exitCode !== 0) throw new Error('Failed to configure OpenCode.');

    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    const install = await sandbox.runCommand('npm', ['install', 'next@canary']);
    if (install.exitCode !== 0) throw new Error('Failed to install Next.js canary in the eval sandbox.');

    await sandbox.writeFiles({
      'AGENTS.md': `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`,
      'CLAUDE.md': '@AGENTS.md\n',
      'GEMINI.md': '@AGENTS.md\n',
    });
  },
};

export default config;
