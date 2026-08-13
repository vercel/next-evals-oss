import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/xai/grok-4.6',
  agentOptions: {
    // grok-4.6 (released 2026-08-12). models.dev does now carry it under both
    // `xai` and `vercel`, but it is still fully specified via extraProviders
    // (same as grok-4.5 / glm-5.2) so resolution never depends on the catalog
    // snapshot inside the pinned OpenCode binary, which is reused here.
    // Metadata below matches the AI Gateway + models.dev `vercel` entries:
    // text-only input (4.5 accepted image/pdf, 4.6 over the gateway does not),
    // context_window 500k. Output is capped at the same 131072 as grok-4.5
    // rather than the catalog's 500000, which just mirrors the context window.
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'xai/grok-4.6': {
            name: 'Grok 4.6',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: false,
            modalities: { input: ['text'], output: ['text'] },
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

    // Create AGENTS.md at the root
    await sandbox.writeFiles({
      'AGENTS.md': `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`,
      'CLAUDE.md': '@AGENTS.md\n',
      'GEMINI.md': '@AGENTS.md\n',
    });
  },
};

export default config;
