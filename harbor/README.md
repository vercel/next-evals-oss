# Harbor port (spike)

Runs the same evals as `@vercel/agent-eval` on
[Harbor](https://www.harborframework.com/) (Laude Institute, the
terminal-bench team). Companion to the framework-evals port; harness
comparison lives in framework-evals `docs/harbor-assessment.md`.

Both `evals/` and `harbor/tasks/` are generated, gitignored artifacts:

```bash
pnpm install
pnpm sync-evals          # vercel/next.js@canary -> evals/  (existing flow)
./harbor/sync-tasks.sh   # evals/ + templates    -> harbor/tasks/ (24 tasks)
```

## Layout mapping

| agent-eval                            | harbor                                        |
|---------------------------------------|-----------------------------------------------|
| `evals/<eval>/PROMPT.md`              | `tasks/<eval>/instruction.md`                 |
| `evals/<eval>/` fixture               | `tasks/<eval>/environment/workspace/`         |
| `evals/<eval>/EVAL.ts` (withheld)     | `tasks/<eval>/tests/EVAL.ts` (uploaded post-run) |
| experiments `setup()` canary bump     | `RUN npm install next@canary` in Dockerfile   |
| experiments `scripts: ['build']`      | `npm run build` step in `tests/test.sh`       |
| harness-written `vitest.config.ts`    | written by `tests/test.sh` (same content)     |
| `eval-helper.mjs` + judge runner      | shipped in `tests/`, staged at `__agent_eval__/` |
| experiments `timeout: 720`            | `task.toml` `[agent] timeout_sec = 720`       |

## LLM-judge evals

3 of 24 evals (`agent-030`, `agent-034`, `agent-041`) call
`toSatisfyCriterion` from `@vercel/agent-eval/eval`, which re-invokes the
claude CLI at grading time. `test.sh` stages the vendored `eval-helper.mjs`
and `run.mjs` at the hard-coded `__agent_eval__/` paths, and `task.toml`
`[verifier.env]` forwards `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` /
`ANTHROPIC_MODEL` from the host (empty defaults keep credential-free runs
working). The claude CLI installed for the agent phase is reused — the
verifier runs in the same container.

## Running

Prereqs: Docker running, `uv tool install harbor`. `-y` auto-confirms the
host-env access prompt (required for non-interactive runs).

Set `HARBOR_TELEMETRY=0` for every run. Harbor sends a PostHog event per job
by default, and the payload includes `model_names`, `agent_names`, and
`reward_mean` (`telemetry.py:115-117,151` at harbor 19f72aa). With
unreleased or EAP model strings that is a leak. Job results themselves never
leave the machine: `harbor run` only writes the local `jobs/` directory, and
Hub sharing is a separate explicit command.

```bash
export HARBOR_TELEMETRY=0

# Red-path proof, no tokens: nop agent leaves the fixture unmodified.
harbor run -y -p harbor/tasks/agent-021-avoid-fetch-in-effect -a nop --job-name nop-021

# Real run through the Vercel AI Gateway (fresh VERCEL_OIDC_TOKEN, ~12h expiry).
export ANTHROPIC_BASE_URL=https://ai-gateway.vercel.sh
export ANTHROPIC_AUTH_TOKEN=$VERCEL_OIDC_TOKEN
export ANTHROPIC_MODEL=claude-sonnet-4-6   # judge model for the 3 judge evals
harbor run -y -p harbor/tasks/agent-034-async-cookies -a claude-code \
  -m claude-sonnet-4-6 --job-name claude-034

# Full suite, 4 attempts each (mirrors experiments' runs: 4)
harbor run -y -p harbor/tasks -a claude-code -m claude-sonnet-4-6 -k 4 \
  --job-name claude-suite
```

`reward.json` per trial: `reward` (1 iff vitest EVAL.ts and `npm run build`
both pass, mirroring agent-eval's `allPassed`), plus `vitestPassed` /
`buildPassed` for diagnosis.

## Proven runs (2026-07-17, local Docker, harbor 0.19.0)

| job           | agent                          | reward | vitestPassed | buildPassed | cost  |
|---------------|--------------------------------|--------|--------------|-------------|-------|
| nop-021       | nop (red-path proof)           | 0      | 0            | 1           | $0    |
| claude-021    | claude-code, claude-sonnet-4-6 | 1      | 1            | 1           | $0.23 |
| claude-034-v2 | claude-code, claude-sonnet-4-6 | 1      | 1            | 1           | $0.08 |

claude-034 is one of the three LLM-judge evals: its judge invocation ran
inside the verifier (19.7s on the judged test vs 236ms when the judge could
not launch). The nop row shows the grader discriminates: the untouched
scaffold builds but fails 2 of 5 EVAL.ts assertions.

Gotcha found by these runs: harbor containers run the verifier as root, and
Claude Code refuses `--dangerously-skip-permissions` as root. test.sh sets
`IS_SANDBOX=1` (the same flag harbor's agent phase sets); agent-eval never
hit this because its Vercel sandbox validation runs unprivileged.

## Not ported (yet)

- The `--agents-md` experiment arm (injects `AGENTS.md` into the fixture) —
  a task variant or a second generated task set.
- `earlyExit: true` semantics — harbor's `--n-attempts` always runs all
  attempts.
- `agent-eval status` / refingerprint bookkeeping and `export-results.ts`
  publishing — results stay in harbor's `jobs/` shape.
