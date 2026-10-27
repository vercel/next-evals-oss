import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

async function createFixture(
  t,
  projectEnvironment = {
    VERCEL_OIDC_TOKEN: "test.oidc.token",
    AI_GATEWAY_API_KEY: "test-gateway-key",
  },
) {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-ci-auth-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const githubEnv = join(directory, "github-env");
  const mockFetch = join(directory, "mock-fetch.mjs");

  await writeFile(
    mockFetch,
    `import assert from 'node:assert/strict'
globalThis.fetch = async (url, init = {}) => {
  if (url === process.env.ACTIONS_ID_TOKEN_REQUEST_URL) {
    assert.equal(init.headers.authorization, 'bearer test-request-token')
    return new Response(JSON.stringify({ value: 'test.github.oidc' }))
  }
  if (url === 'https://api.vercel.com/login/oauth/token') {
    assert.equal(init.method, 'POST')
    const params = new URLSearchParams(init.body)
    assert.equal(params.get('grant_type'), 'urn:ietf:params:oauth:grant-type:token-exchange')
    assert.equal(params.get('client_id'), 'test-client-id')
    assert.equal(params.get('subject_token'), 'test.github.oidc')
    assert.equal(params.get('team_id_or_slug'), 'team_test')
    return new Response(JSON.stringify({ access_token: 'test-access-token' }))
  }
  assert.equal(
    url.toString(),
    'https://api.vercel.com/v3/env/pull/test-project/development?source=vercel-cli%3Aenv%3Apull&teamId=team_test',
  )
  assert.equal(init.headers.authorization, 'Bearer test-access-token')
  return new Response(JSON.stringify({ env: ${JSON.stringify(projectEnvironment)} }))
}
`,
  );

  return { githubEnv, mockFetch };
}

function runScript({ githubEnv, mockFetch }, extraEnv = {}) {
  return spawnSync(process.execPath, ["--import", mockFetch, script], {
    encoding: "utf8",
    env: {
      ...process.env,
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

test("exports project OIDC for Sandbox and GitHub OIDC for Eve", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test\.github\.oidc/);
  assert.match(result.stdout, /::add-mask::test-access-token/);
  assert.match(result.stdout, /::add-mask::test\.oidc\.token/);
  assert.equal(
    await readFile(fixture.githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test.oidc.token\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n",
  );
  assert.doesNotMatch(
    await readFile(fixture.githubEnv, "utf8"),
    /test-access-token/,
  );
});

test("normalizes whitespace in project credentials", async (t) => {
  const fixture = await createFixture(t, {
    VERCEL_OIDC_TOKEN: "\n test. oidc. token \r\n",
    AI_GATEWAY_API_KEY: "\n test-gateway-key \r\n",
  });
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readFile(fixture.githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test.oidc.token\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n" +
      "AI_GATEWAY_API_KEY=test-gateway-key\n",
  );
});

test("rejects a malformed project OIDC token", async (t) => {
  const fixture = await createFixture(t, {
    VERCEL_OIDC_TOKEN: "not-a-jwt",
    AI_GATEWAY_API_KEY: "test-gateway-key",
  });
  const result = runScript(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not provide a valid project OIDC JWT/);
});

test("exports the budgeted Gateway key when a job runs models", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-gateway-key/);
  assert.equal(
    await readFile(fixture.githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test.oidc.token\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n" +
      "AI_GATEWAY_API_KEY=test-gateway-key\n",
  );
});

test("fails model-running jobs without the budgeted Gateway key", async (t) => {
  const fixture = await createFixture(t, {
    VERCEL_OIDC_TOKEN: "test.oidc.token",
  });
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not provide.*AI_GATEWAY_API_KEY/);
});
