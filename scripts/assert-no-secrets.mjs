import { gunzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const sensitiveName = /(TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY|CREDENTIAL)/i;
const ignoredNames = new Set(["GPG_KEY", "VERCEL_ORG_ID", "VERCEL_PROJECT_ID"]);

export function sensitiveEnvironment(env = process.env) {
  return Object.entries(env).filter(
    ([name, value]) =>
      !ignoredNames.has(name) &&
      sensitiveName.test(name) &&
      typeof value === "string" &&
      value.length >= 8 &&
      !/[\r\n]/.test(value),
  );
}

function filesAt(path) {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) =>
    filesAt(join(path, entry.name)),
  );
}

function readableBytes(path) {
  const contents = readFileSync(path);
  return extname(path) === ".gz" ? gunzipSync(contents) : contents;
}

export function findSecretLeaks(paths, env = process.env) {
  const secrets = sensitiveEnvironment(env);
  return paths.flatMap((path) =>
    filesAt(path).flatMap((file) => {
      const contents = readableBytes(file);
      return secrets
        .filter(([, value]) => contents.includes(Buffer.from(value)))
        .map(([name]) => ({ file, name }));
    }),
  );
}

if (process.argv[1]?.endsWith("assert-no-secrets.mjs")) {
  const paths = process.argv.slice(2);
  if (paths.length === 0) {
    throw new Error("Usage: assert-no-secrets.mjs <file-or-directory> [...]");
  }
  const leaks = findSecretLeaks(paths);
  if (leaks.length > 0) {
    for (const leak of leaks) {
      console.error(`${leak.file}: contains the value of ${leak.name}`);
    }
    throw new Error("Refusing to retain output containing a credential");
  }
  console.log(`Checked ${paths.length} output path(s) for credential values.`);
}
