import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = join(dirname(fileURLToPath(import.meta.url)), "ci-auth.mjs");

test("fails before invoking Vercel when required values are missing", () => {
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing CI authentication values/);
});

async function createFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-ci-auth-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, "bin");
  const githubEnv = join(directory, "github-env");
  const mockFetch = join(directory, "mock-fetch.mjs");
  await mkdir(bin);

  const vercel = join(bin, "vercel");
  await writeFile(
    vercel,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
if (process.env.VERCEL_TOKEN !== 'test-access-token') process.exit(2)
if (process.env.VERCEL_ORG_ID !== 'team_test') process.exit(3)
if (process.argv.includes('--token') || process.argv.includes('--scope')) process.exit(4)
writeFileSync(process.argv[4], 'VERCEL_OIDC_TOKEN=test-oidc-token\\nCURSOR_API_KEY=test-cursor-key\\n')
`,
  );
  await chmod(vercel, 0o755);

  await writeFile(
    mockFetch,
    `import assert from 'node:assert/strict'
globalThis.fetch = async (url, init = {}) => {
  if (url === process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    assert.equal(init.headers.authorization, 'bearer test-request-token')
    return new Response(JSON.stringify({ value: 'test-github-oidc-token' }))
  }
  assert.equal(url, 'https://api.vercel.com/login/oauth/token')
  assert.equal(init.method, 'POST')
  const params = new URLSearchParams(init.body)
  assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:token-exchange')
  assert.equal(params.get('client_id'), 'test-client-id')
  assert.equal(params.get('subject_token'), 'test-github-oidc-token')
  assert.equal(params.get('team_id_or_slug'), 'team_test')
  return new Response(JSON.stringify({ access_token: 'test-access-token' }))
}
`,
  );

  return { bin, githubEnv, mockFetch };
}

function runScript({ bin, githubEnv, mockFetch }, extraEnv = {}) {
  return spawnSync(process.execPath, ["--import", mockFetch, script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://github.example.test/oidc",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-request-token",
      GITHUB_ENV: githubEnv,
      VERCEL_CLI_CLIENT_ID: "test-client-id",
      VERCEL_ORG_ID: "team_test",
      VERCEL_PROJECT_ID: "test-project",
      ...extraEnv,
    },
  });
}

test("exchanges GitHub OIDC and exports the project credentials", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture, { REQUIRE_CURSOR_API_KEY: "1" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-github-oidc-token/);
  assert.match(result.stdout, /::add-mask::test-access-token/);
  assert.match(result.stdout, /::add-mask::test-oidc-token/);
  assert.match(result.stdout, /::add-mask::test-cursor-key/);
  assert.equal(
    await readFile(fixture.githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test-oidc-token\nVERCEL_TOKEN=\nCURSOR_API_KEY=test-cursor-key\n",
  );
});

test("exports only OIDC when the job does not run Cursor", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-oidc-token/);
  assert.doesNotMatch(result.stdout, /test-cursor-key/);
  assert.equal(
    await readFile(fixture.githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test-oidc-token\nVERCEL_TOKEN=\n",
  );
});
