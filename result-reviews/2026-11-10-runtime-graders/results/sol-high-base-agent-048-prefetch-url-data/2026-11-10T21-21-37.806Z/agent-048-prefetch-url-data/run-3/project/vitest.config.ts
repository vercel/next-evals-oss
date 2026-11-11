
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['EVAL.ts'],
    globals: false,
    // Agentic judge matchers spawn a full agent run in-sandbox; give them room.
    // The sandbox-level timeout is the real bound.
    testTimeout: 900000,
    hookTimeout: 900000,
    setupFiles: ['/home/sandbox/workspace/__agent_eval__/eval-helper.mjs'],
  },
  resolve: {
    alias: { '@vercel/agent-eval/eval': '/home/sandbox/workspace/__agent_eval__/eval-helper.mjs' },
  },
});
