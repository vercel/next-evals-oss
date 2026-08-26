import type { Sandbox } from '@vercel/agent-eval'

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

/** Bump an existing Next.js fixture to the latest canary. No-op otherwise. */
export async function bumpNextCanary(sandbox: Sandbox): Promise<void> {
  if (!(await isNextApp(sandbox))) {
    console.log('> Fixture does not depend on Next.js; leaving it untouched');
    return;
  }
  await sandbox.runCommand('npm', ['install', 'next@canary']);
}

/**
 * Write the AGENTS.md variant's rules file. Skipped for a fixture that is not
 * already a Next.js app, since it points into a node_modules path that does not
 * exist yet and names the framework those evals are watching for.
 */
export async function writeAgentsMd(
  sandbox: Sandbox,
  body: string,
  extra: Record<string, string> = {}
): Promise<void> {
  if (!(await isNextApp(sandbox))) {
    console.log('> Fixture does not depend on Next.js; skipping AGENTS.md');
    return;
  }
  await sandbox.writeFiles({ 'AGENTS.md': body, ...extra });
}
