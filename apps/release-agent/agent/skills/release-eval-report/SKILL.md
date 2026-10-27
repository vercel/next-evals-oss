---
description: >
  Format automated Next.js release, backport, and canary pass@1 measurements for
  the team-agent-measurements Slack channel. Use for release-eval events
  containing overall scores, per-task scores, model scores, and confirmed
  failures.
---

# Release eval report

Use this skill only for a validated automated release-eval event. Produce one
short Slack root message and exactly three detailed thread replies. The report
should help the team decide which evals are saturated enough to become
regression checks and which evals need auditing.

Separate the root and each reply with this exact line:

```text
<!-- RELEASE_EVAL_THREAD_REPLY -->
```

The renderer removes the separators and posts the four parts as one root message
and three replies. Never use the separator for any other purpose.

## Root message

Match the established reports in `#next-bots`: a short framing paragraph,
followed by a few named findings written in compact prose.

- Use only `Next.js <version>` as the title.
- In the opening paragraph, identify release, backport, or canary, matrix size, and the
  Base and AGENTS.md totals.
- Organize the findings around the questions the team is answering:
  `Saturation`, `Harder tasks`, `Potential eval problems`, and `Comparison`.
- `Saturation` should quantify tasks above 90% in both variants, identify the
  strongest regression-suite candidates, and say whether the strongest agents
  are already saturated.
- `Harder tasks` should summarize the tasks below 90%, say whether failures
  cluster among weaker agents, and call out exceptions where a high-scoring
  agent failed.
- `Potential eval problems` should flag extreme results such as 0% tasks or
  surprising confirmed failures. Describe them as audit candidates unless the
  report data proves a cause.
- `Comparison` should summarize changed tasks, changed agent totals, and agent
  version changes only when a comparable prior run exists. On the first run,
  say that it establishes the controlled baseline and omit deltas.
- Do not include execution links, pull requests, artifacts, metric methodology,
  or automation commentary.
- Do not use tables. Keep the root under 2,500 characters.

Use this shape:

```text
**Next.js <version>**

This <release|backport|canary> measured <task count> tasks across <agent count> agents. Without AGENTS.md, <passed>/<total> passed (<percent>%); with AGENTS.md, <passed>/<total> passed (<percent>%).

**Saturation**
<count and interpretation of tasks above 90%, plus top-agent saturation>

**Harder tasks**
<count and interpretation of tasks below 90%, failure clusters, and notable exceptions>

**Potential eval problems**
<extreme or surprising results that warrant auditing, or `None`>

**Comparison**
<changes from the previous comparable run, or first-run baseline note>
```

## Thread reply 1: full task results

Title the reply `Full task results`. Include every task. Group tasks by their
AGENTS.md pass band, highest first. For every task show its Base and AGENTS.md
scores. For tasks below 100%, name the failed agents separately for Base and
AGENTS.md. Keep multiple perfect tasks on one compact line when that remains
readable.

## Thread reply 2: full agent results

Title the reply `Full agent results`. Include every experiment, using its model
and harness labels as the recorded agent version. Show Base and AGENTS.md pass
counts and percentages side by side. Group identical score pairs when useful,
but never omit an agent. If a comparable prior run exists, show the score delta
and explicitly identify version changes.

## Thread reply 3: verification and comparison

Title the reply `Failure verification and comparison`.

- List every scored failure grouped by task.
- A failure is confirmed only when `reproducible` is true, meaning the scored
  attempt and both non-scoring confirmations failed.
- Mark a failure unstable when at least one confirmation passed. It stays a
  failure in the score, but do not present it as a reliable regression signal.
- Mark a failure unverified when `confirmationUnavailable` is nonzero. It stays
  a failure in the score, but do not call it confirmed or unstable and keep it
  out of root-message regression claims.
- State that infrastructure retries were excluded only when one or more scored
  results needed an infrastructure retry.
- When comparison data is available, list every changed task, every changed
  agent total, and every agent-version change. On the first controlled run,
  state that this run establishes the baseline.
- End with `Full results and reasoning traces: <measurement PR link>`, using
  the event's `measurementUrl`. Keep the link in this reply rather than the root
  message.

## Analysis rules

Calculate agent strength from the current run's overall experiment scores. A
failure from an agent scoring at least 90% overall is a notable exception. Never
label an agent weak solely because it failed one task.

Classify each task from `report.tasks`:

- Saturated: both Base and AGENTS.md are above 90%.
- Perfect: both are 100%.
- Needs audit: either is 90% or below.

Call saturated tasks candidates; never say a task should be moved or deleted
based on one run. A 0% result is a strong reason to inspect the eval design, but
it does not prove the eval is invalid.

Calculate the AGENTS.md difference from the two scores in the same run. Do not
describe that within-run difference as a release-to-release improvement.

## Metric rules

- The score is always the first valid model attempt.
- Infrastructure retries are excluded from the score and are not model
  attempts.
- Confirmation attempts provide confidence only and never alter the score.
- Base and AGENTS.md are comparable within one run because they use the same
  task and model matrix.
- Never compare this report with the published pass@4 leaderboard.
- Never claim a previous-run change while `comparison.available` is false.
- Do not expose workflow or artifact metadata unless someone asks for it in a
  follow-up. The measurement pull request link is required in thread reply 3.
