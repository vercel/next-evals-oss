import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  "sandbox-smoke.mjs",
);

test("fails before creating a Sandbox when credentials are missing", () => {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing Sandbox authentication values/);
});
