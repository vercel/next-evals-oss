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
3. Run `npm run eval` — it will automatically run all evals for the new model

### Unreleased models (OpenCode)

If the model isn't yet available in OpenCode (i.e., not listed on [models.dev](https://models.dev)), you need a patched OpenCode binary with the model baked in. OpenCode resolves models from models.dev at **build time** via a macro, so runtime config alone won't work.

**1. Create a patched models.dev JSON**

Fetch the current models.dev API and add your model to **both** the provider's entry and the `vercel` provider entry (since we route through Vercel AI Gateway):

```bash
curl -s https://models.dev/api.json > /tmp/models-dev-patched.json
```

Then edit the JSON to add your model. For example, to add `moonshotai/kimi-k2.6-preview`:
- Add a `kimi-k2.6-preview` entry under `moonshotai.models` (copy from `kimi-k2.5`)
- Add a `moonshotai/kimi-k2.6-preview` entry under `vercel.models` (copy from `moonshotai/kimi-k2.5`)

Both entries are required — the `moonshotai` entry defines the model, and the `vercel` entry makes it available through AI Gateway routing.

**2. Check temperature/transform requirements**

Some models require specific temperature settings. Check `packages/opencode/src/provider/transform.ts` in the opencode repo — if your model needs `temperature: 1` (common for reasoning models), add it to the temperature function:

```typescript
// packages/opencode/src/provider/transform.ts
if (id.includes("kimi-k2")) {
  if (id.includes("thinking") || id.includes("k2.6")) return 1.0
  return 0.6
}
```

If unsure, test first — a temperature error like `"invalid temperature: only 1 is allowed"` will tell you.

**3. Build the binary**

The build script enforces a specific Bun version (check `packageManager` in root `package.json`):

```bash
cd opencode/packages/opencode
MODELS_DEV_API_JSON=/tmp/models-dev-patched.json bun run script/build.ts
```

This builds all platforms. The Vercel sandbox needs `dist/opencode-linux-x64/bin/opencode`.

**4. Upload to Vercel Blob Storage**

```bash
BLOB_READ_WRITE_TOKEN="..." vercel blob put dist/opencode-linux-x64/bin/opencode \
  --pathname opencode-linux-x64-<model-name> --access public
```

The token is in the `next-evals` Vercel project env vars. Pull with `vercel env pull`.

**5. Create experiment config**

```typescript
import type { ExperimentConfig } from '@vercel/agent-eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/opencode',
  model: 'vercel/moonshotai/kimi-k2.6-preview',
  agentOptions: {
    binaryUrl: 'https://ymdea60kblwwhidh.public.blob.vercel-storage.com/opencode-linux-x64-<model-name>',
  },
  scripts: ['build'],
  runs: 4,
  earlyExit: true,
  timeout: 720,
  sandbox: 'vercel',
  setup: async (sandbox) => {
    await sandbox.runCommand('npm', ['install', 'next@canary']);
  },
};

export default config;
```

**6. Smoke test, then full run**

```bash
npm run eval <config-name> -- --smoke   # verify 1 eval works
npm run eval <config-name>              # full run
```

**Troubleshooting**

- **403 error at 0.2s**: `VERCEL_TOKEN` has expired SAML session. Re-authenticate with `vercel login --scope ai-gateway-early-access-models`, then create a new token at https://vercel.com/account/tokens with the correct team scope.
- **"terminated" with no output**: OOM in sandbox. The `agent-eval` harness automatically requests 2 vCPUs (4GB RAM) when `binaryUrl` is set. If still OOM, the model's output may be too large.
- **"invalid temperature"**: Add a temperature override in `transform.ts` and rebuild the binary.
- **Zod validation error / "expected object, received undefined"**: Model is missing from the `vercel` provider in the patched models.dev JSON. Make sure it's added under both the model's native provider AND the `vercel` provider.
- **"ProviderModelNotFoundError"**: The model isn't in the binary's baked-in models list. Verify your patched JSON includes the model and that `MODELS_DEV_API_JSON` was set during the build.

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
