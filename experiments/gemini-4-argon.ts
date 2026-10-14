import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  // OpenCode over AI Gateway: the direct Gemini harness requires a separate
  // GEMINI_API_KEY, while this model is available through the gateway used by
  // the other current third-party rows.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/google/gemini-4-argon',
  agentOptions: {
    // The pinned OpenCode binary predates Argon, so declare the model metadata
    // explicitly instead of relying on its bundled models.dev snapshot.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'google/gemini-4-argon': {
            name: 'Gemini 4 Argon',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: {
              input: ['text', 'image', 'pdf', 'video'],
              output: ['text'],
            },
            limit: { context: 1000000, output: 1000000 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
    // No effort suffix: OpenCode does not send a working reasoning-effort
    // setting through this gateway path, so the model runs at its default.
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // The pass@1 smoke sweep reached roughly 16 minutes on its slowest valid
  // attempt, so leave the same headroom as the current Gemini Flash pair.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
