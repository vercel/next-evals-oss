import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { findSecretLeaks } from "./assert-no-secrets.mjs";
import { createCiSandboxFetch } from "./ci-sandbox-fetch.mjs";
import { exchangeCiToken } from "./ci-token.mjs";

const sandboxUrl =
  "https://vercel.com/api/v2/sandboxes/sessions/test/fs/mkdir?teamId=team_test";
const initialToken = "test-initial-token";
function fixture(fetchImpl = async () => new Response("{}")) {
  let time = 1_000_000;
  let exchanges = 0;
  const env = {
    VERCEL_TOKEN: initialToken,
    VERCEL_AUTH_EXPIRES_AT: String(time + 600_000),
  };
  const fetch = createCiSandboxFetch({
    env,
    fetchImpl,
    now: () => time,
    exchange: async () => {
      exchanges++;
      return {
        accessToken: `test-renewed-${exchanges}`,
        expiresAt: time + 600_000,
      };
    },
  });
  return {
    fetch,
    env,
    advance: (ms) => {
      time += ms;
    },
    exchanges: () => exchanges,
  };
}
const auth = { authorization: `Bearer ${initialToken}` };

test("the existing artifact scanner sees every refreshed credential in later steps", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "eval-refresh-env-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const githubEnv = join(directory, "github-env");
  let clock = 1_000_000;
  let issued = 0;
  const fetch = createCiSandboxFetch({
    env: {
      VERCEL_TOKEN: initialToken,
      VERCEL_AUTH_EXPIRES_AT: "1",
      GITHUB_ENV: githubEnv,
    },
    now: () => clock,
    exchange: async () => {
      issued++;
      return {
        accessToken: `test-rotated-${issued}`,
        githubOidcToken: `test.identity.${issued}`,
        expiresAt: clock + 600_000,
      };
    },
    fetchImpl: async () => Response.json({}),
  });
  await fetch(sandboxUrl, { headers: auth });
  clock += 600_000;
  await fetch(sandboxUrl, { headers: auth });
  // GitHub loads this file into the next step, independent of the eval process.
  const nextStepEnv = Object.fromEntries(
    (await readFile(githubEnv, "utf8"))
      .trim()
      .split("\n")
      .map((line) => line.split("=")),
  );
  assert.equal(Object.keys(nextStepEnv).length, 4);
  assert.equal(nextStepEnv.VERCEL_TOKEN, undefined);
  const output = join(directory, "result.json");
  for (const credential of [
    "test-rotated-1",
    "test.identity.1",
    "test-rotated-2",
    "test.identity.2",
  ]) {
    await writeFile(output, JSON.stringify({ output: credential }));
    const leaks = findSecretLeaks([output], nextStepEnv);
    assert.equal(leaks.length, 1);
    assert.match(leaks[0].name, /^EVAL_REFRESHED_(OIDC_)?TOKEN_/);
  }
});

test("a failed environment write blocks using an unregistered refreshed token", async () => {
  const fetch = createCiSandboxFetch({
    env: {
      VERCEL_TOKEN: initialToken,
      VERCEL_AUTH_EXPIRES_AT: "1",
      GITHUB_ENV: "/nonexistent-evals-dir/github-env",
    },
    exchange: async () => ({
      accessToken: "test-new-token",
      githubOidcToken: "test.identity.1",
      expiresAt: Date.now() + 600_000,
    }),
    fetchImpl: async () => {
      throw new Error("must not send an unregistered token");
    },
  });
  await assert.rejects(fetch(sandboxUrl, { headers: auth }), /ENOENT/);
});

test("renews before expiry, sharing one exchange across concurrent Sandbox requests", async () => {
  const received = [];
  const f = fixture(async (_url, init) => {
    received.push(new Headers(init.headers).get("authorization"));
    assert.equal(init.redirect, "error");
    return new Response("{}");
  });
  await f.fetch(sandboxUrl, { headers: auth });
  f.advance(545_000);
  await Promise.all(
    Array.from({ length: 8 }, () => f.fetch(sandboxUrl, { headers: auth })),
  );
  assert.equal(f.exchanges(), 1);
  assert.deepEqual(received, [
    `Bearer ${initialToken}`,
    ...Array(8).fill("Bearer test-renewed-1"),
  ]);
  f.advance(600_000);
  await f.fetch(sandboxUrl, { headers: auth });
  assert.equal(received.at(-1), "Bearer test-renewed-2");
});

test("does not change Gateway, other origins, paths, or credentials", async () => {
  const calls = [];
  const f = fixture(async (input, init) => {
    calls.push([input, init]);
    return new Response("{}");
  });
  f.advance(600_000);
  for (const [url, headers] of [
    ["https://ai-gateway.vercel.sh/v1/messages", auth],
    ["https://vercel.com.attacker.test/api/v2/sandboxes", auth],
    ["https://vercel.com/api/v2/user", auth],
    [sandboxUrl, { authorization: "Bearer unrelated-token" }],
    [sandboxUrl, {}],
  ]) {
    const init = { headers, body: "unchanged", method: "POST" };
    await f.fetch(url, init);
    assert.equal(calls.at(-1)[1], init);
  }
  assert.equal(f.exchanges(), 0);
});

test("preserves Request bodies, signal and SDK transport options", async () => {
  const signal = new AbortController().signal;
  const dispatcher = {};
  const request = new Request(sandboxUrl, {
    method: "POST",
    headers: auth,
    body: "upload",
  });
  const f = fixture(async (input, init) => {
    assert.equal(input, request);
    assert.equal(await input.text(), "upload");
    assert.equal(init.signal, signal);
    assert.equal(init.dispatcher, dispatcher);
    assert.equal(init.headers.get("authorization"), "Bearer test-renewed-1");
    return new Response("{}");
  });
  f.advance(600_000);
  await f.fetch(request, { signal, dispatcher });
});

test("fails closed on exchange failure and never replays a denied command", async () => {
  let sends = 0;
  const f = fixture(async () => {
    sends++;
    return new Response("Not authorized", { status: 403 });
  });
  const result = await f.fetch(sandboxUrl, { headers: auth, method: "POST" });
  assert.equal(result.status, 403);
  assert.equal(sends, 1);
  assert.equal(f.exchanges(), 0);
  const expired = createCiSandboxFetch({
    env: { VERCEL_TOKEN: initialToken, VERCEL_AUTH_EXPIRES_AT: "1" },
    exchange: async () => {
      throw new Error("Token exchange denied");
    },
    fetchImpl: async () => {
      throw new Error("must not send an expired token");
    },
  });
  await assert.rejects(
    expired(sandboxUrl, { headers: auth }),
    /Token exchange denied/,
  );
});

test("uses the issuer's expires_in and reacquires the GitHub identity for each exchange", async () => {
  let oidcRequests = 0;
  const masked = [];
  const opts = {
    env: {
      ACTIONS_ID_TOKEN_REQUEST_URL: "https://github.test/oidc",
      ACTIONS_ID_TOKEN_REQUEST_TOKEN: "test-request",
      VERCEL_CLI_CLIENT_ID: "test-client",
      VERCEL_ORG_ID: "team_test",
    },
    now: () => 100_000,
    mask: (value) => masked.push(value),
    fetchImpl: async (url, init) => {
      if (url === "https://github.test/oidc") {
        oidcRequests++;
        return Response.json({ value: `test.identity.${oidcRequests}` });
      }
      assert.equal(url, "https://api.vercel.com/login/oauth/token");
      assert.equal(
        init.body.get("subject_token"),
        `test.identity.${oidcRequests}`,
      );
      assert.equal(init.body.get("team_id_or_slug"), "team_test");
      return Response.json({
        access_token: `test-access-${oidcRequests}`,
        expires_in: 120,
      });
    },
  };
  assert.equal((await exchangeCiToken(opts)).expiresAt, 220_000);
  await exchangeCiToken(opts);
  assert.equal(oidcRequests, 2);
  assert.deepEqual(masked, [
    "test.identity.1",
    "test-access-1",
    "test.identity.2",
    "test-access-2",
  ]);
  await assert.rejects(
    exchangeCiToken({
      ...opts,
      fetchImpl: async (url) =>
        Response.json(
          url === opts.env.ACTIONS_ID_TOKEN_REQUEST_URL
            ? { value: "test.identity.1" }
            : { access_token: "test-access" },
        ),
    }),
    /positive access token lifetime/,
  );
});

test("the installed Sandbox SDK keeps an existing instance usable beyond token expiry", async (t) => {
  const require = createRequire(import.meta.url);
  const { Sandbox } = await import(
    require.resolve("@vercel/sandbox", {
      paths: [dirname(require.resolve("@vercel/agent-eval"))],
    })
  );
  const received = [];
  const f = fixture(async (url, init) => {
    received.push(new Headers(init.headers).get("authorization"));
    if (new URL(url).pathname === "/api/v2/sandboxes") {
      return Response.json({
        sandbox: {
          name: "test",
          persistent: false,
          currentSessionId: "test",
          status: "running",
          createdAt: 0,
          updatedAt: 0,
        },
        session: {
          id: "test",
          memory: 2048,
          vcpus: 2,
          region: "iad1",
          timeout: 3600000,
          status: "running",
          requestedAt: 0,
          createdAt: 0,
          updatedAt: 0,
          cwd: "/vercel/sandbox",
        },
        routes: [],
      });
    }
    assert.match(new URL(url).pathname, /\/fs\/mkdir$/);
    return Response.json({});
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = f.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const sandbox = await Sandbox.create({
    token: initialToken,
    teamId: "team_test",
    projectId: "prj_test",
    runtime: "node22",
  });
  await sandbox.mkDir("before");
  f.advance(601_000);
  await sandbox.mkDir("after");
  f.advance(601_000);
  await sandbox.mkDir("after-again");
  assert.deepEqual(received, [
    `Bearer ${initialToken}`,
    `Bearer ${initialToken}`,
    "Bearer test-renewed-1",
    "Bearer test-renewed-2",
  ]);
});
