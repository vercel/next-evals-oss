import { createCiSandboxFetch } from "./ci-sandbox-fetch.mjs";

// Loaded only by the credentialed eval steps. NODE_OPTIONS also carries this
// hook into the runner's confirmation/recovery subprocesses.
if (!process.env.EVAL_REDACTION_FILE) {
  throw new Error("Run ci-auth.mjs before enabling Sandbox credential refresh");
}
globalThis.fetch = createCiSandboxFetch();
