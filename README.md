# Next.js Evals

Agent evaluations for Next.js coding tasks, powered by [`@vercel/agent-eval`](https://www.npmjs.com/package/@vercel/agent-eval).

Each eval hands a coding agent a small Next.js app and a prompt, lets it work in an
isolated sandbox, then runs withheld assertions against what it produced.

## Quick start

```bash
pnpm bootstrap                 # install, sync eval fixtures, check credentials
cp .env.example .env.local     # then fill in the credentials it asked for
pnpm preflight                 # confirm they resolve
pnpm eval:smoke claude-opus-5  # one eval, one run, real sandbox
```

`pnpm bootstrap` is not required — it just runs the three setup steps below in
order, because the middle one is easy to miss.

## Setup

### 1. Install

```bash
pnpm install --frozen-lockfile
```

pnpm only: the lockfile and `packageManager` pin are pnpm, and CI installs frozen.

### 2. Sync the eval fixtures — required

```bash
pnpm sync-evals          # from vercel/next.js@canary
pnpm sync-evals <ref>    # ...or a branch, tag, or commit SHA
```

**The evals are not in this repo.** They live in
[`vercel/next.js`](https://github.com/vercel/next.js/tree/canary/evals/evals) and
`evals/` is git-ignored here, so a fresh clone has no fixtures and every command
fails with `Evals directory not found`. `sync-evals` sparse-checkouts them.

Fixtures listed in upstream `evals/eval.config.json` use local skill treatments
for PR development. `sync-evals` omits them from this repository's public model
and bundled-docs matrix. Syncing never relabels old results as passes: content
changes stay stale until rerun.

Syncing from `canary` picks up whatever landed upstream since results were last
recorded, so it usually reports evals as changed:

```
N result(s) have a changed eval and were left stale — run them to refresh.
```

That is expected, not a problem — it is the incremental workflow telling you what
`pnpm status` will now list as work. To match CI instead, pass the SHA that
[`.github/workflows/eval-cache-check.yml`](.github/workflows/eval-cache-check.yml)
pins.

### 3. Provide credentials

Copy [`.env.example`](.env.example) to `.env.local` and fill in what you need.
`pnpm preflight` reports exactly which variables are missing, and for which
experiments — run it instead of guessing.

**Sandbox.** Every experiment sets `sandbox: "vercel"`, so runs need Vercel
Sandbox credentials by one of two paths:

| Path | Variables | Notes |
|------|-----------|-------|
| OIDC | `VERCEL_OIDC_TOKEN` | `npx vercel link && npx vercel env pull .env.local`. Short-lived — re-pull when it expires. Also authenticates the AI Gateway. |
| Access token | `VERCEL_TOKEN` **and** `VERCEL_TEAM_ID` **and** `VERCEL_PROJECT_ID` | All three or none. |

A partial token triple is the real trap here: `@vercel/sandbox` only treats the
three as credentials when all three are set, so one or two silently falls back to
the OIDC path and fails with `Could not get credentials from OIDC context` — which
names neither the variable you forgot nor the path you meant. `pnpm preflight`
calls this out.

**Agents.** Each experiment names an `agent`, and the agent decides which key it
reads. `VERCEL_OIDC_TOKEN` can authenticate `vercel-ai-gateway/*` agents, while
direct agents still require their own credential. The automated release matrix
contains only AI Gateway agents and deliberately uses the release project's
separately budgeted `AI_GATEWAY_API_KEY` for every model call.

| Agent | Key |
|-------|-----|
| `vercel-ai-gateway/*` (most experiments) | `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` |
| `claude-code` | `CLAUDE_CODE_OAUTH_TOKEN` if set, else `ANTHROPIC_API_KEY` |
| `codex` | `OPENAI_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `cursor` | `CURSOR_API_KEY` |

Missing an agent's key is not fatal: the runner prints `… not set, skipping
<experiment>` and moves on. That line is easy to lose in a long run, so
`pnpm preflight <experiment>` fails outright when you name an experiment you
cannot actually run.

## Scripts

| Script | What it does |
|--------|--------------|
| `pnpm bootstrap [ref]` | Install, sync fixtures, run preflight. |
| `pnpm preflight [experiment...]` | Check toolchain, fixtures, sandbox auth, and agent keys. Read-only. Names or globs narrow it; naming an experiment makes a missing key an error rather than a warning. |
| `pnpm status [experiment...]` | What is new or changed, per experiment, and the work that implies. Read-only. |
| `pnpm eval:dry <experiment>` | Print the plan — evals, runs, model, sandbox backend — without executing. |
| `pnpm eval:smoke <experiment...>` | One eval, one run each. The cheapest thing that proves credentials and sandbox actually work. |
| `pnpm eval:run <experiment...>` | Run the new/changed evals for those experiments. |
| `pnpm eval` | Interactive: show status, then pick. |
| `pnpm playground` | Web UI for browsing results in `results/`. |
| `pnpm sync-evals [ref]` | Re-sync fixtures from `vercel/next.js`. |
| `pnpm export-results` | Write `agent-results.json` for nextjs.org/evals. |
| `pnpm typecheck` | `tsc --noEmit` over experiments, shared helpers, and TypeScript scripts. |
| `pnpm test:cost` | Unit tests for token extraction and pricing in `scripts/cost.ts`. |
| `pnpm test:release` | Unit tests for release targeting and the reporting gate. |

Anything that runs an eval takes experiment names or globs — `pnpm eval:run
'claude-*'`. Some experiments also honour `EVAL_FILTER` (an eval name, a glob, or a
comma-separated list) to narrow which evals run; that is per-config, so check the
experiment before relying on it.

Results are memoized by a fingerprint of the eval content plus the experiment
config, so a re-run only covers what actually changed. `--force` ignores the cache.

Normal runs retain the experiment's configured pass@4 behavior. Release and
backport automation sets `NEXT_RELEASE_EVAL_RUNS=1` for its separate pass@1
measurement. Setting `NEXT_EVAL_VERSION` to an exact version such as `16.2.4`
installs and verifies `next@16.2.4` in each existing Next.js fixture; without it,
local runs continue to use `next@canary`.

### `pnpm export-results`

Exports clean results to `agent-results.json`. Non-model failures (infra/timeout)
are automatically deleted during eval runs, so only valid model results are
exported.

`pnpm export-results --check` verifies that the committed JSON matches a full
export, ignoring only `metadata.exportedAt`. CI runs this check without changing
the file. Export errors exit nonzero and an empty export is rejected.

Each experiment also gets an `avgCostUsd`: the mean list cost per eval. Tokens are
read from each run's `transcript-raw.jsonl` (handled per harness in
`scripts/cost.ts`) and multiplied by the list prices in `MODEL_PRICING`. A model
with no price entry, or whose runs carry no token usage, exports `null` and renders
as N/A. Prices are a snapshot, so re-run the export to refresh them.

## Eval structure

Each eval is a self-contained Next.js project:

```
evals/agent-031-proxy-middleware/
├── PROMPT.md        # task given to the agent
├── EVAL.ts          # assertions (withheld from the agent)
├── package.json     # Next.js project manifest
├── tsconfig.json
├── next.config.ts
└── app/
    ├── layout.tsx
    └── page.tsx
```

| File | Purpose |
|------|---------|
| `PROMPT.md` | The task prompt sent to the agent |
| `EVAL.ts` | Test file run after the agent finishes (withheld from agent) |
| `package.json` | Must have `"type": "module"` and a `"build"` script |
| Everything else | Source files the agent can see and modify |

## Adding a new eval

Evals are authored in
[`vercel/next.js`](https://github.com/vercel/next.js/tree/canary/evals/evals), not
here — `evals/` in this repo is a synced copy and is git-ignored, so anything you
add to it locally is overwritten by the next `pnpm sync-evals`.

1. Add the eval upstream, under `evals/evals/` in `vercel/next.js`.
2. Here: `pnpm sync-evals` to pull it in.
3. `pnpm status` — it shows up as `new` for every experiment.
4. `pnpm eval:run <experiment>` to record results.

## Adding a new model

1. Create a config in `experiments/` (e.g., `experiments/gpt-5.ts`)
2. Add the display name to `MODEL_NAMES` in `scripts/export-results.ts`
3. Add the list price to `MODEL_PRICING` in `scripts/cost.ts` (or the cost column shows N/A)
4. `pnpm eval:run <experiment>` — every eval is new for it

Editing an existing experiment config changes its fingerprint, which makes its
cached results stale. That is the intended signal, but it means config churn costs
real re-runs.

RoboEve model-registration pull requests run through the hourly
[`model-pr-evals.yml`](.github/workflows/model-pr-evals.yml). The workflow accepts
only same-repository branches created by `roboeve[bot]` under `v/register-*` whose
exact head commit two distinct maintainers with write or admin access have
approved in pull request reviews. Git author and committer identities are
editable metadata, so they are not used for authorization. The experiment files
are code the credentialed job executes, so those reviews are the gate: approve
the pull request once the two new experiment files look right, and any later push
drops both approvals until two maintainers review the new head. The workflow then
runs the oldest unmeasured eligible pull request's new base and AGENTS.md pairs
sequentially against the pinned eval suite. A manual dispatch can select an
eligible pull request by number but cannot skip the approval. It records normal
pass@4 results against `next@canary`, regenerates
`agent-results.json`, and pushes the sanitized output back to the draft pull
request. A matrix counts as complete only when every eval has a fresh result
that passes the release gate's validity rules: a classified model failure or a
pass, a transcript and evaluator output for every run, and no batch marked
invalid. A rejected result is deleted and measured again on the next recovery
pass; after the last pass the run fails instead of publishing it.

Every job that holds a credential runs this repository's `main` code. The model
jobs check out `main`, copy in only the pull request's new experiment files, and
hold short-lived Vercel credentials with read-only repository access. The pull
request's own export and cost scripts run in a separate job with no Vercel or
model credential and no write access. The only job allowed to push receives the
sanitized artifacts, rechecks them for credentials with `main`'s script, and
commits them without installing or running anything from the pull request. The
pull request still requires human review of the model configuration, complete
results, tier, and recurring-release decision before merge. The Vercel CLI OIDC
policy must allow this workflow on `main` as well as the release workflow.

### Reasoning effort

Models that expose a reasoning-effort ladder get published at a **reasonable
effort, not their ceiling** — `high` where a low→max ladder exists. The board is
meant to tell someone what a model does on their Next.js work, and almost nobody
runs day-to-day coding at top effort: it costs disproportionately more for a
marginal gain, and it flatters models whose ceiling is mostly a pricing tier. A
model measured at a rung nobody pays for is not a useful data point.

So pick the rung by what people run, not by what the vendor offers:

- Default to `high`. Encode the effort in the experiment slug and the
  `MODEL_NAMES` label — `gpt-6-astra-high`, `GPT 6 Astra (high)` — so the board
  never shows a score without saying what produced it.
- Going above `high` needs a reason in the config comment, not just headroom.
- **Confirm the rung exists before running.** Sending an effort the model does
  not accept is a whole wasted matrix. The gateway is the source of truth and it
  validates: a bad value returns HTTP 400 whose message enumerates the real set,
  which is worth more than any catalog.

  ```bash
  curl -s https://ai-gateway.vercel.sh/v1/chat/completions \
    -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
    -H 'Content-Type: application/json' \
    -d '{"model":"<id>","reasoning_effort":"<rung>",
         "messages":[{"role":"user","content":"ok"}],"max_tokens":2000}'
  ```

  Catalogs disagree with the API and with each other — `openai/gpt-6-astra`
  accepts `minimal`, which neither the gateway's own `/v1/models` nor models.dev
  lists. Trust the 400.

## CI

[`eval-cache-check.yml`](.github/workflows/eval-cache-check.yml) syncs fixtures at
a pinned `vercel/next.js` SHA and runs `scripts/check-stale.mjs`, which fails on any
new or changed eval that is not listed in that script's `ACCEPTED_STALE`. CI never
runs an eval — it only checks that the cache is fresh or explicitly accepted as
stale. To adopt upstream changes: bump the SHA, re-run the experiments you are
refreshing, and record the rest in `ACCEPTED_STALE`.

### Release, backport, and canary automation

[`release-evals.yml`](.github/workflows/release-evals.yml) runs entirely in this
repository. An hourly check discovers stable releases and backports published
after the monitor baseline in [`release-monitor.json`](release-monitor.json).
Manual dispatch accepts one exact published stable or canary version, so canary
measurements run only when a maintainer explicitly requests one. Discovery
resolves the matching public tag, commit SHA, successful `vercel/next.js`
build-and-deploy run, and source branch before any model job starts. Existing
verified automation-authored measurement pull requests are skipped unless a
maintainer explicitly requests a forced manual rerun.

The workflow runs every tier-1 model both with and without AGENTS.md against a
fixed eval suite. Existing Next.js fixtures install the exact published package,
so agents read the documentation bundled in that release from
`node_modules/next/dist/docs`. The release commit SHA is recorded as provenance;
the eval definitions stay pinned by [`eval-suite-ref.txt`](eval-suite-ref.txt) so
release, backport, and canary measurements remain comparable.

Release, backport, and canary measurements always use pass@1 through the
`NEXT_RELEASE_EVAL_RUNS=1` workflow override. Normal local runs and publishable
benchmark runs retain their configured pass@4 behavior. This keeps the
release-monitoring series separate from the public leaderboard.

Infrastructure attempts are discarded and retried up to three times. The
reporting gate requires one valid result for every eval and rejects missing
transcripts, missing evaluator output, agent-runner exit 143, and known evaluator
startup failures. Genuine assertion failures remain valid pass@1 data. Each
genuine first-attempt model failure then receives two isolated confirmation
attempts. Those attempts never change the pass@1 score; they only distinguish a
reproducible failure from an unstable first attempt.

The workflow runs and aggregates release measurements in a temporary workspace
outside the repository. Matrix jobs validate their raw output in place, then
pass score summaries, compact failure confirmations, and the full validated run
output to the aggregation job. Before passing or committing generated data, the
workflow rejects it if it contains the exact value of a credential available to
that job. The temporary transport artifacts expire after one day.

Each completed run opens a draft pull request under
`measurements/releases/<version>/<run-id>/`. The pull request contains the
durable aggregate measurement, release provenance, failure confirmations, and
the complete sanitized output from the scored and confirmation attempts. This
includes transcripts, evaluator output, and command output for inspecting the
agent's reasoning. It never writes to the publishable `results/` tree or
`agent-results.json`, so merging it records the measurement without publishing
anything to `nextjs.org/evals`.

After the draft pull request is opened, the workflow sends a compact validated
report to the [Eve release agent](apps/release-agent). Eve writes one concise message to
`team-agent-measurements` with the release path, pass@1 totals with and without
AGENTS.md, and meaningful model/task failures. The summary identifies the
measurement as separate from the public pass@4 board. Follow-up questions in
that Slack thread use the same report context; questions about published data
use Eve's read-only repository tool.

Scheduled and manual runs are accepted only from this repository's `main`
branch. Model jobs receive read-only repository access and `id-token: write`.
They exchange the GitHub Actions identity for a short-lived, project-scoped
Vercel access token. That token and the non-secret team and project IDs
authenticate Vercel Sandbox. The same fresh GitHub identity authenticates the
release agent's intake route. Restrict the Vercel CLI policy to this workflow
on `vercel/next-evals-oss@main`. For the scoped project, allow `vc sandbox
create` and non-production `vc env` commands.
Model-running jobs also receive the project's separately budgeted
`AI_GATEWAY_API_KEY`; the reporting job does not. Direct agents are excluded
from this matrix. The non-secret Vercel project identifiers and agent URL are
repository variables. No long-lived Vercel token or model-provider secret is
stored in GitHub.

Only the final publishing job receives write-scoped `GITHUB_TOKEN` permissions
after aggregation has produced and rechecked a sanitized measurement artifact.
Model-running jobs cannot write to the repository, and no GitHub App private
key is required.

Slack installation tokens and request verification stay in the
`slack/next-evals-release-agent` Vercel Connect connector. GitHub Actions does
not hold a Slack webhook or bot token.

## Publishing to nextjs.org/evals

After running evals:

1. Export the full dataset: `pnpm export-results`.
2. Include `agent-results.json` with the results in your PR to this repo.
3. Merge the reviewed PR to `main`.

nextjs.org/evals reads the
[published JSON](https://raw.githubusercontent.com/vercel/next-evals-oss/main/agent-results.json)
on the server — the server-fetch integration shipped on 2026-09-09
(vercel/front#85415), and the copy the site used to carry is deleted. Result
updates require no copy, PR, or deployment in `front`. Merging this file to
`main` publishes it to the website.

After the checks pass on `main`, CI calls
`POST https://nextjs.org/api/evals/revalidate` using a short-lived GitHub Actions
OIDC token. Only the `main` workflow can invalidate production; PR runs only
validate results. No shared secret needs provisioning.

The website caches the snapshot without timed server revalidation. Invalidation
starts a stale-while-revalidate window: subsequent requests can trigger a
background refresh and receive the old snapshot for up to one hour, after which
a server request must wait for fresh data. Browser navigation can reuse a page
for five minutes, and already-open tabs need a refresh. Each upstream refresh
bypasses GitHub's raw-file cache using a unique query parameter.

Delivery is retried three times and fails the `revalidate-site` job if
unsuccessful. Rerun that job or manually dispatch this workflow on `main` to
retry; there is no periodic refresh to repair a missed notification. Revert the
JSON change and pass `main` CI to roll back published results through the same
process.

Keep the existing JSON shape compatible with the website. Coordinate changes
to required fields or scoring semantics with `front`; the format is currently
unversioned.

## Model retention policy

The published board is two tiers:

- **Tier 1 (current)**: models with a complete run of the current eval set on a
  recent Next.js canary. Per model family, tier 1 carries the **latest version,
  plus the previous version if and only if the current version was released
  less than one month after it** (a just-superseded model is still what many
  people run; an older gap means it is simply outdated). A variant line the
  vendor stopped shipping (e.g. the codex-branded GPTs after 5.3-codex) is
  superseded by the vendor's main line, not kept as its own family. A tier-1
  model that goes stale — the eval set or canary moved on — gets rerun, not
  left to coast on old measurements.
- **Tier 2 (previously measured)**: every other model keeps its last measured
  results for historical reference, clearly dated, and is not rerun.

A model can also be *registered but unmeasured*: an experiment config, a
display name and a list price exist, but no run does. It is in neither tier and
does not reach the board at all, because `export-results` only exports
experiments that have results. That state is a staging post, not a
destination — land the run and tier the model in the same PR, or drop the
config.

Models the provider no longer serves (e.g. Cursor Composer 1.5) are removed
entirely rather than kept in tier 2 — every published experiment must be
reproducible.

## Scoring and cost methodology

**The published board remains pass@4.** Normal experiment configs use four runs
with early exit, preserving the existing public methodology. Release and
backport automation applies a workflow-only pass@1 override and keeps those
measurements in isolated measurement pull requests instead of publishing them.
This supplies the stricter repeated-release baseline used to identify saturated
tasks without mixing pass@1 and pass@4 scores on the leaderboard.
Infrastructure failures (rate limits, sandbox faults, missing transcripts, and
evaluator startup failures) are invalid data: the release workflow discards and
retries them and does not report an incomplete measurement.

**Costs use provider-reported token counts.** Each run's usage (input, output,
cache read/write) comes from the token counts the model's own API reported in
the transcript, priced at the list rates in `scripts/cost.ts` (snapshotted
from the AI Gateway / models.dev `vercel` entries). For the rare transcript
that carries no usage, `estimateUsageFromTranscript` falls back to a canonical
approximation — visible text length / 4, assistant text priced as output,
cache traffic assumed zero. Runs with no transcript at all (e.g. timeouts) are
excluded from cost averages.

## Current evals

As synced from `vercel/next.js@canary`. Upstream is the source of truth — after a
sync, `ls evals/` is authoritative.

| Eval | Tests |
|------|-------|
| agent-000 | Pages Router → App Router migration (simple) |
| agent-021 | Avoid fetch in useEffect |
| agent-022 | Prefer server actions |
| agent-023 | Avoid getServerSideProps |
| agent-024 | Avoid redundant useState |
| agent-025 | Prefer Next.js Link |
| agent-026 | No serial await |
| agent-027 | Prefer Next.js Image |
| agent-028 | Prefer Next.js Font |
| agent-029 | Use cache directive |
| agent-030 | Pages Router → App Router migration (hard) |
| agent-031 | Proxy (formerly middleware) — Next.js 16 |
| agent-032 | Use cache with cache components |
| agent-033 | Forbidden auth |
| agent-034 | Async cookies/headers |
| agent-035 | connection() for dynamic rendering |
| agent-036 | after() for post-response work |
| agent-037 | updateTag() for read-your-own-writes |
| agent-038 | Refresh page via revalidatePath |
| agent-039 | Indirect proxy (request logging) |
| agent-040 | Instant navigation |
| agent-041 | Optimize the PPR shell |
| agent-042 | Enable PPR |
| agent-043 | View transitions with shared elements |
| agent-048 | Prefetch URL data |
| agent-049 | Defer content to a selected prefetch |
| agent-051 | Defer content until navigation |
| agent-052 | Keep session data out of a public cache |
| agent-053 | Preserve a useful URL-dependent shell |

## License

See [LICENSE](LICENSE).
