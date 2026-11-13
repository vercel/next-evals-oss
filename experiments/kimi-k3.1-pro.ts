import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // Kimi K3.1 Pro (Moonshot AI, 2026-10-23) is the successor to Kimi K3. It
  // postdates the catalog snapshot in the pinned OpenCode binary, so it is
  // fully specified below. AI Gateway catalog (/v1/models, 2026-10-26):
  // 1048576 context, 1048576 max output, text + image input, reasoning, tool
  // calling, temperature. No effort pin: the catalog lists low/high/max, but
  // OpenCode does not forward a working effort control on the gateway path,
  // so publish the provider default, unsuffixed, like the other OpenCode rows.
  model: 'vercel/moonshotai/kimi-k3.1-pro',
  agentOptions: {
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
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // Kimi K3 ran at 1200s, but K3.1 Pro is positioned for longer agent loops.
  // Start at the 2400s budget the current long-running OpenCode pairs use
  // (gemini-4-argon, minimax-m3) rather than raising it after a first matrix,
  // since timeout is part of the fingerprint.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
