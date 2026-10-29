// Both initial authentication and long-running Sandbox requests use the same
// GitHub identity and scoped token exchange. No refresh token is stored.
export async function exchangeCiToken({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  mask = (value) => console.log(`::add-mask::${value}`),
} = {}) {
  const requestedAt = now();
  const oidcResponse = await fetchImpl(env.ACTIONS_ID_TOKEN_REQUEST_URL, {
    redirect: "error",
    headers: {
      authorization: `bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
    },
  });
  if (!oidcResponse.ok) {
    throw new Error(
      `GitHub OIDC request failed with status ${oidcResponse.status}`,
    );
  }
  const { value: githubOidcToken } = await oidcResponse.json();
  if (
    !githubOidcToken ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(githubOidcToken)
  ) {
    throw new Error("GitHub did not provide a valid OIDC JWT");
  }
  mask(githubOidcToken);

  const tokenResponse = await fetchImpl(
    "https://api.vercel.com/login/oauth/token",
    {
      method: "POST",
      redirect: "error",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        client_id: env.VERCEL_CLI_CLIENT_ID,
        subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
        requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
        team_id_or_slug: env.VERCEL_ORG_ID,
        subject_token: githubOidcToken,
      }),
    },
  );
  if (!tokenResponse.ok) {
    throw new Error(
      `Vercel token exchange failed with status ${tokenResponse.status}`,
    );
  }
  const { access_token: accessToken, expires_in: expiresIn } =
    await tokenResponse.json();
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    /[\r\n]/.test(accessToken)
  ) {
    throw new Error("Vercel did not provide a single-line access token");
  }
  mask(accessToken);

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Vercel did not provide a positive access token lifetime");
  }
  return {
    accessToken,
    githubOidcToken,
    expiresAt: requestedAt + expiresIn * 1000,
  };
}
