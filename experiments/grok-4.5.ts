import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/xai/grok-4.5',
  agentOptions: {
    // grok-4.5 (released 2026-07-08) isn't in models.dev's `xai`/`vercel`
    // provider catalogs yet, so it can't be baked in — the model is fully
    // specified below via extraProviders (same approach as glm-5.2) and the
    // GLM 5.1 OpenCode binary is reused. Limits from the AI Gateway metadata
    // (context_window 500k).
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'xai/grok-4.5': {
            name: 'Grok 4.5',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image'], output: ['text'] },
            limit: { context: 500000, output: 131072 },
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
