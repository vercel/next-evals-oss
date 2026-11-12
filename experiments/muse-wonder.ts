import type { ExperimentConfig } from '@vercel/agent-eval';
import { releaseEvalRuns } from '../lib/release-runs.js';
import { installNext, isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // Meta released Muse Wonder on 2026-10-12 on the Meta Model API and Muse
  // Code. Meta's own harness (Muse Code) has no agent-eval adapter, so this
  // measures it through OpenCode on AI Gateway, like the other non-Anthropic,
  // non-OpenAI rows. `meta/muse-wonder-1.0` is in the AI Gateway catalog
  // (/v1/models, 2026-10-13): 1048576 context, 1048576 max output, text, image
  // and PDF input, reasoning, tool calling, temperature. It postdates the
  // catalog snapshot in the pinned OpenCode binary, so it is fully specified
  // below. No effort pin: the catalog lists minimal/low/medium/high/xhigh, but
  // OpenCode does not forward a working effort control on the gateway path, so
  // publish the provider default, unsuffixed, like the other OpenCode rows.
  model: 'vercel/meta/muse-wonder-1.0',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'meta/muse-wonder-1.0': {
            name: 'Muse Wonder',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image', 'pdf'], output: ['text'] },
            limit: { context: 1048576, output: 1048576 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: releaseEvalRuns(),
  earlyExit: true,
  // No durations exist for this model yet. Every OpenCode pair that needed
  // headroom landed on 2400s (gemini-3.8-flash, minimax-m3, pixel-canary), and
  // timeout is part of the fingerprint, so raising it after a matrix
  // invalidates the whole run. Start at 2400s.
  timeout: 2400,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    // Global settings survive the harness writing its project-local opencode.json.
    const settings = await sandbox.runCommand('node', ['-e', `
      const fs = require('node:fs');
      const path = require('node:path');
      const os = require('node:os');
      const dir = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'opencode.json'), JSON.stringify({
        autoupdate: false,
        small_model: 'vercel/meta/muse-wonder-1.0'
      }), { mode: 0o600 });
    `]);
    if (settings.exitCode !== 0) throw new Error('Failed to configure OpenCode.');

    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    await installNext(sandbox);
  },
};

export default config;
