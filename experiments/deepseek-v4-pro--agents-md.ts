import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  model: 'vercel/deepseek/deepseek-v4-pro',
  agentOptions: {
    // See deepseek-v4-pro.ts — model specified via extraProviders because it
    // isn't in models.dev's catalogs yet; GLM 5.1 OpenCode binary reused.
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
