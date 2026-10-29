import { createCiSandboxFetch } from "./ci-sandbox-fetch.mjs";

// Loaded only by the credentialed eval steps. NODE_OPTIONS also carries this
// hook into the runner's confirmation/recovery subprocesses.
if (!process.env.GITHUB_ENV) {
  throw new Error("Sandbox credential refresh requires a GitHub Actions job");
}
globalThis.fetch = createCiSandboxFetch();
