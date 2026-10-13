import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/codex",
  model: "openai/gpt-5.5-pro",
  scripts: ["build"],
  runs: 1,
  earlyExit: true,
  timeout: 1800,
  sandbox: "vercel",
  setup: async (sandbox) => {
    // Bump Next.js to latest canary
    await sandbox.runCommand("npm", ["install", "next@canary"]);
  },
};

export default config;
