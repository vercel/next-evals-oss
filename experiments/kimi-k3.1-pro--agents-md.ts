import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway, matching kimi-k3. Kimi Code is not a harness in
  // agent-eval; the gateway serves `moonshotai/kimi-k3.1-pro`.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/moonshotai/kimi-k3.1-pro',
  agentOptions: {
    // The pinned OpenCode binary predates Kimi K3.1 Pro (2026-10-23), so
    // declare the model metadata instead of relying on its bundled models.dev
    // snapshot. Limits and modalities from the AI Gateway catalog, 2026-10-24.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'moonshotai/kimi-k3.1-pro': {
            name: 'Kimi K3.1 Pro',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: {
              input: ['text', 'image'],
              output: ['text'],
            },
            limit: { context: 1048576, output: 1048576 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
    // No effort suffix: OpenCode does not send a working reasoning-effort
    // setting on this path, so the model runs at its default (see "Effort has
    // no working knob on the OpenCode path").
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // kimi-k3 uses 1200, but K3.1 Pro is a larger reasoning model and a tight
  // timeout cannot be re-run away. Revisit after the first matrix's durations.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);

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
