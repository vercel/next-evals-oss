import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import {
  loadFixture,
  resolveConfig,
  runExperiment,
  computeFingerprint,
} from "@vercel/agent-eval";
const secrets = parse(readFileSync(process.env.EVAL_CREDENTIAL_FILE));
const apiKey = secrets.AI_GATEWAY_API_KEY;
if (!apiKey) throw new Error("Missing Gateway key");
if (!process.env.NEXT_CHECKOUT)
  throw new Error("Set NEXT_CHECKOUT to the pinned Next.js checkout");
const tasks = [
  "agent-031-proxy-middleware",
  "agent-040-instant",
  "agent-048-prefetch-url-data",
];
const pointer = `<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in \`node_modules/next/dist/docs/\` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
`;
async function checked(sandbox, cmd, args, root = false) {
  const result = await (root
    ? sandbox.runCommandAsRoot(cmd, args)
    : sandbox.runCommand(cmd, args));
  if (result.exitCode !== 0)
    throw new Error(`Setup ${cmd} failed: ${result.stderr.slice(-2000)}`);
}
for (const task of tasks)
  for (const condition of ["base", "agents-md"]) {
    const fixture = loadFixture(
      resolve(process.env.NEXT_CHECKOUT, "evals/evals"),
      task,
    );
    const config = resolveConfig({
      agent: "vercel-ai-gateway/codex",
      model: "openai/gpt-6-sol?reasoningEffort=high",
      runs: 3,
      earlyExit: false,
      scripts: ["build"],
      timeout: 1200,
      sandbox: "docker",
      copyFiles: "changed",
      setup: async (sandbox) => {
        await checked(sandbox, "npm", ["install", "next@16.4.6"]);
        const version = await sandbox.runCommand("node", [
          "-p",
          "require('next/package.json').version",
        ]);
        if (version.stdout.trim() !== "16.4.6")
          throw new Error("Wrong Next version");
        await sandbox.writeFiles({
          "__agent_eval__/next-test-utils.mjs": readFileSync(
            resolve(process.env.NEXT_CHECKOUT, "evals/lib/next-test-utils.mjs"),
            "utf8",
          ),
        });
        if (task !== "agent-031-proxy-middleware") {
          await checked(
            sandbox,
            "node",
            ["node_modules/playwright/cli.js", "install-deps", "chromium"],
            true,
          );
          await checked(sandbox, "npx", ["playwright", "install", "chromium"]);
          await checked(sandbox, "node", [
            "--input-type=module",
            "-e",
            "import {chromium} from '@playwright/test'; const b=await chromium.launch(); await b.close()",
          ]);
        }
        if (condition === "agents-md")
          await sandbox.writeFiles({
            "AGENTS.md": pointer,
            "CLAUDE.md": "@AGENTS.md\n",
            "GEMINI.md": "@AGENTS.md\n",
          });
      },
    });
    console.log("START", task, condition, new Date().toISOString());
    await runExperiment({
      config,
      fixtures: [fixture],
      apiKey,
      resultsDir: resolve("results"),
      experimentName: `sol-high-${condition}-${task}`,
      fingerprints: { [task]: computeFingerprint(fixture.path, config) },
      onProgress: (event) => {
        if (["attempt:complete", "experiment:complete"].includes(event.type))
          console.log(JSON.stringify(event));
      },
    });
    console.log("DONE", task, condition, new Date().toISOString());
  }
