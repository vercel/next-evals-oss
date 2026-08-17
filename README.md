# Next.js Evals

Agent evaluations for Next.js coding tasks, powered by [`@vercel/agent-eval`](https://www.npmjs.com/package/@vercel/agent-eval).

## Setup

```bash
npm install
cp .env.local .env   # requires VERCEL_OIDC_TOKEN and AI_GATEWAY_API_KEY
```

## Scripts

### `npm run eval`

Runs agent evaluations with memoization. Only runs (model, eval) pairs that haven't been completed yet.

```bash
npm run eval              # Run only missing pairs
npm run eval:dry          # Preview what would run
npm run eval -- --force   # Re-run everything
npm run eval:smoke        # Run 1 eval per experiment (sanity check)
```

The runner automatically detects:
- **New model added** → runs all evals for that model
- **New eval added** → runs that eval for all models
- **Already completed** → skips

### `npm run export-results`

Exports clean results to `agent-results.json`. Non-model failures (infra/timeout) are automatically deleted during eval runs, so only valid model results are exported.

Each experiment also gets an `avgCostUsd`: the mean list cost per eval. Tokens are read from each run's `transcript-raw.jsonl` (handled per harness in `scripts/cost.ts`) and multiplied by the list prices in `MODEL_PRICING`. A model with no price entry, or whose runs carry no token usage, exports `null` and renders as N/A. Prices are a snapshot, so re-run the export to refresh them.

### `npm run test:cost`

Unit tests for the token extraction and pricing in `scripts/cost.ts`.

### `npm run check-secrets`

Fails if a credential is present in any tracked file, and runs in CI on every PR.

This is a backstop for one specific leak: the opencode agent is configured through a
project-local `opencode.json` that the framework writes into the sandbox with the live
AI Gateway credential in it, so any model that decides to `read` that file — and it is
one of the first files in `/workspace` — copies the credential into the run's
transcript, which then gets committed. The credential is normally a Vercel OIDC token
with a 12-hour TTL, so a leak expires on its own, but this repo is public.

```bash
npm run check-secrets            # report offenders, exit 1
npm run check-secrets -- --write # redact them in place
```

If CI flags a run you are about to commit, redact with `--write` and commit the result.
Rotate only if a long-lived vendor key shows up: redacting a file that was already
pushed does not revoke the key.

## Eval structure

Each eval is a self-contained Next.js project in `evals/`:

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

1. Create a directory under `evals/` (e.g., `evals/agent-040-my-eval/`)
2. Add `PROMPT.md` with the task description
3. Add `EVAL.ts` with vitest assertions
4. Add `package.json` with `"type": "module"` and `"build": "next build"`
5. Add the Next.js source files the agent starts with
6. Run `npm run eval` — it will automatically run the new eval for all models

## Adding a new model

1. Create a config in `experiments/` (e.g., `experiments/gpt-5.ts`)
2. Add the display name to `MODEL_NAMES` in `scripts/export-results.ts`
3. Add the list price to `MODEL_PRICING` in `scripts/cost.ts` (or the cost column shows N/A)
4. Run `npm run eval` — it will automatically run all evals for the new model

## Publishing to nextjs.org/evals

After running evals:

1. Export results: `npm run export-results`
2. Copy to front repo:
   ```bash
   cp agent-results.json <path-to-front>/apps/next-site/app/\(next-site\)/evals/agent-results.json
   ```
3. Commit and deploy the front repo

## Current evals

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

## License

See [LICENSE](LICENSE).
