import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ExperimentConfig, Sandbox } from '@vercel/agent-eval';

type Setup = Record<
  'installNextJs' | 'installPlaywright' | 'prepareFixture' | 'writeAgentsMd',
  (sandbox: Sandbox) => Promise<void>
>;

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
    process.env.NEXT_EVAL_TARBALL !== tarball ||
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
    scripts: ['build'],
    timeout: 900,
    sandbox: 'vercel',
    copyFiles: 'all',
    judge: { model: 'claude-haiku-4-5' },
    setup: async (sandbox) => {
      const ignored = await sandbox.runCommand('node', [
        '-e',
        String.raw`require('node:fs').appendFileSync('.git/info/exclude', '\nnext.tgz\n.next/\ntsconfig.tsbuildinfo\n')`,
      ]);
      if (ignored.exitCode !== 0)
        throw new Error('Could not exclude build artifacts');
      await setup.installNextJs(sandbox);
      const installed = JSON.parse(
        await sandbox.readFile('node_modules/next/package.json'),
      );
      if (installed.version !== provenance.runtime)
        throw new Error('Installed runtime mismatch');
      for (const [path, digest] of Object.entries(expected.guides)) {
        if (
          hash(
            await sandbox.readFile(
              path.replace('package/', 'node_modules/next/'),
            ),
          ) !== digest
        ) {
          throw new Error('Installed guidance mismatch');
        }
      }
      await setup.installPlaywright(sandbox);
      await setup.prepareFixture(sandbox);
      await setup.writeAgentsMd(sandbox);
    },
  };
}
