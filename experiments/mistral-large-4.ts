import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  // Mistral ships no first-party coding CLI this repo can run, so the model is
  // measured through OpenCode on the AI Gateway, like GLM, Kimi, and Grok.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/mistral/mistral-large-4',
  agentOptions: {
    // Mistral Large 4 postdates the catalog snapshot in this pinned OpenCode
    // binary, so specify it fully. AI Gateway catalog (2026-10-07): 524288
    // context, 262144 max output, text/image input, reasoning, tool calling,
    // and temperature support.
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
    // No reasoning-effort pin: the catalog advertises none/low/medium/high,
    // but OpenCode does not forward a working effort control on the AI
    // Gateway provider path. Publish the provider default, unsuffixed, like
    // the other OpenCode rows.
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // Unmeasured model: 1800 is a starting budget, not a measurement. Check the
  // first matrix's durations before re-running (see add-eval-model skill).
  timeout: 1800,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
