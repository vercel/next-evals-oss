import type { ExperimentConfig } from '@vercel/agent-eval';
import { releaseEvalRuns } from '../lib/release-runs.js';
import { installNext, isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // MiniMax released M3.1 Flash on 2026-10-19 and calls MiniMax M3 its
  // predecessor. Measured through OpenCode on AI Gateway like minimax-m3,
  // because MiniMax Code has no agent-eval adapter. `minimax/minimax-m3.1-flash`
  // is in the AI Gateway catalog (/v1/models, 2026-10-20): 1000000 context,
  // 524288 max output, text and image input, reasoning, tool calling,
  // temperature. It postdates the pinned OpenCode binary's models.dev
  // snapshot, so it is fully specified below. No effort pin: the catalog lists
  // low/medium/high/xhigh/max, but OpenCode does not forward a working effort
  // control on the gateway path, so publish the provider default, unsuffixed,
  // like the other OpenCode rows.
  model: 'vercel/minimax/minimax-m3.1-flash',
  agentOptions: {
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
            limit: { context: 1000000, output: 524288 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // No durations exist for this model yet. minimax-m3 needed 2400s, and
  // timeout is part of the fingerprint, so start there.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
