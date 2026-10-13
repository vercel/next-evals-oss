import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "dotenv";

const required = [
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
  "GITHUB_ENV",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(`Missing CI authentication values: ${missing.join(", ")}`);
}

const directory = mkdtempSync(join(tmpdir(), "next-evals-auth-"));
const envFile = join(directory, "credentials.env");
const mask = process.umask(0o077);

try {
  execFileSync(
    "vercel",
    [
      "env",
      "pull",
      envFile,
      "--yes",
      "--environment=development",
      "--scope",
      process.env.VERCEL_TEAM_ID,
      "--project",
      process.env.VERCEL_PROJECT_ID,
      "--token",
      process.env.VERCEL_TOKEN,
    ],
    { stdio: "inherit" },
  );

  const credentials = parse(readFileSync(envFile));
  const oidcToken = credentials.VERCEL_OIDC_TOKEN;
  if (!oidcToken || /[\r\n]/.test(oidcToken)) {
    throw new Error("Vercel did not provide a single-line OIDC token");
  }
  const cursorApiKey = credentials.CURSOR_API_KEY;
  if (!cursorApiKey || /[\r\n]/.test(cursorApiKey)) {
    throw new Error("Vercel did not provide a single-line CURSOR_API_KEY");
  }

  console.log(`::add-mask::${oidcToken}`);
  console.log(`::add-mask::${cursorApiKey}`);
  appendFileSync(
    process.env.GITHUB_ENV,
    `VERCEL_OIDC_TOKEN=${oidcToken}\nCURSOR_API_KEY=${cursorApiKey}\n`,
  );
} finally {
  process.umask(mask);
  rmSync(directory, { recursive: true, force: true });
}
