import { execFileSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "dotenv";

const required = [
  "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
  "ACTIONS_ID_TOKEN_REQUEST_URL",
  "VERCEL_CLI_CLIENT_ID",
  "VERCEL_ORG_ID",
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
  const oidcResponse = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, {
    headers: {
      authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
    },
  });
  if (!oidcResponse.ok) {
    throw new Error(
      `GitHub OIDC request failed with status ${oidcResponse.status}`,
    );
  }
  const { value: githubOidcToken } = await oidcResponse.json();
  if (!githubOidcToken || /[\r\n]/.test(githubOidcToken)) {
    throw new Error("GitHub did not provide a single-line OIDC token");
  }
  console.log(`::add-mask::${githubOidcToken}`);

  const tokenResponse = await fetch(
    "https://api.vercel.com/login/oauth/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        client_id: process.env.VERCEL_CLI_CLIENT_ID,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
        team_id_or_slug: process.env.VERCEL_ORG_ID,
        subject_token: githubOidcToken,
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(
      `Vercel token exchange failed with status ${tokenResponse.status}`,
    );
  }
  const { access_token: accessToken } = await tokenResponse.json();
  if (!accessToken || /[\r\n]/.test(accessToken)) {
    throw new Error("Vercel did not provide a single-line access token");
  }
  console.log(`::add-mask::${accessToken}`);

  execFileSync(
    "vercel",
    [
      "env",
      "pull",
      envFile,
      "--yes",
      "--environment=development",
      "--project",
      process.env.VERCEL_PROJECT_ID,
    ],
    {
      stdio: "inherit",
      env: { ...process.env, VERCEL_TOKEN: accessToken },
    },
  );

  const credentials = parse(readFileSync(envFile));
  const oidcToken = credentials.VERCEL_OIDC_TOKEN;
  if (!oidcToken || /[\r\n]/.test(oidcToken)) {
    throw new Error("Vercel did not provide a single-line OIDC token");
  }
  console.log(`::add-mask::${oidcToken}`);

  let gatewayCredential = "";
  if (process.env.REQUIRE_AI_GATEWAY_API_KEY === "1") {
    const gatewayApiKey = credentials.AI_GATEWAY_API_KEY;
    if (!gatewayApiKey || /[\r\n]/.test(gatewayApiKey)) {
      throw new Error(
        "Vercel did not provide a single-line AI_GATEWAY_API_KEY",
      );
    }
    console.log(`::add-mask::${gatewayApiKey}`);
    gatewayCredential = `AI_GATEWAY_API_KEY=${gatewayApiKey}\n`;
  }

  // The exchange credential is scoped to this process and its Vercel CLI child.
  // Clear any inherited value for later steps. Model-running jobs explicitly
  // opt into the separately budgeted AI Gateway credential above.
  appendFileSync(
    process.env.GITHUB_ENV,
    `VERCEL_OIDC_TOKEN=${oidcToken}\n${gatewayCredential}VERCEL_TOKEN=\n`,
  );
} finally {
  process.umask(mask);
  rmSync(directory, { recursive: true, force: true });
}
