/**
 * Sync eval fixtures from the reviewed vercel/next.js revision.
 *
 * Uses git sparse checkout to only download the evals/evals/ subtree. After syncing,
 * runs `agent-eval refingerprint` to carry CONFIG-only changes forward in existing
 * results — a real eval-content change is left stale (so `agent-eval status` reports
 * it), instead of being silently re-stamped as it was before.
 *
 * Usage:
 *   pnpm sync-evals              # sync the reviewed suite pin
 *   pnpm sync-evals <ref>        # sync from a specific ref/branch/tag
 *   pnpm sync-evals <ref> --suite regression # select an upstream suite
 */

import { execFileSync, execSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const REPO_URL = 'https://github.com/vercel/next.js.git';

export function copyEvalFixtures(
  repoDir: string,
  evalsDir: string,
  suite?: string,
): string[] {
  const source = join(repoDir, 'evals/evals');
  const available = readdirSync(source, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const configPath = join(repoDir, 'evals/eval.config.json');
  const config = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, 'utf8')) as Record<
        string,
        { skills?: string[]; publish?: boolean }
      >)
    : {};
  const publicEvals = available.filter(
    (name) => config[name]?.publish !== false && !config[name]?.skills?.length,
  );
  let selected = publicEvals;
  if (suite !== undefined) {
    const manifest = JSON.parse(
      readFileSync(join(repoDir, 'evals/eval.suites.json'), 'utf8'),
    );
    const names: unknown = Object.hasOwn(manifest, suite)
      ? manifest[suite]
      : undefined;
    if (
      !Array.isArray(names) ||
      names.length === 0 ||
      new Set(names).size !== names.length
    ) {
      throw new Error(
        `Suite ${suite} must contain a non-empty, unique list of evals`,
      );
    }
    for (const name of names) {
      if (typeof name !== 'string' || !publicEvals.includes(name)) {
        throw new Error(
          `Suite ${suite} contains an unknown or non-public eval: ${String(name)}`,
        );
      }
    }
    selected = names;
  }

  // Validate the selection before replacing any existing fixtures.
  rmSync(evalsDir, { recursive: true, force: true });
  cpSync(source, evalsDir, { recursive: true });
  for (const name of available) {
    if (!selected.includes(name))
      rmSync(join(evalsDir, name), { recursive: true });
  }
  return selected;
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { suite: { type: 'string' } },
  });
  if (positionals.length > 1)
    throw new Error('Usage: pnpm sync-evals [ref] [--suite name]');
  const ref =
    positionals[0] || readFileSync('eval-suite-ref.txt', 'utf8').trim();
  const evalsDir = join(process.cwd(), 'evals');
  const tmpDir = join(process.cwd(), '.sync-tmp');

  // A ref is never a flag. Catching this here keeps a stray `pnpm sync-evals
  // --foo` from reaching git as a ref (and, before the fetch-first order below,
  // from deleting evals/ on the way to failing).
  if (ref.startsWith('-')) {
    throw new Error(
      `"${ref}" is not a ref. Usage: pnpm sync-evals [branch|tag|sha]`,
    );
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
  execSync(`git -C "${repoDir}" remote add origin ${REPO_URL}`, {
    stdio: 'inherit',
  });
  execSync(`git -C "${repoDir}" sparse-checkout init --cone`, {
    stdio: 'inherit',
  });
  execSync(`git -C "${repoDir}" sparse-checkout set evals`, {
    stdio: 'inherit',
  });
  execSync(
    `git -C "${repoDir}" fetch --depth 1 --filter=blob:none origin ${ref}`,
    { stdio: 'inherit' },
  );
  execSync(`git -C "${repoDir}" checkout -q FETCH_HEAD`, { stdio: 'inherit' });

  // Import only the reviewed graders, keeping this cohort's prompts and apps.
  // Explicitly syncing another revision must not apply this pin's overrides.
  const overrides = JSON.parse(
    readFileSync('eval-grader-overrides.json', 'utf8'),
  );
  if (ref === overrides.suiteRef) {
    for (const [evalName, graderRef] of Object.entries(overrides.graders)) {
      if (
        !/^agent-[a-z0-9-]+$/.test(evalName) ||
        typeof graderRef !== 'string' ||
        !/^[a-f0-9]{40}$/.test(graderRef)
      ) {
        throw new Error('Invalid pinned grader override');
      }
      const relativePath = `evals/evals/${evalName}/EVAL.ts`;
      const target = join(repoDir, relativePath);
      if (!existsSync(target))
        throw new Error(`Unknown eval override: ${evalName}`);
      execFileSync(
        'git',
        [
          '-C',
          repoDir,
          'fetch',
          '--depth',
          '1',
          '--filter=blob:none',
          'origin',
          graderRef,
        ],
        { stdio: 'inherit' },
      );
      writeFileSync(
        target,
        execFileSync('git', [
          '-C',
          repoDir,
          'show',
          `${graderRef}:${relativePath}`,
        ]),
      );
    }
  }

  const selected = copyEvalFixtures(repoDir, evalsDir, values.suite);
  console.log(`Synced ${selected.length} ${values.suite ?? 'public'} evals.`);

  rmSync(tmpDir, { recursive: true, force: true });

  // Carry config-only changes forward in cached results (the framework owns this now;
  // it never masks a real eval-content change). Then `agent-eval status` shows the work.
  // A subset measurement must not update the public board's cached results.
  if (values.suite === undefined) {
    execSync('pnpm exec agent-eval refingerprint', { stdio: 'inherit' });
  }

  console.log('\nDone. Run `agent-eval status` to see what changed.');
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  });
}
