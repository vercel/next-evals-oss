#!/bin/bash
# Verifier — replicates @vercel/agent-eval's validation phase 1:1:
#   1. materialize __agent_eval__/ (judge helper + agent runner, the paths
#      eval-helper.mjs hard-codes),
#   2. copy the withheld EVAL.ts into the workspace,
#   3. write the same vitest.config.ts the harness generates (helper as
#      setupFiles so `toSatisfyCriterion` is registered, aliased as
#      @vercel/agent-eval/eval),
#   4. `npx vitest run` then `npm run build` (experiments use scripts:
#      ['build']) — reward 1 iff both exit 0.
set -uo pipefail

# The LLM-judge matcher re-invokes the claude CLI installed for the agent run.
export PATH="$HOME/.local/bin:$PATH"
# Harbor containers run the verifier as root; Claude Code refuses
# --dangerously-skip-permissions as root unless IS_SANDBOX=1 (harbor's agent
# phase sets the same flag).
export IS_SANDBOX=1

# task.toml [verifier.env] forwards ANTHROPIC_* with empty-string defaults so
# non-judge runs work without credentials; drop the empties so the claude CLI
# never sees a set-but-empty variable.
for v in ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_API_KEY ANTHROPIC_MODEL; do
  [ -z "${!v:-}" ] && unset "$v"
done

cd /app

mkdir -p /app/__agent_eval__
cp /tests/eval-helper.mjs /app/__agent_eval__/eval-helper.mjs
cp /tests/run.mjs /app/__agent_eval__/run.mjs
cp /tests/EVAL.ts /app/EVAL.ts

cat > /app/vitest.config.ts <<'EOF'
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['EVAL.ts'],
    globals: false,
    testTimeout: 900000,
    hookTimeout: 900000,
    setupFiles: ['/app/__agent_eval__/eval-helper.mjs'],
  },
  resolve: {
    alias: { '@vercel/agent-eval/eval': '/app/__agent_eval__/eval-helper.mjs' },
  },
});
EOF

npx vitest run 2>&1 | tee /logs/verifier/vitest-output.txt
vitest_exit=${PIPESTATUS[0]}

npm run build 2>&1 | tee /logs/verifier/build-output.txt
build_exit=${PIPESTATUS[0]}

node /tests/report-reward.mjs "$vitest_exit" "$build_exit" > /logs/verifier/reward.json
echo "reward.json:"
cat /logs/verifier/reward.json
