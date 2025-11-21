#!/bin/bash

set -e

echo "Testing codex outputs..."
echo ""

failed=0
tested=0
skipped=0

for eval_dir in evals/*/; do
  eval_name=$(basename "$eval_dir")
  codex_dir="${eval_dir}solution"

  if [ -d "$codex_dir" ]; then
    echo "Testing $eval_name..."

    cd "$codex_dir"

    if ! npm run build; then
      echo "❌ Build failed for $eval_name"
      exit 1
    fi

    cd - > /dev/null

    echo "✅ $eval_name passed"
    echo ""
    ((tested++))
  else
    echo "⊘ Skipping $eval_name (no solution directory)"
    ((skipped++))
  fi
done

echo ""
echo "========================================="
echo "Codex test results:"
echo "  Tested: $tested"
echo "  Skipped: $skipped"
echo "========================================="
echo "✅ All codex outputs built successfully!"
