# Before/after PR evals

Run the same eval against two package builds for a framework or docs PR.
Keep the task, grader, model and setup the same. Retain correctness, effort
and traces from both conditions together.

## Configure a comparison

Reusable presets live in `comparisons/<name>.json` on the runner
repository's `main`. A preset defines the framework setup and default eval set.
It is not a new configuration PR required for each framework/docs change.
The preset contains:

- Historical/default PR and source commits, overridden when selecting an open PR.
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

Review task EVAL.ts files, package scripts and helpers as executable code,
including code at the pinned fixture/helper commit. New tasks can be in the
framework/docs PR or another public task repository; use that exact commit as
`fixtureRef`. Both conditions run the same tasks and grader from that commit.
Only the framework/package or guidance treatment changes. Public tasks and
package artifacts only; held-out tasks and customer data require private storage.

## Run

Once the reusable runner is merged, dispatch **PR eval comparison** from evals
OSS `main` and select the framework/docs PR directly. No second PR is required:

- **pull_request:** the framework/docs PR URL, such as Next.js #100208.
- **reviewed_head:** that PR's exact reviewed head SHA.
- **comparison:** the reusable preset, such as `activity-docs`.
- **task:** default, `all`, or comma-separated task names (maximum four).
- **tasks_from_pr:** use tasks/helpers from the reviewed PR head. Enable this
  for new or changed evals in that PR. Those same evals grade both conditions.
- **package_artifacts:** optional JSON containing `base`/`head` package `url`
  and `sha256` values, built from the selected commits. Supplying this switches
  to full package comparison, including framework and bundled-docs changes.

For Activity, after reviewing its current head:

```sh
gh workflow run pr-comparison.yml --repo vercel/next-evals-oss --ref main \
  -f pull_request=https://github.com/vercel/next.js/pull/100208 \
  -f reviewed_head=FULL_REVIEWED_HEAD_SHA -f comparison=activity-docs \
  -f tasks_from_pr=true -f task=all
```

The trusted main runner reads PR metadata, verifies the reviewed head, and pins
its current base/head before obtaining Vercel credentials. The target must be
an open branch PR in the preset's repository. Its workflow and runner scripts
are never checked out for execution. Review the pinned executable tasks/helpers
and package code before dispatching. Pushes do not start paid runs; select and
review the new head before dispatching again.

Without **tasks_from_pr**, tasks stay at the preset's pinned fixture commit.
With it, explicit task names can select newly added tasks without changing the
preset. `all` uses the preset's list, not automatic discovery of every fixture.
Before/after package builds must be supplied for the selected source commits;
the runner checks package bytes against the supplied hashes, not build attestation.
The Activity guide-overlay option uses the preset's guide list and one runtime.

Existing pinned comparisons can still run by leaving **pull_request** and
**reviewed_head** empty. One attempt runs per selected task per condition.
Activity's default task costs two attempts; all four tasks cost eight.
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

Results and traces are retained in the evals OSS Actions run, with the target
framework/docs PR and exact commits recorded. The job summary is the initial
review surface for cross-repository runs. Posting a check directly to a Next.js
or another framework PR requires a GitHub App with write access there; the
repository Actions token cannot do that. When the target PR is in evals OSS
itself, a result check is attached to the reviewed commit. No PR comment is posted.

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
