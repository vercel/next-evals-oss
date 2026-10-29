import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
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
      VERCEL_TOKEN_EXPIRES_AT: "1793203626792",
      CI: "true",
    }),
    [
      ["VERCEL_OIDC_TOKEN", "private-token"],
      ["CURSOR_API_KEY", "private-key"],
    ],
  );
});

test("scans tokens issued in an earlier process, including expired rotations", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-rotation-scan-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const history = join(directory, "credentials.txt");
  await writeFile(history, "", { mode: 0o600 });
  const script = `
    import { exchangeCiToken } from ${JSON.stringify(new URL("./ci-token.mjs", import.meta.url).href)};
    let exchanges = 0;
    globalThis.fetch = async (url) => {
      if (url === process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
        exchanges++;
        return Response.json({value: 'test.identity.' + exchanges});
      }
      return Response.json({access_token: 'test-rotated-token-' + exchanges, expires_in: 600});
    };
    await exchangeCiToken();
    await exchangeCiToken();
  `;
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", script],
    {
      encoding: "utf8",
      env: {
        EVAL_REDACTION_FILE: history,
        ACTIONS_ID_TOKEN_REQUEST_URL: "https://github.test/oidc",
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-request-token",
        VERCEL_CLI_CLIENT_ID: "test-client",
        VERCEL_ORG_ID: "team_test",
      },
    },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /::add-mask::test-rotated-token-2/);
  assert.equal(
    await readFile(history, "utf8"),
    "test.identity.1\ntest-rotated-token-1\ntest.identity.2\ntest-rotated-token-2\n",
  );
  const plain = join(directory, "transcript.json");
  const compressed = join(directory, "results.tar.gz");
  await writeFile(plain, '{"output":"test-rotated-token-1"}');
  await writeFile(compressed, gzipSync("test.identity.2"));
  const env = { EVAL_REDACTION_FILE: history };
  assert.deepEqual(findSecretLeaks([plain, compressed], env), [
    { file: plain, name: "issued CI credential" },
    { file: compressed, name: "issued CI credential" },
  ]);
  // A later CI step does not inherit the eval process's updated environment.
  assert.deepEqual(findSecretLeaks([plain, compressed], {}), []);
});

test("missing credential history fails the artifact gate", () => {
  assert.throws(
    () =>
      findSecretLeaks([], {
        EVAL_REDACTION_FILE: "/nonexistent-next-evals-redaction-file",
      }),
    /ENOENT/,
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
