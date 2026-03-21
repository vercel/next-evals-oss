/**
 * Sync eval fixtures from the vercel/next.js repo (canary branch).
 *
 * Uses git sparse checkout to only download the evals/evals/ subtree.
 * After syncing, recomputes fingerprints in existing results so that
 * formatting-only changes don't invalidate cached runs.
 *
 * Usage:
 *   pnpm sync-evals              # sync from canary (default)
 *   pnpm sync-evals <ref>        # sync from a specific ref/branch/tag
 */

import { execSync } from 'node:child_process';
import {
  existsSync, rmSync, readdirSync, readFileSync, writeFileSync, statSync,
} from 'node:fs';
import { join } from 'node:path';
import { computeFingerprint } from '@vercel/agent-eval';

const REPO_URL = 'https://github.com/vercel/next.js.git';

// ── Parse experiment config to build a RunnableExperimentConfig-like object ──

function parseExperimentConfig(filePath: string): Record<string, unknown> | null {
  const src = readFileSync(filePath, 'utf-8');
  const agent = src.match(/agent:\s*['"]([^'"]+)['"]/)?.[1];
  const model = src.match(/model:\s*['"]([^'"]+)['"]/)?.[1];
  const scripts = src.match(/scripts:\s*\[([^\]]*)\]/)?.[1];
  const runs = src.match(/runs:\s*(\d+)/)?.[1];
  const earlyExit = src.match(/earlyExit:\s*(true|false)/)?.[1];
  const timeout = src.match(/timeout:\s*(\d+)/)?.[1];
  if (!agent || !model || !scripts || !runs || !earlyExit || !timeout) return null;
  return {
    agent,
    model,
    scripts: scripts.split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean),
    timeout: Number(timeout),
    earlyExit: earlyExit === 'true',
    runs: Number(runs),
  };
}

// ── Update fingerprints in existing results ─────────────────────────────────

function updateFingerprints(): void {
  const resultsDir = join(process.cwd(), 'results');
  const evalsDir = join(process.cwd(), 'evals');
  const experimentsDir = join(process.cwd(), 'experiments');
  if (!existsSync(resultsDir) || !existsSync(experimentsDir)) return;

  let updated = 0;

  for (const experiment of readdirSync(experimentsDir).filter(f => f.endsWith('.ts'))) {
    const experimentName = experiment.replace(/\.ts$/, '');
    const config = parseExperimentConfig(join(experimentsDir, experiment));
    if (!config) continue;

    const expResultsDir = join(resultsDir, experimentName);
    if (!existsSync(expResultsDir)) continue;

    for (const timestamp of readdirSync(expResultsDir)) {
      const tsDir = join(expResultsDir, timestamp);
      if (!statSync(tsDir).isDirectory()) continue;

      for (const evalName of readdirSync(tsDir)) {
        const summaryPath = join(tsDir, evalName, 'summary.json');
        const evalPath = join(evalsDir, evalName);
        if (!existsSync(summaryPath) || !existsSync(evalPath)) continue;

        const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
        const newFingerprint = computeFingerprint(evalPath, config as any);

        if (summary.fingerprint !== newFingerprint) {
          summary.fingerprint = newFingerprint;
          writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
          updated++;
        }
      }
    }
  }

  if (updated > 0) {
    console.log(`Updated ${updated} fingerprints in results.`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const ref = process.argv[2] || 'canary';
  const evalsDir = join(process.cwd(), 'evals');
  const tmpDir = join(process.cwd(), '.sync-tmp');

  console.log(`Syncing evals from vercel/next.js@${ref}...\n`);

  // Clean slate
  if (existsSync(evalsDir)) rmSync(evalsDir, { recursive: true });
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });

  // Sparse clone
  execSync(
    `git clone --depth 1 --filter=blob:none --sparse --branch ${ref} ${REPO_URL} "${tmpDir}/next.js"`,
    { stdio: 'inherit' }
  );
  execSync(
    `git -C "${tmpDir}/next.js" sparse-checkout set evals/evals`,
    { stdio: 'inherit' }
  );

  // Copy evals into place
  execSync(`cp -r "${tmpDir}/next.js/evals/evals" "${evalsDir}"`);
  rmSync(tmpDir, { recursive: true, force: true });

  // Update fingerprints in existing results
  updateFingerprints();

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
