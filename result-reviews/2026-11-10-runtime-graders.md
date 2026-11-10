# Runtime grader verification

Verifies [Next.js #101523](https://github.com/vercel/next.js/pull/101523) at
`0168b7a37b625273a7c4eaed52c22c41bf64da11` with fresh coding trials and a saved-app
replay. These records do not change the active suite, historical release scores
or the public leaderboard.

## Saved instant-navigation repair

The saved `040` AGENTS.md attempt from [measurement #194](https://github.com/vercel/next-evals-oss/pull/194)
added a layout and `loading.tsx`. Reconstructing that source and grading it under
both revisions produced:

| Grader | Checks passed | What changed |
| --- | --- | --- |
| Original | 2/4 | Rejected the title and fallback because the page awaited inventory. |
| Revised | 4/4 | The browser confirms the title is visible while inventory is paused. The fallback rubric accepts a parent layout/loading boundary. |

The replay uses the same reconstructed app, Next.js 16.4.6, Sol high and Codex
0.167.0 for both graders. Only the grader changes. Playwright dependencies and
the production testing flag were added to support browser verification.
This verifies the saved repair, not the judge's reliability across other repairs.

[Source provenance](2026-11-10-runtime-graders/replay/source-provenance.json),
[original verdicts](2026-11-10-runtime-graders/replay/original-validation.json),
[revised verdicts](2026-11-10-runtime-graders/replay/revised-validation.json) and
[judge usage](2026-11-10-runtime-graders/replay/usage.json) preserve the evidence.
Estimated replay judge cost was **$0.5097**, separate from coding cost.

## Fresh coding trials

Three attempts per task and condition, with no early exit. Base has no added
documentation pointer; AGENTS.md receives the usual pointer to bundled docs.
Both use Next.js 16.4.6, Sol high, Codex 0.167.0 and agent-eval 3.0.0 in local Docker.
The changed prompts and fixtures require fresh trials; these are not regrades
of previous agent attempts.

| Task | Base successes | AGENTS.md successes | Mean coding cost, Base | Mean coding cost, AGENTS.md |
| --- | --- | --- | --- | --- |
| 031 · Proxy headers and logs | 3/3 | 3/3 | $0.1126 | $0.1752 |
| 040 · Instant product navigation | 3/3 | 3/3 | $0.2494 | $0.3519 |
| 048 · Category prefetching | 3/3 | 3/3 | $0.5958 | $0.3549 |

Total estimated coding cost: **$5.5193**. These runs verify the revised
tasks; they do not measure a framework or docs change.

The [summary](2026-11-10-runtime-graders/summary.json) links each native result,
with transcripts, changed app files and validation output in the same run folder.
It includes token usage, recorded tool calls and duration. Duration includes
setup and validation, so it is not coding time. Coding estimates exclude judge
calls and infrastructure charges.

## Reproduce

Install this repo's pinned dependencies, check out the fixture commit above in
Next.js, and run [the recorded runner](2026-11-10-runtime-graders/run.mjs) with
`NEXT_CHECKOUT` pointing to that checkout and `EVAL_CREDENTIAL_FILE` pointing to a
local file containing `AI_GATEWAY_API_KEY`. The runner uses only that key.
[Provenance](2026-11-10-runtime-graders/provenance.json) records fixture hashes and
setup. Each rerun produces new evidence; it does not overwrite these records.

The unpublished Playwright docs research task in #101523 is excluded from this
record and from the public results pipeline.
