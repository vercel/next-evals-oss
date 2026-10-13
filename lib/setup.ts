import type { Sandbox } from '@vercel/agent-eval';

/**
 * Whether the fixture is already a Next.js app.
 *
 * Almost every fixture is: it ships a Next.js project and asks the agent to change
 * something about it. The exceptions are the framework-choice evals, which hand
 * over an empty directory and ask what the agent reaches for. Setting Next.js up
 * for those before the agent starts answers the question for it, so the steps below
 * skip them. Keyed off the fixture's own manifest, so neither kind needs wiring
 * here when it is added.
 */
export async function isNextApp(sandbox: Sandbox): Promise<boolean> {
  try {
    const pkg = JSON.parse(await sandbox.readFile('package.json'));
    return Boolean(pkg.dependencies?.next ?? pkg.devDependencies?.next);
  } catch {
    return false;
  }
}

/**
 * Package spec used by every experiment.
 *
 * Manual runs keep following canary. Release automation pins this to the exact
 * version that was just published so the board cannot accidentally measure a
 * newer canary under a stable release label.
 */
export function getNextPackageSpec(): string {
  const version = process.env.NEXT_EVAL_VERSION?.trim();
  if (!version) return 'next@canary';

  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(
      `NEXT_EVAL_VERSION must be an exact npm version, received ${JSON.stringify(version)}`,
    );
  }

  return `next@${version}`;
}

/** Install the requested Next.js version into an eval sandbox. */
export async function installNext(sandbox: Sandbox) {
  const packageSpec = getNextPackageSpec();
  console.log(`> Installing ${packageSpec}`);
  const install = await sandbox.runCommand('npm', ['install', packageSpec]);
  if (install.exitCode !== 0) {
    throw new Error(`Failed to install ${packageSpec} in the eval sandbox.`);
  }

  const requestedVersion = process.env.NEXT_EVAL_VERSION?.trim();
  if (requestedVersion) {
    const installed = await sandbox.runCommand('node', [
      '-p',
      "require('./node_modules/next/package.json').version",
    ]);
    if (
      installed.exitCode !== 0 ||
      installed.stdout.trim() !== requestedVersion
    ) {
      throw new Error(
        `Expected ${packageSpec}, but the eval sandbox reported ${JSON.stringify(installed.stdout.trim())}.`,
      );
    }
  }

  return install;
}

/**
 * Write the AGENTS.md variant's rules file. Skipped for a fixture that is not
 * already a Next.js app, since it points into a node_modules path that does not
 * exist yet and names the framework those evals are watching for.
 */
export async function writeAgentsMd(
  sandbox: Sandbox,
  body: string,
  extra: Record<string, string> = {},
): Promise<void> {
  if (!(await isNextApp(sandbox))) {
    console.log('> Fixture does not depend on Next.js; skipping AGENTS.md');
    return;
  }
  await sandbox.writeFiles({ 'AGENTS.md': body, ...extra });
}
