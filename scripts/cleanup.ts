/**
 * Cleanup results: removes duplicates, incomplete results, and results
 * with empty transcripts.
 * - For each (experiment, eval) pair, keeps only the latest complete result.
 * - A result is "complete" if it has summary.json AND at least one run
 *   with a non-empty transcript (transcript.jsonl or transcriptRaw.jsonl).
 * - Removes empty timestamp directories.
 *
 * Usage:
 *   npx tsx scripts/cleanup.ts         # Cleanup all experiments
 *   npx tsx scripts/cleanup.ts --dry   # Show what would be deleted
 */

import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

function parseTimestamp(ts: string): Date {
  const match = ts.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.(\d+)Z$/
  );
  if (match) {
    return new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}.${match[5]}Z`);
  }
  return new Date(ts);
}

async function fileNonEmpty(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.size > 0;
  } catch {
    return false;
  }
}

async function hasTranscript(evalPath: string): Promise<boolean> {
  let runDirs: string[];
  try {
    runDirs = (await readdir(evalPath)).filter((d) => d.startsWith('run-'));
  } catch {
    return false;
  }
  for (const run of runDirs) {
    const runPath = join(evalPath, run);
    if (
      await fileNonEmpty(join(runPath, 'transcript.jsonl')) ||
      await fileNonEmpty(join(runPath, 'transcriptRaw.jsonl'))
    ) {
      return true;
    }
  }
  return false;
}

async function isComplete(evalPath: string): Promise<boolean> {
  return existsSync(join(evalPath, 'summary.json')) && await hasTranscript(evalPath);
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const resultsDir = 'results';

  if (!existsSync(resultsDir)) {
    console.log('No results directory found.');
    return;
  }

  let totalDeleted = 0;
  let totalKept = 0;
  let emptyTimestampsRemoved = 0;

  const experiments = (await readdir(resultsDir)).filter((d) => !d.startsWith('.'));

  for (const experiment of experiments.sort()) {
    const expDir = join(resultsDir, experiment);
    const timestamps = (await readdir(expDir).catch(() => []))
      .filter((t) => !t.startsWith('.'))
      .sort((a, b) => parseTimestamp(b).getTime() - parseTimestamp(a).getTime()); // newest first

    const seen = new Set<string>();
    let expDeleted = 0;

    for (const ts of timestamps) {
      const tsDir = join(expDir, ts);
      let evalDirs: string[];
      try {
        evalDirs = (await readdir(tsDir)).filter((d) => !d.startsWith('.'));
      } catch {
        continue;
      }

      for (const evalDir of evalDirs) {
        const evalPath = join(tsDir, evalDir);
        const complete = await isComplete(evalPath);

        if (seen.has(evalDir)) {
          // Older duplicate — delete
          if (dry) {
            console.log(`  DELETE ${experiment}/${ts}/${evalDir} (duplicate)`);
          } else {
            await rm(evalPath, { recursive: true });
          }
          totalDeleted++;
          expDeleted++;
        } else if (complete) {
          seen.add(evalDir);
          totalKept++;
        } else {
          // Incomplete (no summary.json or no transcript) — delete
          const reason = !existsSync(join(evalPath, 'summary.json'))
            ? 'no summary'
            : 'no transcript';
          if (dry) {
            console.log(`  DELETE ${experiment}/${ts}/${evalDir} (${reason})`);
          } else {
            await rm(evalPath, { recursive: true });
          }
          totalDeleted++;
          expDeleted++;
        }
      }
    }

    // Clean up empty timestamp directories
    for (const ts of timestamps) {
      const tsDir = join(expDir, ts);
      try {
        const remaining = (await readdir(tsDir)).filter((d) => !d.startsWith('.'));
        if (remaining.length === 0) {
          if (dry) {
            console.log(`  RMDIR  ${experiment}/${ts} (empty)`);
          } else {
            await rm(tsDir, { recursive: true });
          }
          emptyTimestampsRemoved++;
        }
      } catch {
        // Already removed
      }
    }

    if (expDeleted > 0) {
      console.log(`${experiment}: removed ${expDeleted}`);
    }
  }

  console.log(`\nDone! Kept: ${totalKept} | Deleted: ${totalDeleted} | Empty dirs removed: ${emptyTimestampsRemoved}`);
}

main().catch(console.error);
