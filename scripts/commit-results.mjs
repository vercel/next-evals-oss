import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// GitHub signs commits created with its workflow token. Keep author and
// committer unset so the API uses the authenticated bot's identity.
export async function commitResults({ cwd, repository, branch, message, paths, request }) {
  if (!/^(automation\/measure-next-|v\/register-)/.test(branch)) {
    throw new Error("Results must be committed to a measurement or registration branch");
  }
  const git = (...args) => execFileSync("git", args, { cwd, maxBuffer: 128 * 1024 * 1024 });
  const head = git("rev-parse", "HEAD").toString().trim();
  const expectedTree = git("write-tree").toString().trim();
  const baseTree = git("rev-parse", "HEAD^{tree}").toString().trim();
  const prefix = `/repos/${repository}/git`;
  const ref = `${prefix}/refs/heads/${branch}`;
  let exists = true;
  try {
    const current = await request("GET", `${prefix}/ref/heads/${branch}`);
    if (current.object.sha !== head) throw new Error("Remote branch changed; refusing to replace its commits");
  } catch (error) {
    if (error.status !== 404 || !branch.startsWith("automation/measure-next-")) throw error;
    exists = false;
  }
  if (expectedTree === baseTree) return head;

  const fields = git("diff", "--cached", "--raw", "--no-abbrev", "--no-renames", "-z", "HEAD").toString().split("\0");
  const entries = [];
  for (let i = 0; i < fields.length - 1; i += 2) {
    const [, mode, , sha, status] = fields[i].slice(1).split(" ");
    const path = fields[i + 1];
    if (!paths.some((allowed) => path === allowed || path.startsWith(`${allowed}/`))) {
      throw new Error(`Unexpected staged result path: ${path}`);
    }
    if (!["A", "M"].includes(status) || mode !== "100644") {
      throw new Error(`Expected an added or updated regular result file: ${path}`);
    }
    entries.push({ path, mode, type: "blob", sha });
  }

  let tree = baseTree;
  let batch = [];
  let bytes = 0;
  const flush = async () => {
    if (!batch.length) return;
    tree = (await request("POST", `${prefix}/trees`, { base_tree: tree, tree: batch })).sha;
    batch = [];
    bytes = 0;
  };
  for (const entry of entries) {
    const contents = git("cat-file", "blob", entry.sha);
    const content = contents.toString("utf8");
    let value;
    if (!Buffer.from(content).equals(contents) || contents.length > 2 * 1024 * 1024) {
      const blob = await request("POST", `${prefix}/blobs`, { content: contents.toString("base64"), encoding: "base64" });
      value = { ...entry, sha: blob.sha };
    } else {
      const { sha, ...file } = entry;
      value = { ...file, content };
    }
    const size = Buffer.byteLength(JSON.stringify(value));
    if (batch.length >= 100 || bytes + size > 5 * 1024 * 1024) await flush();
    batch.push(value);
    bytes += size;
  }
  await flush();
  if (tree !== expectedTree) throw new Error("Uploaded results do not match the staged Git tree");

  const commit = await request("POST", `${prefix}/commits`, { message, tree, parents: [head] });
  if (!commit.verification?.verified) throw new Error("GitHub did not verify the results commit");
  // A concurrent push is rejected by the non-force update. No branch moves
  // until all result files are uploaded and the signature is verified.
  if (exists) {
    await request("PATCH", ref, { sha: commit.sha, force: false });
  } else {
    await request("POST", `${prefix}/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
  }
  return commit.sha;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [branch, message, ...paths] = process.argv.slice(2);
  try {
    if (!branch || !message || !paths.length || !process.env.GITHUB_REPOSITORY || !process.env.GH_TOKEN) {
      throw new Error("Usage: commit-results.mjs <branch> <message> <allowed-path> [...]; requires GITHUB_REPOSITORY and GH_TOKEN");
    }
    const sha = await commitResults({
      cwd: process.cwd(), repository: process.env.GITHUB_REPOSITORY, branch, message, paths,
      request: async (method, path, body) => {
        const response = await fetch(`https://api.github.com${path}`, {
          method, redirect: "error",
          headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
          // Do not expose the request body, credentials, or captured traces.
          throw Object.assign(new Error(`GitHub ${method} ${path} failed (${response.status})`), { status: response.status });
        }
        return response.json();
      },
    });
    console.log(`Verified results commit: ${sha}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
