import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway, like every other Kimi pair on the board.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/moonshotai/kimi-k3.1-pro',
  agentOptions: {
    // The pinned OpenCode binary predates Kimi K3.1 Pro (released 2026-10-23),
    // so the model is fully specified here instead of relying on its bundled
    // models.dev snapshot. Metadata mirrors the AI Gateway catalog entry
    // `moonshotai/kimi-k3.1-pro` as of 2026-10-25 (vision, tool use,
    // reasoning; 1,048,576-token context and output limit).
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
  // 2400s rather than kimi-k3's 1200s: a raise invalidates the whole
  // experiment, so start with the headroom the slow OpenCode pairs needed.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
