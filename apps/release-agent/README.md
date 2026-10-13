# Next.js release evals agent

This Eve agent receives validated standalone release/backport reports from the
reusable GitHub Actions workflow. It writes a high-level report in
`team-agent-measurements` and answers follow-up questions from the compact
pass@1 report carried in that Slack thread.

The `release-eval-report` skill gives automated summaries a fixed Slack
structure focused on saturation candidates, audit candidates, reproducible
failures, and unstable first attempts. The validated payload includes per-task
and per-model scores so teammates can ask for the full breakdown in-thread.

The release pipeline does not create a results pull request and does not update
the published pass@4 leaderboard. The exported pass@1 measurement, release
provenance, and failure confirmations remain available in the linked GitHub
Actions artifact for 90 days; per-model raw artifacts remain for seven days. The
agent's `query_evals` tool
continues to answer separate questions about the currently published
`nextjs.org/evals` data.

The intake route accepts only a Vercel OIDC token minted for the
`vercel-labs/next.js` project in its Development environment. Slack credentials
and inbound webhook verification are managed by the
`slack/next-evals-release-agent` Vercel Connect connector; there is no Slack
token or webhook URL in GitHub.

## Deploy

1. Link this directory to its own Vercel project under `vercel-labs`.
2. Run `pnpm exec eve add channel/slack` and choose Vercel Connect. The connector
   UID in `agent/channels/slack.ts` is `slack/next-evals-release-agent`.
3. Install the connector in the Vercel Slack workspace. Enable `app_mention` and
   `message.channels` trigger events, with `app_mentions:read`, `chat:write`, and
   `channels:history` bot scopes.
4. Run `pnpm deploy` and save the production URL as the
   `VERCEL_NEXT_EVALS_AGENT_URL` Actions variable in `vercel/next.js`.

The bot is limited to channel `C0C7VCBP4CA`. Automated summaries start a thread;
teammates can continue in that thread or mention the bot in the channel.
