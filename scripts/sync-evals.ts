/**
 * Sync eval fixtures from the vercel/next.js repo (canary branch).
 *
 * Uses git sparse checkout to only download the evals/evals/ subtree. After syncing,
 * runs `agent-eval refingerprint` to carry CONFIG-only changes forward in existing
 * results — a real eval-content change is left stale (so `agent-eval status` reports
 * it), instead of being silently re-stamped as it was before.
 *
 * Usage:
 *   pnpm sync-evals              # sync from canary (default)
 *   pnpm sync-evals <ref>        # sync from a specific ref/branch/tag
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const REPO_URL = 'https://github.com/vercel/next.js.git';
// next.js#98387: import the measured fixture directly from upstream instead of
// rewriting EVAL.ts locally. Remove this override when the suite pin includes it.
const AGENT_030_REF = '4d621240c38ebceeac693951d7c6b04636632adc';
const AGENT_030_PATH = 'evals/evals/agent-030-app-router-migration-hard';
const AGENT_030_FIXED_TREE = '62164b209023c9be6207ab8812203d2172aaf149';
const AGENT_030_OLD_TREES = new Set([
  '97f6ea1e87d20a00dd60bd2f2e14ecde4eef67fb', // CI pin, before LayoutProps fix
  'd03d06d58cce334e64b9ca8019e9ca54e96d6337', // Aurora's LayoutProps fix
]);

async function main(): Promise<void> {
  const ref = process.argv[2] || 'canary';
  const evalsDir = join(process.cwd(), 'evals');
  const tmpDir = join(process.cwd(), '.sync-tmp');

  // A ref is never a flag. Catching this here keeps a stray `pnpm sync-evals
  // --foo` from reaching git as a ref (and, before the fetch-first order below,
  // from deleting evals/ on the way to failing).
  if (ref.startsWith('-')) {
    throw new Error(`"${ref}" is not a ref. Usage: pnpm sync-evals [branch|tag|sha]`);
  }

  console.log(`Syncing evals from vercel/next.js@${ref}...\n`);

  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });

  // Fetch BEFORE touching evals/. A bad ref (typo, deleted branch, network
  // blip) used to fail after the delete, leaving no fixtures at all — every
  // later command then died in the framework's loader with an error that says
  // nothing about the sync that caused it.
  //
  // Sparse fetch. Use fetch + checkout (not clone --branch) so `ref` may be a
  // branch/tag OR a pinned commit SHA — clone --branch rejects raw SHAs.
  const repoDir = `${tmpDir}/next.js`;
  execSync(`git init -q "${repoDir}"`, { stdio: 'inherit' });
  execSync(`git -C "${repoDir}" remote add origin ${REPO_URL}`, { stdio: 'inherit' });
  execSync(`git -C "${repoDir}" sparse-checkout init --cone`, { stdio: 'inherit' });
  execSync(`git -C "${repoDir}" sparse-checkout set evals/evals`, { stdio: 'inherit' });
  execSync(
    `git -C "${repoDir}" fetch --depth 1 --filter=blob:none origin ${ref}`,
    { stdio: 'inherit' }
  );
  execSync(`git -C "${repoDir}" checkout -q FETCH_HEAD`, { stdio: 'inherit' });

  // Import the whole upstream fixture, preserving the other 25 pinned evals.
  // Refuse unfamiliar trees rather than masking a newer upstream correction.
  const fixtureTree = execSync(
    `git -C "${repoDir}" rev-parse HEAD:${AGENT_030_PATH}`,
    { encoding: 'utf8' }
  ).trim();
  if (fixtureTree !== AGENT_030_FIXED_TREE) {
    if (!AGENT_030_OLD_TREES.has(fixtureTree)) {
      throw new Error('agent-030 changed upstream; review/remove its pinned fixture override before syncing');
    }
    execSync(
      `git -C "${repoDir}" fetch --depth 1 --filter=blob:none origin ${AGENT_030_REF}`,
      { stdio: 'inherit' }
    );
    execSync(
      `git -C "${repoDir}" checkout ${AGENT_030_REF} -- ${AGENT_030_PATH}`,
      { stdio: 'inherit' }
    );
  }

  // Swap the fetched tree into place: only now is the old one expendable.
  if (existsSync(evalsDir)) rmSync(evalsDir, { recursive: true });
  execSync(`cp -r "${tmpDir}/next.js/evals/evals" "${evalsDir}"`);
  rmSync(tmpDir, { recursive: true, force: true });

  // Carry config-only changes forward in cached results (the framework owns this now;
  // it never masks a real eval-content change). Then `agent-eval status` shows the work.
  execSync('pnpm exec agent-eval refingerprint', { stdio: 'inherit' });

  console.log('\nDone. Run `agent-eval status` to see what changed.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
