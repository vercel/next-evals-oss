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

test("masks and exports the OIDC token and Cursor credential", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-ci-auth-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, "bin");
  const githubEnv = join(directory, "github-env");
  await mkdir(bin);

  const vercel = join(bin, "vercel");
  await writeFile(
    vercel,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
writeFileSync(process.argv[4], 'VERCEL_OIDC_TOKEN=test-oidc-token\\nCURSOR_API_KEY=test-cursor-key\\n')
if (process.argv.includes('--token') || process.argv.includes('--scope')) process.exit(2)
`,
  );
  await chmod(vercel, 0o755);

  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_ENV: githubEnv,
      VERCEL_TOKEN: "test-access-token",
      VERCEL_ORG_ID: "team_test",
      VERCEL_PROJECT_ID: "test-project",
      REQUIRE_CURSOR_API_KEY: "1",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-oidc-token/);
  assert.match(result.stdout, /::add-mask::test-cursor-key/);
  assert.equal(
    await readFile(githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test-oidc-token\nVERCEL_TOKEN=\nCURSOR_API_KEY=test-cursor-key\n",
  );
});

test("exports only OIDC when the job does not run Cursor", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-evals-ci-auth-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, "bin");
  const githubEnv = join(directory, "github-env");
  await mkdir(bin);

  const vercel = join(bin, "vercel");
  await writeFile(
    vercel,
    `#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
writeFileSync(process.argv[4], 'VERCEL_OIDC_TOKEN=test-oidc-token\\nCURSOR_API_KEY=test-cursor-key\\n')
if (process.argv.includes('--token') || process.argv.includes('--scope')) process.exit(2)
`,
  );
  await chmod(vercel, 0o755);

  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      GITHUB_ENV: githubEnv,
      VERCEL_TOKEN: "test-access-token",
      VERCEL_ORG_ID: "team_test",
      VERCEL_PROJECT_ID: "test-project",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /::add-mask::test-oidc-token/);
  assert.doesNotMatch(result.stdout, /test-cursor-key/);
  assert.equal(
    await readFile(githubEnv, "utf8"),
    "VERCEL_OIDC_TOKEN=test-oidc-token\nVERCEL_TOKEN=\n",
  );
});
