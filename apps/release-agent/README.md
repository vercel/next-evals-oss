# Next.js Evals

This Eve agent posts release, backport, canary, and model-registration updates in
`team-adx-science`. It ignores incoming Slack messages, mentions, and DMs.

The `release-eval-report` skill highlights regressions supported by comparison
evidence and suspected eval problems. The root message links the measurement PR.
The summary asks maintainers to review and merge the PR to retain the run.
Three thread replies contain findings to investigate, full task results, and
model results. Without a comparable previous run, the report says regressions
could not be determined. The current notification payload has no previous-run
comparison. Routine infrastructure retries stay out of the summary.

Release measurements are separate from the public pass@4 leaderboard. Their
draft PRs retain pass@1 scores, release provenance, failure confirmations, and
sanitized transcripts, evaluator output, and command logs.

The intake route accepts only GitHub Actions OIDC tokens for
`vercel/next-evals-oss` on `main`. Model PR outcomes are posted directly to the
saved Slack parent message and acknowledged only after Slack accepts the reply.
Older checks without a parent timestamp, or a deleted duplicate parent, are
recovered from the bot's original message for that PR, including earlier commits.
Model completion replies ask maintainers to review scores and resolve flagged
eval issues before merging to publish to `nextjs.org/evals`. New approval
requests and run-start notices also reuse this thread. If it cannot
be found, reporting fails instead of creating a new root.

Slack credentials and inbound webhook verification are managed by the
`slack/next-evals-release-agent` Vercel Connect connector; there is no Slack
token or webhook URL in GitHub.

## Slack display

Use **Next.js Evals** as the app name and bot display name, with
[`assets/slack-icon.png`](assets/slack-icon.png) as the app icon. The editable
source is [`assets/slack-icon.svg`](assets/slack-icon.svg). Keep the existing
connector UID when changing the display name.

## Deploy

1. Link this directory to its own Vercel project under `vercel-labs`.
2. Run `pnpm exec eve add channel/slack` and choose Vercel Connect. The connector
   UID in `agent/channels/slack.ts` is `slack/next-evals-release-agent`.
3. Install the connector in the Vercel Slack workspace with `chat:write` and
   `channels:history` bot scopes. Incoming event triggers are not needed.
4. Run `pnpm deploy` and save the production URL as the
   `VERCEL_NEXT_EVALS_AGENT_URL` Actions variable in
   `vercel/next-evals-oss`.

The bot is limited to channel `C0C7VCBP4CA`. Automated summaries start a thread;
model run outcomes reply in the existing registration thread.
