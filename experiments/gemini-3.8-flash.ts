import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  // OpenCode over the AI Gateway, not the `gemini` (Gemini CLI) harness the
  // older Gemini pairs use: that harness is direct-Google-API only and reads
  // GEMINI_API_KEY, which is the same missing credential that keeps
  // gemini-3.1-pro-preview pinned to tier 2. The gateway serves this model, so
  // OpenCode is the harness that can actually produce a fresh measurement —
  // same path as the other gateway-served third-party models here (glm-5.2,
  // kimi-k3, grok-4.6, minimax-m3).
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // `google/gemini-3.8-flash` is the id the AI Gateway serves (it is in
  // ai-gateway.vercel.sh/v1/models and in models.dev's `vercel` entry, both
  // dated 2026-09-02). An id the gateway does not know answers
  // `model_not_found` rather than silently resolving to a fallback, so a 200
  // for this string is real resolution.
  model: 'vercel/google/gemini-3.8-flash',
  agentOptions: {
    // Reuse the pinned OpenCode binary the other gateway pairs use.
    // `google/gemini-3.8-flash` postdates the models.dev snapshot baked into
    // it, so the model is fully specified below via extraProviders and
    // OpenCode builds it from config instead. Metadata matches the gateway
    // catalog and the models.dev `vercel` entry: 1M context, 65,536 max
    // output. The two disagree on video input (the gateway lists it, the
    // models.dev `vercel` entry does not); the eval fixtures are text-only, so
    // the narrower set is recorded here.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'google/gemini-3.8-flash': {
            name: 'Gemini 3.8 Flash',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            limit: { context: 1000000, output: 65536 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
    // No reasoning-effort pin, and the board label carries no effort suffix.
    // The gateway catalog does advertise a low/medium/high ladder for this id,
    // and `high` would be the rung to publish at per "Reasoning effort" in the
    // README — but OpenCode has no working knob for it on this path. OpenCode
    // maps a model's `options` onto `providerOptions.gateway` for
    // `@ai-sdk/gateway` providers, and the gateway does not apply
    // `reasoningEffort` there: at `low` the model still spent ~1.4k reasoning
    // tokens on a probe prompt, where the same `low` sent as
    // `reasoning_effort` to /v1/chat/completions spends 0. So these runs are
    // at the provider default, exactly like every other OpenCode pair on the
    // board (kimi-k3, glm-5.2 and grok-4.6 all expose ladders and all publish
    // unpinned). Labelling the row `(high)` would assert a setting the harness
    // never sent.
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // 2400, not the 1200 the other current OpenCode pairs use. "Flash" is about
  // per-token speed, not about how long the agentic loop runs: the prefetch
  // evals land at 1000–1100s for this model, close enough to a 1200s ceiling
  // that normal variance tips over it. At 1200 the first matrix lost
  // agent-051 (base) and agent-049 (AGENTS.md) to timeouts, and a narrower
  // re-run at 4-way concurrency lost agent-051 again — so it was the budget,
  // not the burst. Timeouts are deleted rather than counted, which means a
  // ceiling this tight does not publish a wrong number, it just makes the
  // matrix impossible to finish. Same value as the minimax-m3 pair.
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
