/**
 * Recompute fingerprints in existing results so config changes (e.g. timeout bumps)
 * don't invalidate cached runs. Extracted from sync-evals.ts so it can be run
 * standalone without re-syncing evals/.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { computeFingerprint } from '@vercel/agent-eval';

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
    scripts: scripts.split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean),
    timeout: Number(timeout),
    earlyExit: earlyExit === 'true',
    runs: Number(runs),
  };
}

const filter = process.argv[2];
const resultsDir = join(process.cwd(), 'results');
const evalsDir = join(process.cwd(), 'evals');
const experimentsDir = join(process.cwd(), 'experiments');

let updated = 0;
let scanned = 0;

for (const experiment of readdirSync(experimentsDir).filter((f) => f.endsWith('.ts'))) {
  const experimentName = experiment.replace(/\.ts$/, '');
  if (filter && !experimentName.includes(filter)) continue;

  const config = parseExperimentConfig(join(experimentsDir, experiment));
  if (!config) {
    console.warn(`Skipping ${experimentName}: could not parse config`);
    continue;
  }

  const expResultsDir = join(resultsDir, experimentName);
  if (!existsSync(expResultsDir)) continue;

  console.log(`Processing ${experimentName} (timeout=${config.timeout})`);

  for (const timestamp of readdirSync(expResultsDir)) {
    const tsDir = join(expResultsDir, timestamp);
    if (!statSync(tsDir).isDirectory()) continue;

    for (const evalName of readdirSync(tsDir)) {
      const summaryPath = join(tsDir, evalName, 'summary.json');
      const evalPath = join(evalsDir, evalName);
      if (!existsSync(summaryPath) || !existsSync(evalPath)) continue;

      scanned++;
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

console.log(`\nScanned ${scanned} summaries, updated ${updated} fingerprints.`);
