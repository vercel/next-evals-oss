import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "codex",
  model: "gpt-5.6-sol?reasoningEffort=xhigh",
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
