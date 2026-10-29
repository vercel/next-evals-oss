import { exchangeCiToken } from "./ci-token.mjs";

// agent-eval passes a fixed token to the Sandbox SDK. Refresh at its transport
// boundary so existing Sandbox instances, log polling, and cleanup all renew it.
export function createCiSandboxFetch({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  exchange = () => exchangeCiToken({ env, fetchImpl, now }),
} = {}) {
  let token = env.VERCEL_TOKEN;
  let expiresAt = Number(env.VERCEL_TOKEN_EXPIRES_AT);
  if (!token || !Number.isFinite(expiresAt) || expiresAt <= 0) {
    throw new Error(
      "Run ci-auth.mjs before enabling Sandbox credential refresh",
    );
  }
  // SDK instances retain the token they were created with, including after a
  // refresh. Only replace credentials issued by this process's CI exchange.
  const issuedTokens = new Set([token]);
  let refreshing;

  async function currentToken() {
    if (now() < expiresAt - 60_000) return token;
    if (!refreshing) {
      refreshing = exchange()
        .then((credentials) => {
          token = credentials.accessToken;
          expiresAt = credentials.expiresAt;
          issuedTokens.add(token);
          env.VERCEL_TOKEN = token;
          env.VERCEL_TOKEN_EXPIRES_AT = String(expiresAt);
          return token;
        })
        .finally(() => {
          refreshing = undefined;
        });
    }
    return refreshing;
  }

  return async function sandboxFetch(input, init) {
    const url = new URL(input instanceof Request ? input.url : input);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    const authorization = headers.get("authorization");
    const isSandbox =
      url.origin === "https://vercel.com" &&
      /^\/api\/v[23]\/sandboxes(?:\/|$)/.test(url.pathname);
    if (
      !isSandbox ||
      !authorization?.startsWith("Bearer ") ||
      !issuedTokens.has(authorization.slice(7))
    ) {
      return fetchImpl(input, init);
    }

    headers.set("authorization", `Bearer ${await currentToken()}`);
    // Never replay commands on 403: it can mean a genuine policy denial. Renew
    // before expiry, and do not forward refreshed credentials through redirects.
    return fetchImpl(input, { ...init, headers, redirect: "error" });
  };
}
