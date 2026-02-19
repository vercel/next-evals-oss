import type { ExperimentConfig } from '@vercel/agent-eval';
import {
  INSTANT_NAVIGATIONS_DOC,
  INSTANT_NAVIGATIONS_DOC_PATH,
} from './_shared/instant-navigations-doc.js';

const config: ExperimentConfig = {
  agent: 'claude-code',
  model: 'claude-opus-4-6',
  evals: ['agent-040-instant-navigations'],
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  setup: async (sandbox: any) => {
    // Install Chromium system dependencies (sandbox runs Amazon Linux 2023)
    await sandbox.runCommand('dnf', [
      'install', '-y',
      'nspr', 'nss', 'atk', 'at-spi2-atk', 'cups-libs', 'libdrm',
      'libxkbcommon', 'libXcomposite', 'libXdamage', 'libXfixes',
      'libXrandr', 'mesa-libgbm', 'alsa-lib', 'cairo', 'pango',
      'glib2', 'gtk3', 'libX11', 'libXext', 'libXcursor', 'libXi',
      'libXtst',
    ]);

    // Install deps FIRST so node_modules exists, then inject docs into it.
    // (The framework runs npm install after setup, but it's idempotent.)
    await sandbox.runCommand('npm', ['install']);

    // Inject AGENTS.md, CLAUDE.md, GEMINI.md, and instant navigation docs
    await sandbox.writeFiles({
      'AGENTS.md': `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`,
      'CLAUDE.md': '@AGENTS.md\n',
      'GEMINI.md': '@AGENTS.md\n',
      [INSTANT_NAVIGATIONS_DOC_PATH]: INSTANT_NAVIGATIONS_DOC,
    });
  },
};

export default config;
