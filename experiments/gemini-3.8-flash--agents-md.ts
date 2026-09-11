import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // See gemini-3.8-flash.ts — same harness, id and (unpinned) effort, the only
  // difference is the AGENTS.md pointer written below.
  model: 'vercel/google/gemini-3.8-flash',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'google/gemini-3.8-flash': {
            name: 'Gemini 3.8 Flash',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            limit: { context: 1000000, output: 65536 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // See gemini-3.8-flash.ts — 1200 loses the prefetch evals to timeouts.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);

    // Create AGENTS.md at the root
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
