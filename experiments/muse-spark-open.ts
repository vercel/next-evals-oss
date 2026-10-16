import type { ExperimentConfig } from '@vercel/agent-eval';
import { installNext, isNextApp } from '../lib/setup.js';
import { releaseEvalRuns } from '../lib/release-runs.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway: Muse Spark Open is served by the gateway and
  // does not have a dedicated harness in agent-eval.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/meta/muse-spark-open',
  agentOptions: {
    // The pinned OpenCode binary predates Muse Spark Open, so declare the
    // model metadata instead of relying on its bundled models.dev snapshot.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'meta/muse-spark-open': {
            name: 'Muse Spark Open',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: {
              input: ['text', 'audio', 'image', 'video'],
              output: ['text'],
            },
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
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
