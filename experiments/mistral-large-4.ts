import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway: Mistral Large 4 is served by the gateway and
  // has no dedicated harness in agent-eval.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // `mistral/mistral-large-4` is in the AI Gateway catalog (/v1/models,
  // checked 2026-10-29): 524288 context, 262144 max output, text and image
  // input, reasoning, tool calling, temperature.
  model: 'vercel/mistral/mistral-large-4',
  agentOptions: {
    // The pinned OpenCode binary predates Mistral Large 4, so declare the
    // model metadata instead of relying on its bundled models.dev snapshot.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'mistral/mistral-large-4': {
            name: 'Mistral Large 4',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image'], output: ['text'] },
            limit: { context: 524288, output: 262144 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
    // No effort suffix: the catalog lists none/high, but OpenCode does not
    // send a working reasoning-effort setting through this gateway path, so
    // the model runs at its default, like the other OpenCode rows.
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // 2400s, the budget every recent OpenCode pair ended up needing. A raise
  // invalidates the whole experiment, so start with the headroom.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
