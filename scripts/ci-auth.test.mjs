import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
Date.now = () => 1_000_000
globalThis.fetch = async (url, init = {}) => {
  assert.equal(init.redirect, 'error')
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
    return new Response(JSON.stringify({ access_token: 'test-access-token', expires_in: 600 }))
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

  return { githubEnv, mockFetch, directory };
}

function runScript({ githubEnv, mockFetch, directory }, extraEnv = {}) {
  return spawnSync(process.execPath, ["--import", mockFetch, script], {
    encoding: "utf8",
    env: {
      ...process.env,
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://github.example.test/oidc",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-request-token",
      GITHUB_ENV: githubEnv,
      RUNNER_TEMP: directory,
      VERCEL_CLI_CLIENT_ID: "test-client-id",
      VERCEL_ORG_ID: "team_test",
      VERCEL_PROJECT_ID: "test-project",
      ...extraEnv,
    },
  });
}

async function readExports(fixture) {
  const contents = await readFile(fixture.githubEnv, "utf8");
  const [history, ...exports] = contents.split("\n");
  assert.ok(history.startsWith("EVAL_REDACTION_FILE="));
  const file = history.slice("EVAL_REDACTION_FILE=".length);
  assert.ok(file.startsWith(fixture.directory + "/eval-redaction-"));
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  assert.equal(
    await readFile(file, "utf8"),
    "test.github.oidc\ntest-access-token\n",
  );
  return exports.join("\n");
}

test("exports short-lived Sandbox and workflow credentials", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test\.github\.oidc/);
  assert.match(result.stdout, /::add-mask::test-access-token/);
  assert.equal(
    await readExports(fixture),
    "VERCEL_TOKEN=test-access-token\n" +
      "VERCEL_TOKEN_EXPIRES_AT=1600000\n" +
      "VERCEL_CLI_CLIENT_ID=test-client-id\n" +
      "VERCEL_ORG_ID=team_test\n" +
      "VERCEL_TEAM_ID=team_test\n" +
      "VERCEL_PROJECT_ID=test-project\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n",
  );
});

test("normalizes surrounding whitespace in the Gateway credential", async (t) => {
  const fixture = await createFixture(t, {
    AI_GATEWAY_API_KEY: "\n test-gateway-key \r\n",
  });
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readExports(fixture),
    "VERCEL_TOKEN=test-access-token\n" +
      "VERCEL_TOKEN_EXPIRES_AT=1600000\n" +
      "VERCEL_CLI_CLIENT_ID=test-client-id\n" +
      "VERCEL_ORG_ID=team_test\n" +
      "VERCEL_TEAM_ID=team_test\n" +
      "VERCEL_PROJECT_ID=test-project\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n" +
      "AI_GATEWAY_API_KEY=test-gateway-key\n",
  );
});

test("exports the budgeted Gateway key when a job runs models", async (t) => {
  const fixture = await createFixture(t);
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-gateway-key/);
  assert.equal(
    await readExports(fixture),
    "VERCEL_TOKEN=test-access-token\n" +
      "VERCEL_TOKEN_EXPIRES_AT=1600000\n" +
      "VERCEL_CLI_CLIENT_ID=test-client-id\n" +
      "VERCEL_ORG_ID=team_test\n" +
      "VERCEL_TEAM_ID=team_test\n" +
      "VERCEL_PROJECT_ID=test-project\n" +
      "RELEASE_WORKFLOW_OIDC_TOKEN=test.github.oidc\n" +
      "AI_GATEWAY_API_KEY=test-gateway-key\n",
  );
});

test("fails model-running jobs without the budgeted Gateway key", async (t) => {
  const fixture = await createFixture(t, {});
  const result = runScript(fixture, { REQUIRE_AI_GATEWAY_API_KEY: "1" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /did not provide.*AI_GATEWAY_API_KEY/);
});
