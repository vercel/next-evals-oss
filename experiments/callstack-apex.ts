import type { ExperimentConfig } from '@vercel/agent-eval';
import { isNextApp } from '../lib/setup.js';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  evals: process.env.EVAL_FILTER ?? '*',
  // Callstack Apex went GA on 2026-10-01; Callstack says it is the model that
  // ran on AI Gateway in stealth as Pixel Canary. `stealth/pixel-canary` is no
  // longer in the AI Gateway catalog, and `callstack/apex` is (/v1/models,
  // 2026-10-10): 262144 context, 131072 max output, text+image input,
  // reasoning, tool calling, temperature. It postdates the catalog snapshot in
  // the pinned OpenCode binary, so it is fully specified below. No effort pin:
  // the catalog lists none/low/medium/xhigh, but OpenCode does not forward a
  // working effort control on the gateway path, so publish the provider
  // default, unsuffixed, like the other OpenCode rows.
  model: 'vercel/callstack/apex',
  agentOptions: {
    binaryUrl:
      'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-RCtfS54uaTwa5i9C3bpzguLy3jEBP6',
    extraProviders: {
      vercel: {
        models: {
          'callstack/apex': {
            name: 'Apex',
            reasoning: true,
            tool_call: true,
            temperature: true,
            attachment: true,
            modalities: { input: ['text', 'image'], output: ['text'] },
            limit: { context: 262144, output: 131072 },
            cost: { input: 0, output: 0, cache_read: 0 },
          },
        },
      },
    },
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  // Same budget as pixel-canary, whose successful tasks took up to 20 minutes.
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
        small_model: 'vercel/callstack/apex'
      }), { mode: 0o600 });
    `]);
    if (settings.exitCode !== 0) throw new Error('Failed to configure OpenCode.');

    // Framework-choice fixtures start empty; hand them nothing.
    if (!(await isNextApp(sandbox))) return;
    const install = await sandbox.runCommand('npm', ['install', 'next@canary']);
    if (install.exitCode !== 0) throw new Error('Failed to install Next.js canary in the eval sandbox.');
  },
};

export default config;
