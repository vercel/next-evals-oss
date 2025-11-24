#!/bin/bash

set -e

echo "Testing solutions..."
echo ""

failed=0
tested=0
skipped=0

for eval_dir in evals/*/; do
  eval_name=$(basename "$eval_dir")
  solution_dir="${eval_dir}solution"

  if [ -d "$solution_dir" ]; then
    echo "Testing $eval_name..."

    cd "$solution_dir"

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
echo "Solution test results:"
echo "  Tested: $tested"
echo "  Skipped: $skipped"
echo "========================================="
echo "✅ All solutions built successfully!"
