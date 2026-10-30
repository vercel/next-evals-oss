import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { commitResults } from "./commit-results.mjs";

function fixture(t, { exists = false, verified = true, race = false } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "signed-results-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const git = (args, input, extraEnv = {}) =>
    execFileSync("git", args, {
      cwd,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Test",
        GIT_AUTHOR_EMAIL: "test@example.test",
        GIT_COMMITTER_NAME: "Test",
        GIT_COMMITTER_EMAIL: "test@example.test",
        ...extraEnv,
      },
    }).trim();
  git(["init", "--quiet"]);
  writeFileSync(join(cwd, "existing.txt"), "untouched\n");
  git(["add", "."]);
  git([
    "-c",
    "commit.gpgsign=false",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "-m",
    "Initial",
  ]);
  const head = git(["rev-parse", "HEAD"]);
  let remote = exists ? head : undefined;
  const calls = [];
  const request = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === "GET") {
      if (!remote) throw Object.assign(new Error("missing"), { status: 404 });
      return { object: { sha: remote } };
    }
    if (path.endsWith("/blobs")) {
      return {
        sha: git(
          ["hash-object", "-w", "--stdin"],
          Buffer.from(body.content, "base64"),
        ),
      };
    }
    if (path.endsWith("/trees")) {
      const env = { GIT_INDEX_FILE: join(cwd, ".git", "api-index") };
      git(["read-tree", body.base_tree], undefined, env);
      for (const entry of body.tree) {
        const sha =
          entry.sha || git(["hash-object", "-w", "--stdin"], entry.content);
        git(
          ["update-index", "--add", "--cacheinfo", entry.mode, sha, entry.path],
          undefined,
          env,
        );
      }
      return { sha: git(["write-tree"], undefined, env) };
    }
    if (path.endsWith("/commits")) {
      assert.equal(body.parents[0], head);
      assert.equal(body.author, undefined);
      assert.equal(body.committer, undefined);
      const sha = git([
        "-c",
        "commit.gpgsign=false",
        "commit-tree",
        body.tree,
        "-p",
        head,
        "-m",
        body.message,
      ]);
      if (race) remote = "a".repeat(40);
      return { sha, verification: { verified } };
    }
    if (method === "PATCH") {
      assert.equal(body.force, false);
      if (remote !== head) throw new Error("not a fast-forward");
      remote = body.sha;
      return {};
    }
    if (path.endsWith("/refs")) {
      if (remote) throw new Error("ref exists");
      remote = body.sha;
      return {};
    }
    throw new Error(`Unexpected API request: ${method} ${path}`);
  };
  const run = (
    paths,
    branch = exists ? "v/register-test" : "automation/measure-next-test",
  ) =>
    commitResults({
      cwd,
      repository: "example/evals",
      branch,
      message: "Record results",
      paths,
      request,
    });
  return { cwd, git, head, calls, run, remote: () => remote };
}

test("uploads staged results byte-for-byte in bounded batches, then creates one verified commit", async (t) => {
  const f = fixture(t);
  const paths = [];
  for (let i = 0; i < 105; i++) {
    paths.push(`trace-${i}.txt`);
    writeFileSync(join(f.cwd, paths.at(-1)), `unicode å ${i} \n\n`);
  }
  paths.push("trace.gz", "large.txt");
  writeFileSync(join(f.cwd, "trace.gz"), Buffer.from([0x1f, 0x8b, 0xff, 0x00]));
  writeFileSync(join(f.cwd, "large.txt"), "x".repeat(3 * 1024 * 1024));
  f.git(["add", ...paths]);
  writeFileSync(join(f.cwd, "trace-0.txt"), "unstaged change");
  const expectedTree = f.git(["write-tree"]);
  const sha = await f.run(paths);
  assert.equal(f.remote(), sha);
  assert.equal(f.git(["rev-parse", `${sha}^{tree}`]), expectedTree);
  assert.equal(f.git(["rev-parse", "HEAD"]), f.head);
  assert.equal(f.calls.filter((c) => c.path.endsWith("/commits")).length, 1);
  assert.equal(f.calls.filter((c) => c.path.endsWith("/trees")).length, 2);
  assert.equal(f.calls.filter((c) => c.path.endsWith("/blobs")).length, 2);
});

test("updates an existing registration branch without force or rewriting other files", async (t) => {
  const f = fixture(t, { exists: true });
  writeFileSync(join(f.cwd, "agent-results.json"), "{}\n");
  f.git(["add", "agent-results.json"]);
  const sha = await f.run(["agent-results.json"]);
  assert.equal(f.remote(), sha);
  assert.equal(f.git(["show", `${sha}:existing.txt`]), "untouched");
  assert.equal(f.calls.at(-1).method, "PATCH");
  assert.equal(
    await f.run(["agent-results.json"]).catch((e) => e.message),
    "Remote branch changed; refusing to replace its commits",
  );
});

test("does not move a branch when GitHub does not verify the signature", async (t) => {
  const f = fixture(t, { exists: true, verified: false });
  writeFileSync(join(f.cwd, "result.txt"), "result");
  f.git(["add", "result.txt"]);
  await assert.rejects(f.run(["result.txt"]), /did not verify/);
  assert.equal(f.remote(), f.head);
  assert.ok(!f.calls.some((c) => c.method === "PATCH"));
});

test("a concurrent push cannot be overwritten", async (t) => {
  const f = fixture(t, { exists: true, race: true });
  writeFileSync(join(f.cwd, "result.txt"), "result");
  f.git(["add", "result.txt"]);
  await assert.rejects(f.run(["result.txt"]), /not a fast-forward/);
  assert.equal(f.remote(), "a".repeat(40));
});

test("rejects unexpected files and symlinks before uploading result content", async (t) => {
  const f = fixture(t);
  writeFileSync(join(f.cwd, "unrelated.txt"), "unexpected");
  f.git(["add", "unrelated.txt"]);
  await assert.rejects(f.run(["results"]), /Unexpected staged result path/);
  f.git(["reset", "--quiet"]);
  symlinkSync("existing.txt", join(f.cwd, "link"));
  f.git(["add", "link"]);
  await assert.rejects(f.run(["link"]), /regular result file/);
  assert.ok(f.calls.every((c) => c.method === "GET"));
});

test("does not recreate a deleted registration branch or write to main", async (t) => {
  const f = fixture(t);
  await assert.rejects(f.run(["results"], "v/register-deleted"), /missing/);
  await assert.rejects(
    f.run(["results"], "main"),
    /measurement or registration branch/,
  );
});

test("unchanged results do not create a commit", async (t) => {
  const f = fixture(t, { exists: true });
  assert.equal(await f.run(["results"]), f.head);
  assert.equal(f.calls.length, 1);
});
