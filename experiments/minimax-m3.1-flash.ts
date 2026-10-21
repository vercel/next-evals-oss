import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // MiniMax M3.1 Flash (2026-10-19) is the successor to MiniMax M3 and
  // postdates the catalog snapshot in the pinned OpenCode binary, so it is
  // fully specified below. AI Gateway catalog (/v1/models, 2026-10-21):
  // 1000000 context, 524288 max output, text + image input, always-on
  // reasoning, tool calling, temperature. The catalog lists an effort ladder
  // (low..max), but OpenCode does not forward a working effort control on the
  // gateway path, so publish the provider default, unsuffixed, like the other
  // OpenCode rows.
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
  // 2400s, the budget minimax-m3 needed. MiniMax claims ~3x faster serving,
  // but a raise invalidates the whole experiment, so keep the known-good
  // headroom rather than guessing lower.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
