import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "claude-code",
  model: "claude-opus-4-7",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    effort: "max",
  },
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  timeout: 720,
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
