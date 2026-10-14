import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

import type { ExperimentConfig, Sandbox } from "@vercel/agent-eval";

import { TIER_ONE_RELEASE_MATRIX } from "./tier-one.js";

const experimentsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "experiments",
);

test("every release experiment honors pass@1 and the exact Next.js version", async () => {
  const previousRuns = process.env.NEXT_RELEASE_EVAL_RUNS;
  const previousVersion = process.env.NEXT_EVAL_VERSION;
  process.env.NEXT_RELEASE_EVAL_RUNS = "1";
  process.env.NEXT_EVAL_VERSION = "16.2.4";

  try {
    for (const experiment of TIER_ONE_RELEASE_MATRIX) {
      const moduleUrl = pathToFileURL(
        join(experimentsDirectory, `${experiment}.ts`),
      );
      moduleUrl.searchParams.set("release-contract", experiment);
      const config = (await import(moduleUrl.href)).default as ExperimentConfig;

      assert.equal(config.runs, 1, `${experiment} must use pass@1`);
      assert.ok(config.setup, `${experiment} must define sandbox setup`);

      const commands: Array<{ command: string; args: string[] }> = [];
      const sandbox = {
        readFile: async (path: string) => {
          assert.equal(path, "package.json");
          return JSON.stringify({ dependencies: { next: "canary" } });
        },
        runCommand: async (command: string, args: string[]) => {
          commands.push({ command, args });
          return {
            exitCode: 0,
            stdout: command === "node" && args[0] === "-p" ? "16.2.4\n" : "",
            stderr: "",
          };
        },
        writeFiles: async () => {},
      } as unknown as Sandbox;

      await config.setup!(sandbox);
      assert.ok(
        commands.some(
          ({ command, args }) =>
            command === "npm" &&
            args[0] === "install" &&
            args[1] === "next@16.2.4",
        ),
        `${experiment} must install the exact release package`,
      );
    }
  } finally {
    if (previousRuns === undefined) delete process.env.NEXT_RELEASE_EVAL_RUNS;
    else process.env.NEXT_RELEASE_EVAL_RUNS = previousRuns;
    if (previousVersion === undefined) delete process.env.NEXT_EVAL_VERSION;
    else process.env.NEXT_EVAL_VERSION = previousVersion;
  }
});
