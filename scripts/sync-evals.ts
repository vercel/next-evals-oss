/**
 * Sync eval fixtures from the vercel/next.js repo (canary branch).
 *
 * Uses git sparse checkout to only download the evals/evals/ subtree.
 *
 * Usage:
 *   pnpm sync-evals              # sync from canary (default)
 *   pnpm sync-evals <ref>        # sync from a specific ref/branch/tag
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const REPO_URL = 'https://github.com/vercel/next.js.git';

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

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
