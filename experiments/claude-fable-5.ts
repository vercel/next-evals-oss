import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  model: "claude-fable-5",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
  },
  scripts: ["build"],
  runs: 4,
  earlyExit: true,
  timeout: 1200,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand("npm", ["install", "next@canary"]);
  },
};

export default config;
