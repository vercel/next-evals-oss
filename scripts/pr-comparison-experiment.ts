import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExperimentConfig, Sandbox } from '@vercel/agent-eval';

type Setup = Record<string, (sandbox: Sandbox) => Promise<void>>;

export function comparisonExperiment(
  condition: 'base' | 'head',
  setup: Setup,
): ExperimentConfig {
  const root = resolve('..');
  const provenance = JSON.parse(
    readFileSync(resolve(root, 'provenance.json'), 'utf8'),
  );
  const expected = provenance.packages[condition];
  const tarball = resolve(root, `${condition}.tgz`);
  const hash = (value: string | Buffer) =>
    createHash('sha256').update(value).digest('hex');
  if (
    process.env[provenance.tarballEnv] !== tarball ||
    hash(readFileSync(tarball)) !== expected.sha256
  ) {
    throw new Error('Package does not match comparison provenance');
  }
  return {
    agent: 'vercel-ai-gateway/codex',
    model: provenance.model,
    evals: provenance.tasks,
    runs: 1,
    earlyExit: false,
    scripts: provenance.scripts,
    timeout: 900,
    sandbox: 'vercel',
    copyFiles: 'all',
    judge: { model: 'claude-haiku-4-5' },
    setup: async (sandbox) => {
      const ignored = await sandbox.runCommand('node', [
        '-e',
        `require('node:fs').appendFileSync('.git/info/exclude', ${JSON.stringify('\n' + provenance.ignoredFiles.join('\n') + '\n')})`,
      ]);
      if (ignored.exitCode !== 0)
        throw new Error('Could not exclude build artifacts');
      for (const step of provenance.setupSteps) {
        if (typeof setup[step] !== 'function')
          throw new Error(`Missing setup export: ${step}`);
        await setup[step](sandbox);
      }
      const installed = JSON.parse(
        await sandbox.readFile(
          `node_modules/${provenance.packageName}/package.json`,
        ),
      );
      if (
        installed.name !== provenance.packageName ||
        installed.version !== expected.version
      )
        throw new Error('Installed runtime mismatch');
      for (const [path, digest] of Object.entries(expected.guides)) {
        if (
          hash(
            await sandbox.readFile(
              path.replace(
                'package/',
                `node_modules/${provenance.packageName}/`,
              ),
            ),
          ) !== digest
        ) {
          throw new Error('Installed guidance mismatch');
        }
      }
    },
  };
}
