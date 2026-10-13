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

## Format

Use these sections in this order. Omit a section only when its count is zero.

```text
*Next.js <version> <release|backport> · standalone pass@1*

*Overall* — Base <passed>/<total> (<percent>%) · AGENTS.md <passed>/<total> (<percent>%) · <signed pass difference> passes (<signed percentage-point difference>pp)

*Largest AGENTS.md effects*
• <model> — <signed pass difference> passes (<signed percentage-point difference>pp)

*Saturation watch* — <count>/<task count> tasks scored at least 90% both with and without AGENTS.md; <perfect count> were perfect in both.
• `<task>` — Base <passed>/<total> · AGENTS.md <passed>/<total>

*Audit watch* — <count>/<task count> tasks scored below 90% in at least one variant.
• `<task>` — Base <passed>/<total> · AGENTS.md <passed>/<total>

*Reliable first-attempt failures*
• `<task>` — <model and variant>; failed the scored attempt and both confirmations

*Unstable first-attempt failures* — <count> scored failures passed at least one confirmation. They remain pass@1 failures but are not reliable regression signals.

Infrastructure failures were discarded and retried. Confirmations are diagnostic and never change pass@1. No published pass@4 results were changed. No prior standalone-run delta is available yet.

<workflow link> · <artifact link>
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

Show at most four tasks in each watch section. For saturation, show perfect
tasks first, then the highest minimum percentage. For audit, show the lowest
minimum percentage first. If more qualify, add `+N more — ask in thread for the
full list`. Call these signals or candidates; never say a task should be moved
or deleted based on one run.

Group reliable failures by task. A failure is reliable only when
`reproducible` is true, meaning the scored attempt and both non-scoring
confirmations failed. List at most five grouped task lines, putting tasks that
failed across the most models first. Distinguish `Base` from `AGENTS.md`. Do not
quote `scoredFailureReason` unless it is short, specific, and supported by the
data. Never invent a cause.

Count failures with `reproducible: false` as unstable first attempts. Do not
list them as regressions. If there are no reliable failures, say `No reliable
first-attempt failures.`

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
