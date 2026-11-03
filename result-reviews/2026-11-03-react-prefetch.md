# React and prefetch grader replays, November 3, 2026

Adopts [Next.js #101056](https://github.com/vercel/next.js/pull/101056) at
`e7af391903f03d90aa6304467078ef32eb86a6a2`. The suite and app fixtures stay pinned.
`043` imports the clarified React prompt and build exclusion alongside its grader.
`049` imports only the grader. New runs use these files; historical attempts
retain their original prompts and fingerprints.

## Replays

Grader-only runs on Vercel Sandbox, using Sol high, Codex 0.166.0 and agent-eval
2.5.0. Saved apps were reconstructed from their recorded edits. No coding agent
was rerun. Controls are hand-authored, not additional model attempts.

| Saved solution or control | Next.js | Checks passed |
| --- | --- | --- |
| Sol release `043` Base, browser-only transitions | 16.4.4 | 0/1 |
| React layout control | 16.4.4 | 1/1, production build passed |
| Sol release `049` AGENTS.md | 16.4.4 | 5/5 |
| Same app with the prefetch stage removed | 16.4.4 | 2/5 |
| Terra `049` Base, first attempt | 16.5.0-canary.34 | 5/5 |
| Terra `049` AGENTS.md, first attempt | 16.5.0-canary.34 | 5/5 |

[Verdicts, source hashes and judge usage](2026-11-03-react-prefetch/regrade-summary.json)
link each replay's validation output. Estimated judge cost: **$1.77**, using the
repository's Sol list rates; Sandbox cost is separate. This is review cost,
not a change to the models' measured coding cost.

## Corrected release grade

Sol's saved `049` AGENTS.md attempt keeps the actual related-product items after
the App Shell byte boundary: shell ends at 3078; items begin at 3148 and 3206.
The old judge treated the complete prerendered output as the shell. The replay
passes all five checks, and removing the prefetch stage fails.

The [grading review](../measurements/releases/16.4.4/41470970834/results/gpt-6-sol-high--agents-md/2026-11-02T15-39-53.015Z/agent-049-prefetch-stage/grading-review.json)
preserves the original summary, status, aggregate fields and diagnostic. The
attempt, aggregate and active failure list now reflect the corrected pass.
Original transcripts, judge logs, classification, confirmation attempts,
tokens, duration and execution key remain intact.

| 16.4.4 Sol pass@1 | Base | AGENTS.md |
| --- | --- | --- |
| Original 31-task record, corrected | 26/31 | 28/31 → 29/31 |
| Current 28 published tasks, corrected view | 25/28 | 27/28 → 28/28 |

`043` remains a failure: the saved implementation uses browser transitions
without React integration. Terra's reviewed `049` passes are confirmed; no
public pass@4 scores change. Other models' earlier score corrections remain
as recorded in the [October 30 review](2026-10-30-prefetch-graders.md). Older
`unstable_` API implementations were not run against a newer API contract.

The old `049` grader also passed on an earlier replay. This supports correcting
the saved false negative, but does not establish that wording alone removes
judge variation. These remain judge-based checks.

## Future runs

The sync smoke imported all four files byte-for-byte, retained the app files,
and selected the same 28 published tasks. Historical summaries are retained
only by exact fixture and summary hashes; they are not marked fresh.

The changed grader/prompt setup has a new release comparison key. The old
16.4.4 record is retained, but its publication-only compatibility annotation
does not authorize comparing it with changed graders. The next reviewed run
under this setup starts its baseline; no framework regression is inferred
from this grading correction.
