/**
 * Fresh clone -> ready to run an eval, in one command.
 *
 * The manual sequence is only three steps, but the middle one is easy to miss:
 * `evals/` is git-ignored and synced from vercel/next.js, so a clone that looks
 * complete has no fixtures at all and every command dies in the framework's
 * loader. This runs install -> sync -> preflight in order and ends by printing
 * what to do next.
 *
 * Named `bootstrap`, not `setup`, because `pnpm setup` is a built-in pnpm
 * command and would shadow the script.
 *
 * Usage:
 *   pnpm bootstrap           # sync fixtures from next.js canary
 *   pnpm bootstrap <ref>     # ...from a branch, tag, or commit SHA
 *
 * Pass the SHA that .github/workflows/eval-cache-check.yml pins to reproduce
 * CI's view of the fixtures; canary drifts, and drift shows up as stale evals.
 */
import { spawnSync } from 'node:child_process';

const ref = process.argv[2];

// Reject a flag-shaped ref before the install, not three minutes into it. The
// only argument this takes is a git ref, so anything starting with `-` is a
// typo or a flag meant for something else.
if (ref?.startsWith('-')) {
  console.error(`✗ "${ref}" is not a ref. Usage: pnpm bootstrap [branch|tag|sha]`);
  process.exit(2);
}

// Raw escapes rather than a color library, so this stays dependency-light — but
// that means honouring NO_COLOR and piped output by hand.
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

const step = (n, total, label) => console.log(`\n${paint(1, `[${n}/${total}] ${label}`)}`);

/** Run a step, inheriting stdio. Returns the exit code. */
function run(cmd, args) {
  console.log(paint(90, `$ ${cmd} ${args.join(' ')}`));
  return spawnSync(cmd, args, { stdio: 'inherit' }).status ?? 1;
}

/** Run a step that must succeed for the following ones to mean anything. */
function runOrExit(cmd, args) {
  const code = run(cmd, args);
  if (code !== 0) {
    console.error(`\n${paint(31, `✗ \`${cmd} ${args.join(' ')}\` failed (exit ${code}).`)}`);
    process.exit(code);
  }
}

step(1, 3, 'Install dependencies');
runOrExit('pnpm', ['install', '--frozen-lockfile']);

step(2, 3, `Sync eval fixtures from vercel/next.js@${ref ?? 'canary'}`);
runOrExit('pnpm', ['sync-evals', ...(ref ? [ref] : [])]);

// Preflight has already printed the specifics and the fix for each problem, so
// this only needs to route the reader. Its exit code is propagated rather than
// swallowed: "bootstrap succeeded" should mean you can actually run an eval, so
// a Dockerfile or CI step that ends here does not report success on a tree that
// has no usable credentials.
step(3, 3, 'Check credentials and toolchain');
const preflightCode = run('node', ['scripts/preflight.mjs']);

console.log(`\n${paint(1, 'Next')}`);
if (preflightCode !== 0) {
  console.log('  Installed and synced, but the checks above are unresolved.');
  console.log('  Fill in .env.local — see .env.example — then re-check: pnpm preflight');
  process.exit(preflightCode);
}

console.log('  pnpm status                       what is new or changed, per experiment');
console.log('  pnpm eval:dry <experiment>        preview a run without executing it');
console.log('  pnpm eval:smoke <experiment>      one eval, one run, real sandbox');
console.log('  pnpm eval:run <experiment>        the real thing');
