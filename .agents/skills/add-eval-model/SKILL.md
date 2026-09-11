---
name: add-eval-model
description: Add a model to the nextjs.org/evals board end to end — register the experiment pair, verify the model id and effort rung against the live AI Gateway, run the full pass@4 matrix, export, tier, and open the PR with results in it. Use for any "add/register/publish model X", "run the evals for X", or "update the evals site" request in this repo.
---

# Adding a model to nextjs.org/evals

## The deliverable is a landed run, not a config

A model addition is **done** when the run has happened, `agent-results.json` contains
its numbers, and a PR against the site repo carries that file. It is **not** done when
the experiment config exists.

`export-results` only exports experiments that have results, so a registered-but-unrun
model does not reach the board at all — the PR looks complete and changes nothing a
reader can see. The README's retention policy names this state and rejects it: *"a
staging post, not a destination — land the run and tier the model in the same PR, or
drop the config."*

So do not stop after step 2 below and hand back a "ready to run, just needs the
go-ahead" PR. The run costs real money (roughly $50–250 for a Fable/Opus-tier pair at
list) and takes 30–90 minutes of wall clock. Spend it, then report what it cost.
Stop early only when a step is genuinely blocked — `pnpm preflight` says a credential
is missing, or the gateway refuses the model id.

## Steps

### 1. Set up and verify credentials

```bash
pnpm install --frozen-lockfile
pnpm sync-evals 071a2343c509751585cd9f77ae66e8c30daf2ea8   # the SHA .github/workflows/eval-cache-check.yml pins
pnpm preflight
```

Sandbox auth needs **either** `VERCEL_OIDC_TOKEN` **or all three** of `VERCEL_TOKEN` +
`VERCEL_TEAM_ID` + `VERCEL_PROJECT_ID`. One or two of the triple is worse than none —
it silently falls back to OIDC and dies on `Could not get credentials from OIDC
context`. In a Vercel Devbox the token is usually in the environment and the two IDs
are in the injected instructions; put the missing ones in `.env.local` (gitignored).

Do not proceed on a red preflight.

### 2. Register the experiment pair

Confirm the model id and the effort rung against the **live gateway** before writing
either into a config. Catalogs disagree with the API and with each other; the gateway
is the source of truth.

```bash
# Id: an id the gateway does not serve answers 404 model_not_found, so a 200 here is
# real resolution rather than a silent fallback to some default model.
curl -s -o /dev/null -w '%{http_code}\n' https://ai-gateway.vercel.sh/v1/messages \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" -H 'Content-Type: application/json' \
  -H 'anthropic-version: 2023-06-01' \
  -d '{"model":"<id>","max_tokens":16,"messages":[{"role":"user","content":"ok"}]}'

# Effort: a bad rung returns 400 enumerating the real set. Worth more than any catalog.
curl -s https://ai-gateway.vercel.sh/v1/chat/completions \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"<provider/id>","reasoning_effort":"<rung>",
       "messages":[{"role":"user","content":"ok"}],"max_tokens":2000}'
```

Then, copying the newest existing pair for that harness (not the oldest — conventions
have moved):

- `experiments/<slug>.ts` and `experiments/<slug>--agents-md.ts`. Both must guard their
  `setup` with `isNextApp` from `lib/setup.js`: the framework-choice fixtures
  (`agent-044`, `agent-045`) start empty, and installing `next@canary` or writing a
  Next.js-naming `AGENTS.md` into them answers the question they exist to ask.
- `MODEL_NAMES` and `AGENTS_MD_PAIRS` in `scripts/export-results.ts`.
- `MODEL_PRICING` in `scripts/cost.ts` — read all four rates off the gateway catalog
  entry (`/v1/models`) rather than assuming they match the previous version. Cache-read
  rates in particular move between releases, and Claude Code caches heavily.
- Effort goes in the **display name**, not the slug, when the slug already carries a
  version (`Claude Fable 5.1 (high)`); use the slug when it does not
  (`gpt-6-astra-high`). Default to `high` — see "Reasoning effort" in the README.

**Pick the harness by what the box can authenticate, not by the vendor.** `pnpm
preflight` is the answer: the `gemini` and `cursor` harnesses are direct-vendor-API
only, and without `GEMINI_API_KEY` / `CURSOR_API_KEY` the runner silently skips their
experiments. `AI_GATEWAY_API_KEY` alone covers every `vercel-ai-gateway/*` harness, so
a gateway-served model from any vendor can still be measured through
`vercel-ai-gateway/opencode` — that is what glm, kimi, grok, minimax and
`gemini-3.8-flash` do. Say so in the config comment when the harness differs from the
vendor's own CLI; the board renders `agentHarness` per row, so the difference is
visible and must be true.

**A model the OpenCode binary predates needs `extraProviders`.** The pinned
`binaryUrl` carries a frozen models.dev snapshot, so anything newer resolves to nothing
unless the config fully specifies it (`name`, `reasoning`, `tool_call`, `temperature`,
`attachment`, `modalities`, `limit`; `cost` stays zeroed — this repo prices runs from
`MODEL_PRICING`, not from OpenCode).

**Effort has no working knob on the OpenCode path.** OpenCode merges a model's
`options` into `providerOptions.gateway` for `@ai-sdk/gateway` providers, and the
gateway does not act on `reasoningEffort` there — a probe at `low` still burned ~1.4k
reasoning tokens, where the same `low` sent as `reasoning_effort` to
`/v1/chat/completions` burns 0. Every OpenCode pair on the board therefore publishes
unpinned and unsuffixed even when the model advertises a ladder. Leave the label bare
rather than claiming a rung the harness never sent, and record why in the config.

**`reasoning_effort` is not validated for every model.** The 400-enumerates-the-set
trick is real for OpenAI and Anthropic ids, but `google/gemini-3.8-flash` returns 200
for a rung it does not have (`xhigh`) and simply ignores it. When the 400 does not
come, compare `completion_tokens_details.reasoning_tokens` across rungs instead — a
rung that changes nothing is a rung the model does not have.

Sanity-check the wiring before spending anything:

```bash
pnpm typecheck && pnpm test:cost
pnpm eval:dry <slug>              # confirms agent, resolved model, eval count, timeout
pnpm eval:smoke <slug>            # one real eval in a real sandbox
```

`eval:smoke` **exits 1 and leaves no results even when the eval passes** — housekeeping
deletes the run as incomplete. Read the `✓`/`✗` line, not the exit code.

### 3. Run the full matrix

```bash
pnpm eval:run <slug>
pnpm eval:run '<slug>--agents-md'
```

Run the two experiments **sequentially**. Every attempt starts concurrently within one
experiment (`StartRateLimiter(20, 2_000)` barely throttles it), so with 31 evals
`runs: 4` means ~124 live sandboxes per experiment; both at once doubles that and
invites 429s and sandbox faults. Expect 30–45 minutes each. Run it in the background
and poll the log rather than blocking on it.

Even one experiment at a time, expect a handful of `GatewayInternalServerError:
Service temporarily unavailable` attempts in the first minutes — that is the burst, not
the model. They classify as infra, get deleted, and come back on the re-run below.

`earlyExit` aborts an eval's remaining attempts once one passes, but because they all
started together it trims the tail rather than saving 4× the cost — budget for close to
the full matrix.

**Never publish a subset.** Evals an experiment never ran export as `notAvailable` and
count against its success rate, so a partial run publishes a number that reads as
model failure. `EVAL_FILTER` is for cheap credential checks, not for a board run.

Infra failures (rate limits, sandbox faults, auth) are classified and deleted rather
than counted, so re-run the experiment until `pnpm status` is quiet for it.

**A `timeout` that is too tight cannot be re-run away.** Timeouts are deleted rather
than counted, so the eval never publishes a wrong number — it just never publishes one,
and `pnpm status` stays noisy forever. Read the first matrix's mean durations before
re-running: if the evals that failed are the ones whose completed runs sit near the
ceiling, the budget is the problem, not the burst. Copying the previous pair's timeout
is a guess, and "fast model" says nothing about how long an agentic loop takes —
`gemini-3.8-flash` completes the prefetch evals at 1000–1100s and needed 2400. Raise it
once, decisively: `timeout` is part of the fingerprint, so every raise invalidates the
whole experiment. **Delete `results/<slug>/` and `results/<slug>--agents-md/` when you
do** — results recorded under the old fingerprint are not re-derived away, they stay on
disk, export as the model's last measurement, and fail `check-stale.mjs` as `changed`.

### 4. Export, tier, and clean up

```bash
pnpm export-results
```

Then, in the same PR:

- **`TIER_1`** in `scripts/export-results.ts` — add the new slug. Per the retention
  policy, each model family keeps the latest version, plus the previous one *only if*
  the new one shipped less than a month after it; otherwise remove the predecessor so
  it drops to tier 2. Put the date arithmetic in the comment.
- **`ACCEPTED_STALE`** in `scripts/check-stale.mjs` — remove any entries added for the
  new slugs while they had no results. They exist to keep CI green during registration
  and are not a licence to leave a pair unmeasured.
- Commit `results/<slug>/**` and the regenerated `agent-results.json`. Never hand-edit
  `agent-results.json`.

### 5. Verify, then open the PR

```bash
pnpm typecheck && pnpm test:cost && node scripts/check-stale.mjs
```

`check-stale.mjs` must print `Eval cache OK`.

Before committing, check `git status` for **`results/*/summary.json` churn in
experiments you did not run**. `sync-evals` refingerprints cached results as a
side effect ("carried forward N config-only result(s)"), which has nothing to do with
your change. Revert those paths — CI re-derives them — while keeping the results you
actually produced.

The PR body should state the scores for both experiments (`n/31` at the current eval
set — count `evals/`, do not copy a number out of this file), the mean cost per eval,
the tiering change and its date arithmetic, and what the AGENTS.md variant won or lost.

### 6. Publish to the site — usually nothing to do in `vercel/front`

**Merging this PR to `main` is the publish.** nextjs.org/evals fetches
`agent-results.json` from this repo's `main` on the server and `main` CI invalidates its
cache, so a model reaches the board with no PR, copy or deployment in the site repo. The
page is entirely data-driven — `modelName`, `tier`, `agentHarness`, `avgCostUsd`,
`avgDuration` and `docsImpact` all come from the JSON and there is no per-model code, so
there is nothing model-shaped to add there.

This changed on 2026-09-09 (this repo's #122, vercel/front#85415). Before that the site
carried a checked-in copy at `apps/next-site/app/(next-site)/evals/agent-results.json`;
that file is deleted. If a task asks for a paired `front` PR, do not recreate it — say
that the copy is gone and point at `get-evals.ts`.

Open a `front` PR only for a change that is genuinely about the site: the columns, the
footnotes, `get-evals.ts`, the revalidate route, or
`apps/next-site/app/(next-site)/evals/README.md`. When you do:

- `front` is a large private monorepo; a sparse shallow clone is enough:

  ```bash
  git clone --depth 1 --filter=blob:none --sparse https://github.com/vercel/front.git
  cd front && git sparse-checkout set "apps/next-site/app/(next-site)/evals"
  ```

- It pins Node 24 via `.node-version`, which a non-interactive shell will not pick up —
  `node -v` reporting 22 makes `pnpm` refuse the workspace on `engines.node`. Put
  `~/.local/share/fnm/node-versions/v24.14.0/installation/bin` on `PATH` first.
- Run `pnpm unit-test -- test/evals.test.tsx test/get-evals.test.ts
  test/evals-revalidate.test.ts` from `apps/next-site`, and format with `npx oxfmt` for
  `.tsx` / `npx prettier` for `.md` — the repo checks both.
- The GitHub contents API cannot write here: `front` requires verified signatures and
  rejects API-authored commits with a 409. Clone and `git push` instead.
