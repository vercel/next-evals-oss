import type { ExperimentConfig } from "@vercel/agent-eval";

const config: ExperimentConfig = {
  agent: "vercel-ai-gateway/claude-code",
  model: "claude-fable-5",
  agentOptions: {
    cliPackage: "@anthropic-ai/claude-code@next",
    // Explicit, but identical to the CLI default for Fable 5 — existing
    // results were produced at this effort and remain valid (refingerprinted).
    effort: "high",
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
