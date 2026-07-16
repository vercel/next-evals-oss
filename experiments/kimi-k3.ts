import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/moonshotai/kimi-k3',
  agentOptions: {
    // Reuse the GLM 5.1 OpenCode binary. kimi-k3 isn't in models.dev's
    // `moonshotai`/`vercel` provider catalogs yet, so it can't be baked in —
    // instead the model is fully specified below via extraProviders. OpenCode
    // builds the model from config and routes it through the Vercel AI Gateway.
    // (Same approach as glm-5.2 / grok-4.5; prior kimi pins shipped dedicated
    // binaries, but a fresh gateway model has no baked-in entry.)
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'moonshotai/kimi-k3': {
            name: 'Kimi K3',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            limit: { context: 1000000, output: 131072 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
