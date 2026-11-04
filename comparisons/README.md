# PR docs comparisons

Run the same task against old and revised bundled guidance to measure a docs
change. This is separate from release regressions, model registration, and the
public leaderboard. Both conditions have the same AGENTS.md pointer.

## Activity example

`activity-docs.json` pins the task/helper revision, old and new guide revisions,
Next.js runtime, and coding model for Next.js #100208. It derives two tarballs
from one `next@16.4.5` package, replaces only the listed bundled guides, and
rejects any other package difference. This matches the local comparison method.
It does not claim to compare two complete framework builds or follow a moving PR.

The manifest must be reviewed and merged before execution. Review the pinned
fixture's EVAL.ts, package scripts, and imported `evals/lib` code as executable
code, not just the prompt. The workflow accepts task selection only, not arbitrary
refs, package URLs, model names, or PR code. To compare a later revision, update
the manifest in a reviewed PR. This initial workflow is for public tasks only,
including these explicitly selected `publish: false` docs-development tasks.
They stay excluded from automatic release and model-registration suites.

## Run

After merging, authorize `pr-docs-comparison.yml` on `main` in the existing
Vercel CI OIDC policy. Reuse the release project's scoped Sandbox credentials
and budgeted AI Gateway key. No new long-lived credential is required.

Dispatch **PR docs comparison** from `main`. The default is task 065: two coding
attempts, one per condition. Selecting `all` runs four tasks, eight attempts.
Sol high and the 15-minute attempt timeout (including setup and validation)
are fixed in this first version.
There are no automatic retries, confirmations, PR comments, or Slack posts.
The job timeout is 150 minutes. Attempt/time limits are not a dollar spending cap.
The SDK and dependency versions follow the eval repo lockfile, so these are new
measurements and must not be pooled with the earlier local cohort.

The job checks installed guide hashes before each coding attempt. The SDK stores
actual CLI/model provenance where observable. Inspect that provenance and the
traces before attributing differences to docs. The pinned SDK installs the CLI
from npm, so a CLI change or missing provenance limits the comparison. Agents
can still consult public docs. Reading bundled docs is not guaranteed by the
pointer. Task 065 directly overlaps the new notification example and measures
that targeted guidance, not generalization to a held-out problem.

## Evidence and retention

The summary and downloadable `activity-docs-<run>-<attempt>` artifact appear
on the Actions run. The artifact contains:

- A per-task Base/Head outcome, tokens, estimated coding cost, and run duration.
- Source commits, task/helper hashes, package hashes, pricing, and the guide texts.
- SDK results, sanitized transcripts, validation output, and saved app files.
- Missing/failed attempt evidence, without silently rerunning it.

Input tokens include cache reads/writes. Coding costs use one recorded rate
snapshot and exclude graders and Sandbox. Duration is the SDK run duration,
including validation. Missing usage is unknown, not zero. This initial report
shows both conditions without declaring a winner from one attempt.

Artifacts are public-repository evidence, retained for 90 days or the repository
limit. They are not permanent storage. Before expiry, review the complete bundle
and retain it in a measurement PR under `measurements/comparisons/<name>/<run>/`,
or copy it to the agreed Vercel-owned store. Preserve source/task/package hashes
and both conditions together. Do not place held-out tasks, customer data, or
unreviewed private traces in this workflow. A later private store can consume the
same bundle without changing how tasks are authored.
