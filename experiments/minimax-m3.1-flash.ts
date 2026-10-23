import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway, matching minimax-m3. MiniMax's own CLI is not a
  // harness in agent-eval; the gateway serves `minimax/minimax-m3.1-flash`.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/minimax/minimax-m3.1-flash',
  agentOptions: {
    // The pinned OpenCode binary predates MiniMax M3.1 Flash (2026-10-19), so
    // declare the model metadata instead of relying on its bundled models.dev
    // snapshot. Limits and modalities from the AI Gateway catalog, 2026-10-23.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'minimax/minimax-m3.1-flash': {
            name: 'MiniMax M3.1 Flash',
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
    // No effort suffix: the gateway lists low..max, but OpenCode does not send
    // a working reasoning-effort setting on this path, so the model runs at its
    // default (see "Effort has no working knob on the OpenCode path").
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // Copied from minimax-m3; revisit after the first matrix's durations.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
