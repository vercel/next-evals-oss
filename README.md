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
reads. `VERCEL_OIDC_TOKEN` is the fallback for all of them, so the OIDC path above
can cover this whole table on its own.

| Agent | Key |
|-------|-----|
| `vercel-ai-gateway/*` (most experiments) | `AI_GATEWAY_API_KEY` |
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
| `pnpm typecheck` | `tsc --noEmit` over `experiments/`. |
| `pnpm test:cost` | Unit tests for token extraction and pricing in `scripts/cost.ts`. |

Anything that runs an eval takes experiment names or globs — `pnpm eval:run
'claude-*'`. Some experiments also honour `EVAL_FILTER` (an eval name, a glob, or a
comma-separated list) to narrow which evals run; that is per-config, so check the
experiment before relying on it.

Results are memoized by a fingerprint of the eval content plus the experiment
config, so a re-run only covers what actually changed. `--force` ignores the cache.

### `pnpm export-results`

Exports clean results to `agent-results.json`. Non-model failures (infra/timeout)
are automatically deleted during eval runs, so only valid model results are
exported.

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

## CI

[`eval-cache-check.yml`](.github/workflows/eval-cache-check.yml) syncs fixtures at
a pinned `vercel/next.js` SHA and runs `scripts/check-stale.mjs`, which fails on any
new or changed eval that is not listed in that script's `ACCEPTED_STALE`. CI never
runs an eval — it only checks that the cache is fresh or explicitly accepted as
stale. To adopt upstream changes: bump the SHA, re-run the experiments you are
refreshing, and record the rest in `ACCEPTED_STALE`.

## Publishing to nextjs.org/evals

After running evals:

1. Export results: `pnpm export-results`
2. Copy to front repo:
   ```bash
   cp agent-results.json <path-to-front>/apps/next-site/app/\(next-site\)/evals/agent-results.json
   ```
3. Commit and deploy the front repo

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
  results for historical reference, clearly dated, and is not rerun. Grok 4.6
  qualifies as the latest Grok family member but stays tier 2 until it can
  actually be rerun (Vercel AI Gateway provider ACL). `cursor-grok-4.6-xhigh`
  is the Cursor-harness sibling that uses `CURSOR_API_KEY` instead.

Models the provider no longer serves (e.g. Cursor Composer 1.5) are removed
entirely rather than kept in tier 2 — every published experiment must be
reproducible.

## Scoring and cost methodology

**Scoring is pass@4.** Each eval runs up to four attempts (`runs: 4`,
`earlyExit: true`): the eval passes if any attempt passes, and remaining
attempts abort on the first pass. A published failure means four genuine model
failures — attempts that die on infrastructure (rate limits, sandbox faults,
auth) are classified by the failure classifier, deleted, and rerun rather than
counted against the model.

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

## License

See [LICENSE](LICENSE).
