import { appendFileSync } from "node:fs";
import { exchangeCiToken } from "./ci-token.mjs";

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
const { accessToken, githubOidcToken, expiresAt } = await exchangeCiToken();

let gatewayCredential = "";
if (process.env.REQUIRE_AI_GATEWAY_API_KEY === "1") {
  // The model matrix uses a separately budgeted key. Read only this project's
  // Development environment with the short-lived project access token.
  const environmentUrl = new URL(
    `/v3/env/pull/${encodeURIComponent(process.env.VERCEL_PROJECT_ID)}/development`,
    "https://api.vercel.com",
  );
  environmentUrl.searchParams.set("source", "vercel-cli:env:pull");
  environmentUrl.searchParams.set("teamId", process.env.VERCEL_ORG_ID);
  const environmentResponse = await fetch(environmentUrl, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!environmentResponse.ok) {
    throw new Error(
      `Vercel environment request failed with status ${environmentResponse.status}`,
    );
  }
  const { env: credentials } = await environmentResponse.json();
  if (!credentials || typeof credentials !== "object") {
    throw new Error("Vercel did not provide project environment variables");
  }
  const gatewayApiKey = credentials.AI_GATEWAY_API_KEY?.trim();
  if (!gatewayApiKey || /[\r\n]/.test(gatewayApiKey)) {
    throw new Error("Vercel did not provide a single-line AI_GATEWAY_API_KEY");
  }
  console.log(`::add-mask::${gatewayApiKey}`);
  gatewayCredential = `AI_GATEWAY_API_KEY=${gatewayApiKey}\n`;
}

// Sandbox accepts the short-lived access token with the linked team and project
// IDs. The GitHub OIDC token authenticates the workflow's call to Eve. Neither
// credential is persisted in GitHub.
appendFileSync(
  process.env.GITHUB_ENV,
  `VERCEL_TOKEN=${accessToken}\nVERCEL_TOKEN_EXPIRES_AT=${expiresAt}\nVERCEL_CLI_CLIENT_ID=${process.env.VERCEL_CLI_CLIENT_ID}\nVERCEL_ORG_ID=${process.env.VERCEL_ORG_ID}\nVERCEL_TEAM_ID=${process.env.VERCEL_ORG_ID}\nVERCEL_PROJECT_ID=${process.env.VERCEL_PROJECT_ID}\nRELEASE_WORKFLOW_OIDC_TOKEN=${githubOidcToken}\n${gatewayCredential}`,
);
