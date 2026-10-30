# Next.js release evals agent

This Eve agent receives validated release, backport, and canary reports
from the standalone GitHub Actions workflow. It writes a decision-focused
report in
`team-agent-measurements`, follows it with detailed task, agent, and failure
replies, and answers questions from the compact pass@1 report carried in that
Slack thread.

The `release-eval-report` skill gives automated summaries a fixed Slack
structure focused on saturation candidates, audit candidates, reproducible
failures, and unstable first attempts. A Slack renderer turns the agent's four
report sections into one root post and three replies containing the full task
and model breakdowns.

The release pipeline does not create a publishable results pull request and does
not update the pass@4 leaderboard. It opens a separate draft measurement pull
request containing the exported pass@1 aggregate, release provenance, and
failure confirmations, along with the complete sanitized scored and confirmation
output. The final Slack thread reply links that pull request so maintainers can
inspect transcripts, evaluator output, and command logs. The agent's
`query_evals` tool continues to answer separate questions about the currently
published `nextjs.org/evals` data.

The intake route accepts only GitHub Actions OIDC tokens for
`vercel/next-evals-oss` on `main`. Model PR outcomes are posted directly to the
saved Slack parent message and acknowledged only after Slack accepts the reply.
Eve remains available for questions in that thread. Older checks without a
parent timestamp, or a deleted duplicate parent, are recovered from the bot's
original message for that PR and commit. If it cannot be found, reporting fails instead of creating a new root.

Slack credentials and inbound webhook verification are managed by the
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
   `VERCEL_NEXT_EVALS_AGENT_URL` Actions variable in
   `vercel/next-evals-oss`.

The bot is limited to channel `C0C7VCBP4CA`. Automated summaries start a thread;
teammates must mention the bot to ask a question, including inside a thread.
Automated workflow updates do not need a mention.
