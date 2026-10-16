import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // Reflection released Beam 1.0 on 2026-10-16 (open weights, Apache 2.0,
  // coding and agentic focus). Reflection's own Rust harness has no agent-eval
  // adapter, so this measures it through OpenCode on AI Gateway, like the other
  // third-party rows. `reflection/beam` is in the AI Gateway catalog
  // (/v1/models, 2026-10-16): text in, text out, reasoning, tool calling,
  // temperature. The catalog's context field says 1048576, but its own
  // description and provider limits say 262144 context and 131072 output, so
  // the conservative pair is declared below. It postdates the catalog snapshot
  // in the pinned OpenCode binary, so it is fully specified. No effort pin: the
  // catalog lists low/medium/high/xhigh/max, but OpenCode does not forward a
  // working effort control on the gateway path, so publish the provider
  // default, unsuffixed, like the other OpenCode rows.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/reflection/beam',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'reflection/beam': {
            name: 'Beam 1.0',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: false,
            modalities: { input: ['text'], output: ['text'] },
            limit: { context: 262144, output: 131072 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // No durations exist for this model yet. Every OpenCode pair that needed
  // headroom landed on 2400s, and timeout is part of the fingerprint, so
  // raising it after a matrix invalidates the whole run. Start at 2400s.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
