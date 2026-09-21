import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // Canonical AI Gateway id. Both this and the legacy xai/grok-4.7 alias
  // resolve to spacexai/grok-4.7, but the catalog publishes this spelling.
  model: 'vercel/spacexai/grok-4.7',
  agentOptions: {
    // Grok 4.7 postdates the catalog snapshot in this pinned OpenCode binary,
    // so specify it fully instead of depending on bundled model metadata.
    // The Gateway catalog reports a 500k context window, text/image input,
    // reasoning, tool calling, and temperature support. As with Grok 4.6,
    // output is capped at 131072 rather than mirroring the context window.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'spacexai/grok-4.7': {
            name: 'Grok 4.7',
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
    // No reasoning-effort pin: OpenCode does not forward a working effort
    // control on the AI Gateway provider path. Publish the provider default,
    // unsuffixed, like the existing Grok, Kimi, GLM, and MiniMax rows.
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
