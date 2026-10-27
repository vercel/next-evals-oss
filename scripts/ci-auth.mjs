import { appendFileSync } from "node:fs";

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
const oidcResponse = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL, {
  headers: {
    authorization: `bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
  },
});
if (!oidcResponse.ok) {
  throw new Error(`GitHub OIDC request failed with status ${oidcResponse.status}`);
}
const { value: githubOidcToken } = await oidcResponse.json();
if (
  !githubOidcToken ||
  !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(
    githubOidcToken,
  )
) {
  throw new Error("GitHub did not provide a valid OIDC JWT");
}
console.log(`::add-mask::${githubOidcToken}`);

const tokenResponse = await fetch("https://api.vercel.com/login/oauth/token", {
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
});
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
    throw new Error(
      "Vercel did not provide a single-line AI_GATEWAY_API_KEY",
    );
  }
  console.log(`::add-mask::${gatewayApiKey}`);
  gatewayCredential = `AI_GATEWAY_API_KEY=${gatewayApiKey}\n`;
}

// Sandbox accepts the short-lived access token with the linked team and project
// IDs. The GitHub OIDC token authenticates the workflow's call to Eve. Neither
// credential is persisted in GitHub.
appendFileSync(
  process.env.GITHUB_ENV,
  `VERCEL_TOKEN=${accessToken}\nVERCEL_TEAM_ID=${process.env.VERCEL_ORG_ID}\nVERCEL_PROJECT_ID=${process.env.VERCEL_PROJECT_ID}\nRELEASE_WORKFLOW_OIDC_TOKEN=${githubOidcToken}\n${gatewayCredential}`,
);
