# Next.js Evals

Agent evaluations for Next.js coding tasks, powered by [`@vercel/agent-eval`](https://www.npmjs.com/package/@vercel/agent-eval).

## Setup

```bash
npm install
cp .env.local .env   # requires VERCEL_OIDC_TOKEN and AI_GATEWAY_API_KEY
```

## Usage

```bash
# Dry run — validate all 20 fixtures load correctly
npx agent-eval cc --dry

# Run all evals
npx agent-eval cc

# Smoke test — run a single eval (agent-031-proxy-middleware)
npx agent-eval cc-smoke
```

Experiment configs live in `experiments/`:

- **`cc.ts`** — runs all evals with Claude Code via Vercel AI Gateway
- **`cc-smoke.ts`** — runs only `agent-031-proxy-middleware` for quick validation

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

The framework automatically:
- Withholds `EVAL.ts` and `*.test.ts`/`*.test.tsx` from the agent
- Creates a vitest config in the sandbox
- Runs `EVAL.ts` via `npx vitest run EVAL.ts` to score the result

## Adding a new eval

1. Create a directory under `evals/` (e.g., `evals/agent-040-my-eval/`)
2. Add `PROMPT.md` with the task description
3. Add `EVAL.ts` with vitest assertions
4. Add `package.json` with `"type": "module"` and `"build": "next build"`
5. Add the Next.js source files the agent starts with
6. Verify: `npx agent-eval cc --dry`

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
