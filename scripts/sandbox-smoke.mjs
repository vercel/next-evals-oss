import { SandboxManager } from "@vercel/agent-eval";

const accessTokenVariables = [
  "VERCEL_TOKEN",
  "VERCEL_TEAM_ID",
  "VERCEL_PROJECT_ID",
];
const missingAccessTokenVariables = accessTokenVariables.filter(
  (name) => !process.env[name],
);
if (
  !process.env.VERCEL_OIDC_TOKEN &&
  missingAccessTokenVariables.length > 0
) {
  throw new Error(
    `Missing Sandbox authentication values: ${missingAccessTokenVariables.join(", ")}`,
  );
}

const sandbox = await SandboxManager.create({
  backend: "vercel",
  timeout: 5 * 60 * 1000,
});

try {
  console.log("Vercel Sandbox authentication succeeded.");
} finally {
  await sandbox.stop();
}
