# Next.js Evals

Agent evaluations for Next.js coding tasks, powered by [`@vercel/agent-eval`](https://www.npmjs.com/package/@vercel/agent-eval).

## Setup

```bash
pnpm install                # pnpm is pinned via packageManager
cp .env.example .env.local  # then fill in the keys — see below
pnpm sync-evals             # fetch the eval fixtures; the repo ships none
```

`.env.local` needs two things:

| Variable | Why |
|----------|-----|
| `AI_GATEWAY_API_KEY` | Every experiment routes its agent through the Vercel AI Gateway, and the failure classifier uses the same key |
| `VERCEL_OIDC_TOKEN`, or `VERCEL_TOKEN` + `VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID` | Every experiment sets `sandbox: "vercel"` |

For the OIDC route, run `vercel link` once, then `vercel env pull .env.local` to
write (and later refresh) the token. Supply nothing and `@vercel/sandbox` drops
into an interactive "sign in with Vercel" device flow — and with no team/project
pinned it can create a stray default project. The runner loads `.env.local`
first and `.env` second, so `.env` wins; both override the ambient shell
environment.

## Scripts

### `pnpm sync-evals [ref]`

The eval fixtures live in [`vercel/next.js`](https://github.com/vercel/next.js)
under `evals/evals/`, not here — `evals/` is git-ignored and populated by a
sparse checkout. **Nothing runs until you sync.**

```bash
pnpm sync-evals        # canary (default)
pnpm sync-evals <sha>  # a pinned commit, branch, or tag
```

Syncing also runs `agent-eval refingerprint`, which carries CONFIG-only changes
forward in cached results. A real eval-content change is deliberately left stale
so `pnpm eval status` reports it instead of the old result being re-stamped as
fresh. To match CI exactly, sync the SHA pinned in
`.github/workflows/eval-cache-check.yml`.

### `pnpm eval`

Runs agent evaluations with memoization: only (model, eval) pairs that haven't
been completed yet are executed.

```bash
pnpm eval status                     # new/changed evals and the work per experiment (read-only)
pnpm eval run <exp> [exp...]         # run the missing pairs for one or more experiments
pnpm eval run <exp> --smoke          # one eval only — checks keys, model ID, sandbox
pnpm eval run <exp> --force          # ignore fingerprints, re-run everything
pnpm eval                            # status, then pick an experiment interactively
pnpm eval <experiment> --dry         # preview one experiment's plan, execute nothing
```

`run` (and the interactive picker) is the memoized path: it fingerprints each
fixture, skips pairs that are already fresh, writes to
`results/<experiment>/<timestamp>/`, and classifies failures afterwards so
infra/timeout failures don't get stored as model results.

**Passing a config name directly — `pnpm eval <experiment>` — is not the same
command.** It ignores fingerprints (every eval re-runs) and writes to
`results/<experiment>/<model>/<timestamp>/`, a path `status`,
`check-stale.mjs`, and `export-results` never read. Keep that form for `--dry`.

Experiment names are the filenames in `experiments/` (e.g. `claude-opus-5`);
`status` and `run` also accept glob patterns. `EVAL_FILTER` narrows a run to a
subset of evals — every config reads it (`evals: process.env.EVAL_FILTER ?? "*"`),
so `EVAL_FILTER=agent-035-connection-dynamic pnpm eval run claude-opus-5` runs
just that one.

The runner automatically detects:
- **New model added** → runs all evals for that model
- **New eval added** → runs that eval for all models
- **Already completed** → skips

Start with `pnpm eval run <experiment> --smoke` on a fresh checkout: it exercises
the whole path (gateway key, sandbox credentials, agent CLI install, `next build`,
assertions) for the price of a single eval. Smoke results are tagged and are
never reused as real results.

### `pnpm export-results`

Exports clean results to `agent-results.json`. Non-model failures (infra/timeout) are automatically deleted during eval runs, so only valid model results are exported.

Each experiment also gets an `avgCostUsd`: the mean list cost per eval. Tokens are read from each run's `transcript-raw.jsonl` (handled per harness in `scripts/cost.ts`) and multiplied by the list prices in `MODEL_PRICING`. A model with no price entry, or whose runs carry no token usage, exports `null` and renders as N/A. Prices are a snapshot, so re-run the export to refresh them.

### `pnpm test:cost` and `pnpm typecheck`

Unit tests for the token extraction and pricing in `scripts/cost.ts`, and a
`tsc --noEmit` pass over `experiments/` and `scripts/`. Both run in CI.

## CI

`.github/workflows/eval-cache-check.yml` installs, syncs the pinned
`vercel/next.js` SHA, and runs `scripts/check-stale.mjs`. The
"which staleness is acceptable" policy lives in that script, not in the
framework: it reads `agent-eval status --json` and fails on any new or changed
eval whose `(experiment, eval)` pair isn't listed in `ACCEPTED_STALE`. To adopt
new or changed evals, bump the SHA in the workflow, rerun the experiments you're
refreshing, and list the remaining pairs in `ACCEPTED_STALE`.

## Eval structure

Each eval is a self-contained Next.js project:

```
evals/agent-031-proxy-middleware/
├── PROMPT.md        # task given to the agent
├── EVAL.ts          # vitest assertions (withheld from the agent)
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

Evals are authored upstream — `evals/` here is a read-only sync target, and
anything you add to it is wiped by the next `pnpm sync-evals`.

1. Add the eval directory to `evals/evals/` in [`vercel/next.js`](https://github.com/vercel/next.js) and land it on `canary`
2. Bump the pinned SHA in `.github/workflows/eval-cache-check.yml` to a commit that contains it
3. `pnpm sync-evals <sha>` locally, then `pnpm eval status` — the new eval shows up as work for every experiment
4. `pnpm eval run <experiment>` for the experiments you're refreshing, and add the remaining `(experiment, eval)` pairs to `ACCEPTED_STALE` in `scripts/check-stale.mjs`

## Adding a new model

1. Create a config in `experiments/` (e.g., `experiments/gpt-5.ts`)
2. Add the display name to `MODEL_NAMES` in `scripts/export-results.ts`
3. Add the list price to `MODEL_PRICING` in `scripts/cost.ts` (or the cost column shows N/A)
4. For an `--agents-md` variant, map it to its base in `AGENTS_MD_PAIRS` in `scripts/export-results.ts` so the two share pricing
5. Run `pnpm eval run <experiment>` — every eval runs for the new model

## Publishing to nextjs.org/evals

After running evals:

1. Export results: `pnpm export-results`
2. Copy to front repo:
   ```bash
   cp agent-results.json <path-to-front>/apps/next-site/app/\(next-site\)/evals/agent-results.json
   ```
3. Commit and deploy the front repo

## Current evals

As synced at the SHA pinned in CI:

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
| agent-040 | Instant navigation — title paints immediately |
| agent-041 | Optimize the partial prerendering shell |
| agent-042 | Enable partial prerendering |
| agent-043 | View transitions — shared-element morph |

## License

See [LICENSE](LICENSE).
