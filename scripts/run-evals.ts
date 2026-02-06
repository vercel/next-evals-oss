/**
 * Eval runner with memoization.
 * Only runs (model, eval) pairs that haven't been completed yet.
 *
 * Usage:
 *   npx tsx scripts/run-evals.ts           # Run only missing pairs
 *   npx tsx scripts/run-evals.ts --force   # Re-run everything
 *   npx tsx scripts/run-evals.ts --retry   # Retry failed evals only
 *   npx tsx scripts/run-evals.ts --dry     # Show what would run
 *   npx tsx scripts/run-evals.ts --smoke   # Run 1 eval per experiment (sanity check)
 */

import { readdir, readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

function execAsync(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
}

interface CompletedEval {
  experiment: string;
  eval: string;
  success: boolean;
  timestamp: string;
}

async function discoverExperiments(): Promise<string[]> {
  const files = await readdir('experiments');
  return files
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_temp_'))
    .map((f) => f.replace('.ts', ''));
}

async function discoverEvals(): Promise<string[]> {
  const dirs = await readdir('evals');
  return dirs.filter((d) => d.startsWith('agent-'));
}

async function scanCompletedEvals(): Promise<CompletedEval[]> {
  const resultsDir = 'results';

  if (!existsSync(resultsDir)) return [];

  // Track latest result per (experiment, eval) pair across all timestamps
  const seen = new Map<string, CompletedEval>();

  for (const experiment of await readdir(resultsDir)) {
    const expDir = join(resultsDir, experiment);
    const timestamps = (await readdir(expDir).catch(() => []))
      .filter((t) => !t.startsWith('.'))
      .sort();

    // Iterate oldest to newest so latest overwrites earlier results
    for (const ts of timestamps) {
      const runDir = join(expDir, ts);
      for (const evalDir of await readdir(runDir).catch(() => [])) {
        if (evalDir.startsWith('.')) continue;

        const summaryPath = join(runDir, evalDir, 'summary.json');
        if (existsSync(summaryPath)) {
          try {
            const summary = JSON.parse(await readFile(summaryPath, 'utf-8'));
            seen.set(`${experiment}:${evalDir}`, {
              experiment,
              eval: evalDir,
              success: summary.passedRuns > 0,
              timestamp: ts,
            });
          } catch {
            // Skip malformed summaries
          }
        }
      }
    }
  }

  return Array.from(seen.values());
}

function getMissingPairs(
  experiments: string[],
  evals: string[],
  completed: CompletedEval[],
  retryFailed: boolean
): Map<string, string[]> {
  const completedSet = new Set(
    completed
      .filter((c) => (retryFailed ? c.success : true))
      .map((c) => `${c.experiment}:${c.eval}`)
  );

  const missing = new Map<string, string[]>();

  for (const exp of experiments) {
    const missingEvals = evals.filter((ev) => !completedSet.has(`${exp}:${ev}`));
    if (missingEvals.length > 0) {
      missing.set(exp, missingEvals);
    }
  }

  return missing;
}

async function runExperimentWithEvals(
  experiment: string,
  evals: string[],
  dry: boolean
): Promise<void> {
  // Create a temporary config that only runs specific evals
  const originalConfig = await readFile(
    join('experiments', `${experiment}.ts`),
    'utf-8'
  );

  // Inject evals filter into config
  const evalsArray = JSON.stringify(evals);
  const modifiedConfig = originalConfig.replace(
    /const config: ExperimentConfig = \{/,
    `const config: ExperimentConfig = {\n  evals: ${evalsArray},`
  );

  const tempConfigPath = join('experiments', `_temp_${experiment}.ts`);

  if (dry) {
    console.log(`  Would run ${evals.length} evals: ${evals.slice(0, 3).join(', ')}${evals.length > 3 ? '...' : ''}`);
    return;
  }

  try {
    await writeFile(tempConfigPath, modifiedConfig);
    await execAsync('npx', ['agent-eval', `_temp_${experiment}`]);

    const tempResultsDir = join('results', `_temp_${experiment}`);
    const realResultsDir = join('results', experiment);

    if (existsSync(tempResultsDir)) {
      const timestamps = await readdir(tempResultsDir);
      for (const ts of timestamps) {
        const srcDir = join(tempResultsDir, ts);
        const destDir = join(realResultsDir, ts);
        await mkdir(destDir, { recursive: true });
        await cp(srcDir, destDir, { recursive: true });
      }
      await rm(tempResultsDir, { recursive: true });
    }
  } finally {
    if (existsSync(tempConfigPath)) {
      await rm(tempConfigPath);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const retry = args.includes('--retry');
  const dry = args.includes('--dry');
  const smoke = args.includes('--smoke');

  console.log('Discovering experiments and evals...\n');

  const experiments = await discoverExperiments();
  const evals = await discoverEvals();

  console.log(`Found ${experiments.length} experiments: ${experiments.join(', ')}`);
  console.log(`Found ${evals.length} evals\n`);

  if (force) {
    console.log('Force mode: running all experiments (parallel)\n');
    if (dry) {
      for (const exp of experiments) {
        console.log(`${exp}: all ${evals.length} evals`);
      }
    } else {
      const results = await Promise.allSettled(
        experiments.map(async (exp) => {
          console.log(`Starting ${exp}...`);
          await runExperimentWithEvals(exp, evals, false);
          return exp;
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          console.log(`${result.value} - completed`);
        } else {
          console.error(`Failed:`, result.reason);
        }
      }
    }
    return;
  }

  if (smoke) {
    console.log('Smoke test: running 1 eval per experiment (parallel)\n');
    const smokeEval = 'agent-027-prefer-next-image';
    if (dry) {
      for (const exp of experiments) {
        console.log(`${exp}: ${smokeEval}`);
      }
    } else {
      const results = await Promise.allSettled(
        experiments.map(async (exp) => {
          console.log(`Starting ${exp}...`);
          await runExperimentWithEvals(exp, [smokeEval], false);
          return exp;
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') {
          console.log(`${result.value} - completed`);
        } else {
          console.error(`Failed:`, result.reason);
        }
      }
    }
    console.log('\nSmoke test done!');
    return;
  }

  const completed = await scanCompletedEvals();
  console.log(`Found ${completed.length} completed (experiment, eval) pairs\n`);

  const missing = getMissingPairs(experiments, evals, completed, retry);

  if (missing.size === 0) {
    console.log('All (experiment, eval) pairs are up to date!\n');
    if (!retry) {
      const failed = completed.filter((c) => !c.success);
      if (failed.length > 0) {
        console.log(`Note: ${failed.length} failed evals exist. Use --retry to re-run them.`);
      }
    }
    return;
  }

  const totalMissing = Array.from(missing.values()).reduce((a, b) => a + b.length, 0);
  console.log(`Need to run ${totalMissing} (experiment, eval) pairs across ${missing.size} experiments (parallel)\n`);

  if (dry) {
    for (const [exp, missingEvals] of missing) {
      console.log(`${exp}: ${missingEvals.length} evals`);
    }
  } else {
    const results = await Promise.allSettled(
      Array.from(missing.entries()).map(async ([exp, missingEvals]) => {
        console.log(`Starting ${exp} (${missingEvals.length} evals)...`);
        await runExperimentWithEvals(exp, missingEvals, false);
        return exp;
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        console.log(`${result.value} - completed`);
      } else {
        console.error(`Failed:`, result.reason);
      }
    }
  }

  console.log('\nDone! Run `npm run qa-and-export` to generate JSON.');
}

main().catch(console.error);
