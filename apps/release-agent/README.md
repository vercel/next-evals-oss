# Next.js release evals agent

This Eve agent receives validated release/backport events from the reusable
GitHub Actions workflow. It resolves each results PR to an immutable
same-repository commit, queries the proposed `agent-results.json`, writes the
high-level report in `team-agent-measurements`, and answers follow-up questions
about that run or the currently published board. Release result PRs also include
`release-diagnostics.json`, which records two non-scoring confirmation attempts
for every first-attempt model failure.

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
