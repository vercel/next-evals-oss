import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "codex",
  model: "gpt-5.6?reasoningEffort=xhigh",
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  // 2400 over the usual 1200: with the docs pointer this model reasons
  // 1500-1950s on the hardest evals (agent-041) and times out at 1200.
  timeout: 2400,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand("npm", ["install", "next@canary"]);

    // Create AGENTS.md at the root
    await sandbox.writeFiles({
      "AGENTS.md": `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`,
      "CLAUDE.md": "@AGENTS.md\n",
      "GEMINI.md": "@AGENTS.md\n",
    });
  },
};

export default config;
