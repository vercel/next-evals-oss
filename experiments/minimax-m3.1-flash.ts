import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway, like the other MiniMax pairs on the board.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/minimax/minimax-m3.1-flash',
  agentOptions: {
    // The pinned OpenCode binary predates MiniMax M3.1 Flash (released
    // 2026-10-19), so the model is fully specified here. Metadata mirrors the
    // AI Gateway catalog entry `minimax/minimax-m3.1-flash` as of 2026-10-25
    // (vision, tool use, reasoning; 1,048,576-token context and output limit).
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
            modalities: { input: ['text', 'image'], output: ['text'] },
            limit: { context: 1048576, output: 1048576 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
    // No effort suffix: OpenCode does not send a working reasoning-effort
    // setting through this gateway path, so the model runs at its default.
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // Same 2400s budget minimax-m3 needed under load.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
