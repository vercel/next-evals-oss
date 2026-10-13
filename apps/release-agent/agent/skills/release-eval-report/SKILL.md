---
description: >
  Format automated Next.js release and backport pass@1 measurements for the
  team-agent-measurements Slack channel. Use for release-eval events containing
  overall scores, per-task scores, model scores, and confirmed failures.
---

# Release eval report

Use this skill only for a validated automated release-eval event. Produce one
Slack message under 2,500 characters that helps the team decide which evals may
belong in a regression suite and which need auditing.

## Slack style

Match the established reports in `#next-bots`:

- Start with a descriptive headline, then one sentence with the main takeaway.
- Use short section labels separated by one blank line.
- Use `•` bullets and bold labels within bullets.
- Use Slack-native links such as `<url|Workflow>`.
- Do not use tables, heading markup, numbered sections, or decorative emoji.
- Put methodology and caveats in `Measurement notes`, after the findings.
- Keep the message under 2,500 characters. Prefer counts and specific task names
  over commentary.

Use these sections in this order. Omit `AGENTS.md by model` when every model has
zero difference. Keep `Reliable failures` and say `None` when there are none.

```text
*Next.js <version> <release|backport> evals · pass@1*
<saturation count> of <task count> tasks meet the saturation threshold; <audit count> need audit. AGENTS.md changed the overall score by <signed pass difference> passes (<signed percentage-point difference>pp).

Overall
• *Base:* <passed>/<total> (<percent>%)
• *With AGENTS.md:* <passed>/<total> (<percent>%)
• *AGENTS.md effect:* <signed pass difference> passes (<signed percentage-point difference>pp)

AGENTS.md by model
• *<model>:* <signed pass difference> passes (<signed percentage-point difference>pp)

Saturation candidates (≥90% in both variants)
<count> of <task count> tasks qualify; <perfect count> were perfect in both.
• `<task>` — base <passed>/<total>, AGENTS.md <passed>/<total>

Needs audit (<90% in either variant)
<count> of <task count> tasks qualify.
• `<task>` — base <passed>/<total>, AGENTS.md <passed>/<total>

Reliable failures
• `<task>` — <model and Base/AGENTS.md>; failed pass@1 and both confirmations

Unstable first attempts
• <count> pass@1 failures passed at least one confirmation. They remain failures in the score but are not reliable regression signals.

Measurement notes
• Infrastructure failures were discarded and retried.
• Confirmations are diagnostic and never change pass@1.
• This standalone run did not change published pass@4 results.
• No prior standalone-run comparison is available yet.

<workflow URL|Workflow> · <artifact URL|Full artifact>
```

## Selection rules

Calculate the AGENTS.md difference from the two overall scores in this run. It
is a within-run comparison, not a change from a previous release.

Calculate model effects from `report.experiments`. Show at most three non-zero
effects, ordered by absolute pass difference and then model name. Include the
sign. Do not call these improvements or regressions; AGENTS.md may help one task
and hurt another within the same model.

Classify each task from `report.tasks`:

- Saturation watch: both percentages are at least 90%.
- Perfect: both percentages are 100%.
- Audit watch: either percentage is below 90%.

Show at most three saturation candidates and four audit candidates. For
saturation, show perfect tasks first, then the highest minimum percentage. For
audit, show the lowest minimum percentage first. If more qualify, add `• +N
more — ask in thread for the full list`. Call these candidates; never say a task
should be moved or deleted based on one run.

Group reliable failures by task. A failure is reliable only when
`reproducible` is true, meaning the scored attempt and both non-scoring
confirmations failed. List at most four grouped task lines, putting tasks that
failed across the most models first. Distinguish `Base` from `AGENTS.md`. Do not
quote `scoredFailureReason` unless it is short, specific, and supported by the
data. Never invent a cause.

Count failures with `reproducible: false` as unstable first attempts. Do not
list them as regressions. If there are no reliable failures, write `• None`.

## Metric rules

- The score is always pass@1: the first valid model attempt is the scored one.
- Infrastructure retries are excluded from the score and are not model
  attempts.
- The two confirmation attempts provide confidence only. Never use them to
  alter totals or percentages.
- Base and AGENTS.md are comparable within this run because they use the same
  task and model matrix.
- Never compare this report with the published pass@4 leaderboard.
- Never claim a change from a previous standalone run while
  `comparison.available` is false.
- Always link the workflow and retained artifact.
