import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  // Mistral ships no first-party coding CLI this repo can run, so the model is
  // measured through OpenCode on the AI Gateway, like GLM, Kimi, and Grok.
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // Id verified against the live gateway on 2026-10-07: it resolves (the
  // request reaches provider selection) where a deliberately bogus
  // `mistral/mistral-large-4-nope` returns 404 model_not_found, so this is real
  // resolution and not a silent fallback.
  //
  // NOT YET RUNNABLE ON THIS TEAM. `mistral` is switched off in the team's AI
  // Gateway provider allowlist, and the gateway reports this model's only
  // candidate provider as `mistral` ("Available providers are: mistral" when
  // probed with providerOptions.gateway.only), so there is nothing to fall back
  // to and every request 403s with `no_providers_available`. The allowlist is a
  // team-owner, dashboard-only setting and applies to BYOK too, so it cannot be
  // worked around from a config. A team owner must enable `mistral` under AI
  // Gateway → Settings → Provider Allowlist before the matrix can be run.
  model: 'vercel/mistral/mistral-large-4',
  agentOptions: {
    // Mistral Large 4 postdates the catalog snapshot in this pinned OpenCode
    // binary, so specify it fully. AI Gateway catalog (2026-10-07), read off
    // /v1/models: 524288 context, 262144 max output, text/image input,
    // reasoning, tool calling, and temperature support.
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
    // No reasoning-effort pin: the catalog's reasoning_options confirm an
    // effort rung of none/low/medium/high (verified on /v1/models, 2026-10-07),
    // but OpenCode does not forward a working effort control on the AI
    // Gateway provider path. Publish the provider default, unsuffixed, like
    // the other OpenCode rows.
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // 2400s, matching every OpenCode pair that turned out to need headroom
  // (pixel-canary, minimax-m3, gemini-3.8-flash). This model has no duration
  // history to size a budget from, and nothing in this repo runs at 1800 — the
  // 1200 cluster (grok/kimi/glm) peaks at 440–1000s mean per eval, and glm-5.2
  // already sits at ~1000s against its 1200 ceiling, so 1800 is a guess
  // between clusters rather than a measurement. A reasoning model in public
  // preview is exactly the case that overruns it. Since a raise invalidates
  // the whole experiment and no results exist on disk yet, starting high is
  // free here and tightening later is cheap; the reverse is not.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    // Bump Next.js to latest canary
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
