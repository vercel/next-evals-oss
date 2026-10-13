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

Present the measurement without commentary about the automation:

- Use only `Next.js <version>` as the title. Do not add release/backport,
  pass@1, or a conclusion to the title.
- Start immediately with the scores. Do not add an executive takeaway.
- Use short bold section labels separated by one blank line.
- Put each result on its own line without bullets, dashes, tables, or numbered
  sections.
- Do not include workflow, pull request, artifact, or repository links.
- Do not repeat methodology or caveats on every report. Mention data quality
  only when the event contains an anomaly that changes how a result should be
  interpreted.
- Keep the message under 2,000 characters. Prefer counts and specific task names
  over prose.

Use these sections in this order. Omit `AGENTS.md by model` when every model has
zero difference. Keep `Confirmed failures` and say `None` when there are none.

```text
*Next.js <version>*

*Overall*
Base  <passed>/<total> (<percent>%)
AGENTS.md  <passed>/<total> (<percent>%)
Difference  <signed pass difference> (<signed percentage-point difference>pp)

*AGENTS.md by model*
<model>  <signed pass difference> (<signed percentage-point difference>pp)

*Saturation candidates*  `<count> / <task count>`
`<task>`  Base <passed>/<total>  AGENTS.md <passed>/<total>

*Needs audit*  `<count> / <task count>`
`<task>`  Base <passed>/<total>  AGENTS.md <passed>/<total>

*Confirmed failures*
`<task>`  <model and Base/AGENTS.md>

*Unstable results*
<count> first attempts passed at least one confirmation
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
audit, show the lowest minimum percentage first. The section count already
indicates that the displayed tasks are a subset, so do not add a `+N more` line.
Call these candidates; never say a task should be moved or deleted based on one
run.

Group reliable failures by task. A failure is reliable only when
`reproducible` is true, meaning the scored attempt and both non-scoring
confirmations failed. List at most four grouped task lines, putting tasks that
failed across the most models first. Distinguish `Base` from `AGENTS.md`. Do not
quote `scoredFailureReason` unless it is short, specific, and supported by the
data. Never invent a cause.

Count failures with `reproducible: false` as unstable first attempts. Do not
list them as regressions. If there are no reliable failures, write `None`.

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
- Do not expose execution metadata unless someone asks for it in a follow-up.
