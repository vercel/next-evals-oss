#!/bin/bash

set -e

echo "Bootstrapping solution folders for evals..."
echo ""

created=0
skipped=0

# First, ensure shared dependencies are installed in evals/
echo "📦 Checking shared dependencies in evals/..."
if [ ! -d "evals/node_modules" ] || [ ! -d "evals/node_modules/next" ]; then
  echo "Installing shared dependencies..."
  cd evals
  pnpm install --prefer-offline
  cd ..
  echo "✓ Shared dependencies installed"
else
  echo "✓ Shared dependencies already installed"
fi
echo ""

# Now bootstrap solution folders for evals that don't have them
for eval_dir in evals/*/; do
  eval_name=$(basename "$eval_dir")

  # Skip the evals directory itself and any non-eval folders
  if [ "$eval_name" = "node_modules" ] || [ "$eval_name" = ".next" ]; then
    continue
  fi

  solution_dir="${eval_dir}solution"
  input_dir="${eval_dir}input"

  # Check if solution already exists
  if [ -d "$solution_dir" ]; then
    echo "⊘ Skipping $eval_name (solution already exists)"
    ((skipped++))
    continue
  fi

  # Check if input exists
  if [ ! -d "$input_dir" ]; then
    echo "⚠ Skipping $eval_name (no input directory)"
    ((skipped++))
    continue
  fi

  echo "Creating solution for $eval_name..."

  # Create solution directory
  mkdir -p "$solution_dir"

  # Copy all files from input to solution, excluding node_modules
  rsync -a --exclude='node_modules' --exclude='.next' "$input_dir/" "$solution_dir/"

  echo "  ✓ Created $eval_name/solution"
  ((created++))
  echo ""
done

echo ""
echo "========================================="
echo "Bootstrap results:"
echo "  Created: $created"
echo "  Skipped: $skipped"
echo "========================================="
echo "✅ Solution folders bootstrapped!"
echo ""
echo "Note: All evals share node_modules from evals/ directory"
