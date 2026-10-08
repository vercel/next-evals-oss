import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // GLM 5.3 postdates the catalog snapshot in the pinned OpenCode binary, so
  // it is fully specified below. AI Gateway catalog (/v1/models, 2026-10-07):
  // 1000000 context, 1000000 max output, text-only input, reasoning, tool
  // calling, temperature. No effort pin: the catalog lists low/high/max (max
  // is Z.ai's default), but OpenCode does not forward a working effort control
  // on the gateway path, so publish the provider default, unsuffixed, like the
  // other OpenCode rows.
  model: 'vercel/zai/glm-5.3',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'zai/glm-5.3': {
            name: 'GLM 5.3',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: false,
            modalities: { input: ['text'], output: ['text'] },
            limit: { context: 1000000, output: 1000000 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // 2400s: glm-5.2 already peaks near its 1200s ceiling, and GLM 5.3 always
  // thinks (default effort max). A raise invalidates the whole experiment, so
  // start with the headroom every slow OpenCode pair ended up needing.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
