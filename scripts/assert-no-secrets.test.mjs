import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { findSecretLeaks, sensitiveEnvironment } from "./assert-no-secrets.mjs";

test("selects credential-like environment values without treating public IDs as secrets", () => {
  assert.deepEqual(
    sensitiveEnvironment({
      VERCEL_OIDC_TOKEN: "private-token",
      CURSOR_API_KEY: "private-key",
      VERCEL_PROJECT_ID: "public-project-id",
      CI: "true",
    }),
    [
      ["VERCEL_OIDC_TOKEN", "private-token"],
      ["CURSOR_API_KEY", "private-key"],
    ],
  );
});

test("detects exact credential values in plain and compressed output", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-secret-scan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const plain = join(directory, "measurement.json");
  const compressed = join(directory, "results.tar.gz");
  await writeFile(plain, '{"value":"private-token"}');
  await writeFile(compressed, gzipSync("header private-key trailer"));

  assert.deepEqual(
    findSecretLeaks([directory], {
      VERCEL_OIDC_TOKEN: "private-token",
      CURSOR_API_KEY: "private-key",
    }),
    [
      { file: plain, name: "VERCEL_OIDC_TOKEN" },
      { file: compressed, name: "CURSOR_API_KEY" },
    ],
  );
});

test("does not flag unrelated sanitized output", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-secret-scan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const measurement = join(directory, "measurement.json");
  await writeFile(measurement, '{"passed":12,"total":14}');

  assert.deepEqual(
    findSecretLeaks([measurement], {
      VERCEL_OIDC_TOKEN: "private-token",
    }),
    [],
  );
});
