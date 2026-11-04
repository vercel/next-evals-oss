# Before/after PR evals

Run the same eval against two package builds for a framework or docs PR.
Keep the task, grader, model and setup the same. Retain correctness, effort
and traces from both conditions together.

## Configure a comparison

Add `comparisons/<name>.json` in an evals OSS PR. It can stay unmerged while
you run the comparison. The manifest pins:

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

Review task EVAL.ts files, package scripts and helpers as executable code,
including code at the pinned fixture/helper commit. New tasks can be in the
framework/docs PR or another public task repository; use that exact commit as
`fixtureRef`. Both conditions run the same tasks and grader from that commit.
Only the framework/package or guidance treatment changes. Public tasks and
package artifacts only; held-out tasks and customer data require private storage.

## Run

Once this runner is merged, open a comparison PR in evals OSS containing the
manifest. It points to the open framework/docs PR and pins its current base/head
commits and package artifacts. The framework/docs PR and comparison PR can both
remain unmerged. The request PR must be a branch in evals OSS targeting `main`.

A maintainer reviews the manifest and its pinned executable tasks/helpers, then
dispatches **PR eval comparison** from `main` with:

- **request_pr:** the evals OSS comparison PR number.
- **reviewed_head:** that comparison PR's exact reviewed head SHA.
- **comparison:** its manifest name, without `.json`.
- **task:** leave empty for the manifest default, enter a listed task, or `all`.

For example, after reviewing PR 200 at its current head:

```sh
gh workflow run pr-comparison.yml --repo vercel/next-evals-oss --ref main \
  -f request_pr=200 -f reviewed_head=FULL_REVIEWED_HEAD_SHA \
  -f comparison=activity-docs -f task=all
```

The trusted runner reads the unmerged manifest as data through GitHub's API.
It rejects a different request head, fork, closed PR or changed framework/docs
base/head before obtaining Vercel credentials. It does not check out the request
PR's workflow or runner scripts. Update/review the manifest after either PR
changes, then dispatch again; pushes never automatically start paid runs.

Existing predefined comparisons can still run from `main`: leave **request_pr**
and **reviewed_head** empty. One attempt runs per selected task per condition.
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

The request PR receives a **PR eval comparison** check on the reviewed commit,
with the results table and a link to the Actions run and traces. No PR comment
is posted. The check is neutral when the comparison completes, so model failures
are visible without turning a research comparison into a merge gate. Incomplete
comparisons fail the check.

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
