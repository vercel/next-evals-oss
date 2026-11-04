# Before/after PR evals

Run the same eval against two package builds for a framework or docs PR.
Keep the task, grader, model and setup the same. Retain correctness, effort
and traces from both conditions together.

## Configure a comparison

Add `comparisons/<name>.json` and review it before merging. The manifest pins:

- The PR and before/after source commits.
- A public task repository and fixture commit. This can differ from the PR repo.
- The package name, model and pricing key, selected tasks and default task.
- Named setup exports from the task repository's `evals/lib/setup.ts`, validation
  scripts and files to exclude from app diffs.
- Treatment-specific inputs and any limitations on interpreting the result.

The task repo supplies ordinary agent-eval tasks under `evals/evals/<task>` and
shared helpers under `evals/lib`. Its setup exports receive the Sandbox. Setup
must install the selected tarball from the environment variable named by
`tarballEnv`, prepare the app, and provide the same guidance in both conditions.
The runner verifies the tarball hash and installed package name/version. Build
and EVAL.ts checks grade each attempt normally.

There are two treatment options:

- `packages`: provide `packageArtifacts.base` and `.head`, each with a public
  HTTPS `url` and exact `sha256`. These can be before/after PR tarballs for any
  npm framework, including builds that change bundled docs. Set `guides: []`.
  The runner downloads and checks both archives and records their file differences.
- `bundled-docs`: the Next.js helper used by `activity-docs.json`. Download one
  exact `next` runtime, overlay the listed guides from the two source commits,
  and reject any non-guide package change. This isolates guidance from runtime.

`activity-docs.json` is a complete example. For another framework, use `packages`,
set `packageName`, `repository`, `taskRepository`, `tarballEnv` and `setupSteps`
for that eval, and supply the two artifact URLs/hashes. No workflow changes are
needed. The current harness is Codex, using a model with recorded repository
pricing. Each manifest is limited to four tasks to bound a dispatch.

Review task EVAL.ts files, package scripts and helpers as executable code. This
workflow accepts only manifest names already merged on `main` and tasks listed
in that manifest. Public tasks and package artifacts only; held-out tasks and
customer data require private storage.

## Run

Dispatch **PR eval comparison** from `main`, select the **comparison** manifest
name, and leave **task** empty for its default. Alternatively enter a task from
that manifest or `all`. One attempt runs per task per condition. Activity's
default notification task costs two coding attempts; all four tasks cost eight.
The 15-minute attempt timeout includes setup and validation; the job limit is
150 minutes. These limits are not a dollar spending cap.

The current Vercel CI policy allows only the release and model-registration
workflow names. This workflow needs authorization before live use, either via
an existing policy or a separate policy with the appropriate repository, branch
and project restrictions. Resolve the intended Vercel team/project first and
reuse its scoped authentication and budgeted AI Gateway key.

No release/model-registration triggers, retries, PR comments, Slack posts or
leaderboard updates are added. The SDK follows the eval repo lockfile, so keep
new measurements separate from earlier local runs. The SDK installs the agent
CLI from npm; inspect actual CLI/model provenance and traces before attributing
changes to the PR. Agents can consult public docs even when bundled guidance
is provided.

## Evidence and retention

The Actions run has a summary and `pr-comparison-<run>-<attempt>` artifact:

- Per-task Base/Head outcomes, provider-reported tokens, estimated coding cost
  and SDK run duration.
- Source/task/helper/package hashes, pricing and exact guide treatments when used.
- Sanitized SDK transcripts, validation output, saved app files and unavailable
  attempt evidence.

Input tokens include cache reads/writes. Coding cost uses one recorded rate
snapshot and excludes graders and Sandbox. Duration includes validation.
Missing usage stays unknown. One attempt per condition does not establish a
reliable saving. Activity task 065 matches the revised notification example,
so it measures targeted guidance usefulness, not held-out generalization.

Artifacts expire after 90 days or the repository limit. Review and retain the
complete bundle in a measurement PR under `measurements/comparisons/<name>/<run>/`
or the agreed Vercel-owned store before expiry. This is evidence capture, not
permanent storage. A later private store can consume the same bundle.
