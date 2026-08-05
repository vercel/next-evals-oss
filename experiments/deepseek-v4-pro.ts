import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/deepseek/deepseek-v4-pro',
  agentOptions: {
    // deepseek-v4-pro isn't in models.dev's `deepseek`/`vercel` provider
    // catalogs yet, so it can't be baked in — the model is fully specified
    // below via extraProviders (same approach as kimi-k3 / grok-4.5) and the
    // GLM 5.1 OpenCode binary is reused. Limits and modalities from the AI
    // Gateway metadata (context_window 1048600, text-only input).
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'deepseek/deepseek-v4-pro': {
            name: 'DeepSeek V4 Pro',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: false,
            modalities: { input: ['text'], output: ['text'] },
            limit: { context: 1048600, output: 131072 },
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
