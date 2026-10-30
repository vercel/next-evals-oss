# Prefetch grader corrections, October 30, 2026

Saved-output review of the latest recorded failures for tasks `048`, `049`, and
`051`. This corrects 35 false-negative attempts across ten model/task/condition
cells. No agent or judge was rerun. Other recorded check outcomes are retained.

## Score changes

Public pass@4, with the same 31 tasks:

| Model | Base before → after | AGENTS.md before → after |
| --- | --- | --- |
| GPT-6.1 Terra (high) | 28/31 → 30/31 | 27/31 → 29/31 |
| Muse Spark Open | 26/31 → 28/31 | 28/31 → 30/31 |
| GPT-6 Luna (high) | 24/31 → 25/31 | 27/31 → 28/31 |

Every other model's scores are unchanged. Costs, duration, token usage, and the
number of attempts are unchanged, including retries caused by the old graders.

## Why these outcomes changed

- **Stable API names:** Terra and Muse used `prefetch()` or `navigation()` from
  `next/cache`, while the old graders demanded the `unstable_` names. The API
  checks were updated in [Next.js #99241](https://github.com/vercel/next.js/pull/99241).
- **Static headings:** `049` sometimes rejected the static related-products
  heading or wrapper in the shell, even when the actual items remained behind
  the prefetch boundary. [Next.js #100984](https://github.com/vercel/next.js/pull/100984)
  clarifies the intended requirement. Luna's older runs correctly use the
  `unstable_prefetch()` API available at the time. One Luna judge also demanded
  a named App Shell component; its saved source has the same valid structure.

The review uses the saved source edits/diffs and original grader logs. Terra's
transcripts additionally contain production prefetch-payload checks. For Muse,
most original semantic checks already passed; correcting the obsolete API check
is sufficient. The corrections do not claim a fresh execution of the current
verifier or guarantee behavior beyond the reviewed checks.

## Attempt evidence

Each review identifies the run directory containing the unchanged
`run-N/transcript.json` and `run-N/outputs/eval.txt`. Transcript event
indices are zero-based. Original summaries and failure classifications are
preserved in the review records.

| Model and condition | Task | Corrected attempts | Review |
| --- | --- | --- | --- |
| Terra · Base | 049 | 1, 2, 3, 4 | [Evidence](../results/gpt-6.1-terra-high/2026-10-30T15-39-45.592Z/agent-049-prefetch-stage/grading-review.json) |
| Terra · Base | 051 | 1, 2, 3, 4 | [Evidence](../results/gpt-6.1-terra-high/2026-10-30T15-39-45.592Z/agent-051-prefetch-until-navigation/grading-review.json) |
| Terra · AGENTS.md | 049 | 1, 2, 3, 4 | [Evidence](../results/gpt-6.1-terra-high--agents-md/2026-10-30T15-46-32.772Z/agent-049-prefetch-stage/grading-review.json) |
| Terra · AGENTS.md | 051 | 1, 2, 3, 4 | [Evidence](../results/gpt-6.1-terra-high--agents-md/2026-10-30T15-46-32.772Z/agent-051-prefetch-until-navigation/grading-review.json) |
| Muse Spark Open · Base | 049 | 1, 2, 3, 4 | [Evidence](../results/muse-spark-open/2026-10-16T10-11-07.627Z/agent-049-prefetch-stage/grading-review.json) |
| Muse Spark Open · Base | 051 | 1, 2, 4 | [Evidence](../results/muse-spark-open/2026-10-16T10-11-07.627Z/agent-051-prefetch-until-navigation/grading-review.json) |
| Muse Spark Open · AGENTS.md | 049 | 1, 2, 3, 4 | [Evidence](../results/muse-spark-open--agents-md/2026-10-16T10-31-07.258Z/agent-049-prefetch-stage/grading-review.json) |
| Muse Spark Open · AGENTS.md | 051 | 1, 2, 3, 4 | [Evidence](../results/muse-spark-open--agents-md/2026-10-16T10-31-07.258Z/agent-051-prefetch-until-navigation/grading-review.json) |
| Luna · Base | 049 | 1 | [Evidence](../results/gpt-6-luna-high/2026-09-22T20-12-00.023Z/agent-049-prefetch-stage/grading-review.json) |
| Luna · AGENTS.md | 049 | 1, 2, 4 | [Evidence](../results/gpt-6-luna-high--agents-md/2026-09-22T20-20-04.111Z/agent-049-prefetch-stage/grading-review.json) |

Muse Base `051` run 3 still fails because it disables prefetching and omits the
navigation stage. Luna's other `049` failures still use the wrong mechanism or
omit Partial Prefetching. Neither class of failure was turned into a pass.
No supported score correction was found for `048`. Infrastructure failures and
other unrelated assertions remain outside this correction.

Terra still fails `044` in both conditions, and `026` with AGENTS.md. The API and
heading fixes therefore do not remove its one-task Base/AGENTS.md difference.

## Suite version

The suite pin advances to `3452ebbcf93236ef9b9c6c1db5e2d706d722deb9`, which imports
the stable-API graders without changing the public task cohort. Only `049`'s
`EVAL.ts` is overlaid from `18415429b48359b42f7f13f6c0bc4321bd6654ea` for the
heading correction. Prompts and starting apps are unchanged.

Historical results retain their original fingerprints. The bounded retention
policy permits these saved measurements in the export while the normal runner
continues to identify them as changed. The broader audited suite is a separate
update; this review does not remove `026`, `030`, or `044` from the denominator.
