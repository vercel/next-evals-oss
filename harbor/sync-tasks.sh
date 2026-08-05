#!/bin/bash
# Materialize harbor/tasks/ from the synced evals/ directory (which itself
# comes from vercel/next.js via `pnpm sync-evals`). Both evals/ and
# harbor/tasks/ are generated and gitignored; templates + this script are the
# committed artifact.
#
#   pnpm sync-evals && ./harbor/sync-tasks.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d evals ]; then
  echo "evals/ not found — run \`pnpm sync-evals\` first" >&2
  exit 1
fi

# The judge helper and the claude-code runner ship into every task's tests/
# so eval-helper.mjs's hard-coded __agent_eval__/ paths resolve in-container.
pkg=$(ls -d node_modules/.pnpm/@vercel+agent-eval@*/node_modules/@vercel/agent-eval | head -1)
helper="$pkg/dist/lib/agents/eval-helper.mjs"
runner="$pkg/dist/lib/agents/claude-code/run.mjs"
[ -f "$helper" ] || { echo "eval-helper.mjs not found — run \`pnpm install\` first" >&2; exit 1; }

rm -rf harbor/tasks
count=0
for src in evals/agent-*/; do
  eval_name=$(basename "$src")
  dst="harbor/tasks/$eval_name"

  mkdir -p "$dst/environment/workspace" "$dst/tests"

  cp harbor/templates/task.toml "$dst/task.toml"
  cp "$src/PROMPT.md" "$dst/instruction.md"
  cp harbor/templates/Dockerfile "$dst/environment/Dockerfile"
  cp harbor/templates/test.sh "$dst/tests/test.sh"
  cp harbor/templates/report-reward.mjs "$dst/tests/report-reward.mjs"
  cp "$src/EVAL.ts" "$dst/tests/EVAL.ts"
  cp "$helper" "$dst/tests/eval-helper.mjs"
  cp "$runner" "$dst/tests/run.mjs"

  # Fixture = the eval minus the files agent-eval withholds (TEST_FILE_PATTERNS)
  # and local artifacts.
  (cd "$src" && tar cf - --exclude PROMPT.md --exclude EVAL.ts \
    --exclude node_modules --exclude .next --exclude next-env.d.ts \
    --exclude package-lock.json .) |
    tar xf - -C "$dst/environment/workspace"

  chmod +x "$dst/tests/test.sh"
  count=$((count + 1))
done

echo "synced $count tasks into harbor/tasks/"
