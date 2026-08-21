/**
 * Preflight for "can this machine actually run an eval?".
 *
 * The first two checks below came out of standing this repo up in a fresh
 * sandbox, and both surface late and cryptically if you just run the eval: a
 * missing `evals/` dies inside the framework's fixture loader, and a half-filled
 * VERCEL_TOKEN triple silently degrades to the OIDC path and reports "Could not
 * get credentials from OIDC context". A missing agent key is quieter still — the
 * runner prints one "skipping <experiment>" line and carries on.
 *
 * The checks are read-only and ask the framework the same questions the runner
 * asks — `loadConfig` for each experiment, then the agent's own
 * `getApiKeyEnvVar()` — rather than pattern-matching the configs, so this can't
 * drift from what `agent-eval` will really do.
 *
 * Usage:
 *   pnpm preflight                  # every experiment; missing agent keys warn
 *   pnpm preflight claude-opus-5    # named experiments; missing agent keys fail
 *   pnpm preflight 'claude-*'       # globs work too
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';

import { getAgent, loadConfig, resolveBackend } from '@vercel/agent-eval';
import { config as dotenvConfig } from 'dotenv';
import { minimatch } from 'minimatch';

// Mirror the CLI's own env loading (cli.js), so preflight sees exactly the
// environment the runner will: .env.local first, then .env, both overriding
// what is already exported in the shell.
dotenvConfig({ path: '.env.local', override: true });
dotenvConfig({ override: true });

/** Hard floor: @vercel/agent-eval declares engines.node >= 18. */
const MIN_NODE_MAJOR = 18;
/** Soft floor: what .github/workflows/eval-cache-check.yml actually runs. */
const CI_NODE_MAJOR = 22;

// Raw escapes rather than a color library, so this stays dependency-light — but
// that means honouring NO_COLOR and piped output by hand, or CI logs fill with
// escape codes.
const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

const ok = (s) => `${paint(32, '✓')} ${s}`;
const bad = (s) => `${paint(31, '✗')} ${s}`;
const warn = (s) => `${paint(33, '!')} ${s}`;
const dim = (s) => paint(90, s);
const heading = (s) => `\n${paint(1, s)}`;

/** Problems that mean "you cannot run evals at all". */
const errors = [];
/** Problems that only narrow what you can run. */
const warnings = [];

function fail(msg, hint) {
  errors.push({ msg, hint });
  console.log(bad(msg));
  if (hint) console.log(dim(`    ${hint}`));
}

function caution(msg, hint) {
  warnings.push({ msg, hint });
  console.log(warn(msg));
  if (hint) console.log(dim(`    ${hint}`));
}

function pass(msg, detail) {
  console.log(ok(msg) + (detail ? ` ${dim(detail)}` : ''));
}

/** Present AND non-empty — an exported-but-blank var is not a credential. */
const has = (name) => Boolean(process.env[name]);

function list(names, max = 4) {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown}, +${names.length - max} more` : shown;
}

// Toolchain

function checkToolchain() {
  console.log(heading('Toolchain'));

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= CI_NODE_MAJOR) {
    pass(`node ${process.version}`);
  } else if (major >= MIN_NODE_MAJOR) {
    caution(
      `node ${process.version}`,
      `Above @vercel/agent-eval's floor (>= ${MIN_NODE_MAJOR}) but below the ${CI_NODE_MAJOR} CI runs — untested here.`
    );
  } else {
    fail(
      `node ${process.version} — @vercel/agent-eval requires >= ${MIN_NODE_MAJOR}`,
      `CI runs node ${CI_NODE_MAJOR}; match that if you can.`
    );
  }

  try {
    const version = execFileSync('pnpm', ['--version'], { encoding: 'utf-8' }).trim();
    pass(`pnpm ${version}`);
  } catch {
    fail('pnpm not found', 'corepack enable, or npm i -g pnpm — the lockfile and workspace are pnpm-only.');
  }
}

// Eval fixtures

function checkFixtures() {
  console.log(heading('Eval fixtures'));

  const evalsDir = resolve('evals');
  if (!existsSync(evalsDir)) {
    fail(
      'evals/ is missing',
      'Fixtures live upstream in vercel/next.js and are git-ignored here. Run: pnpm sync-evals'
    );
    return;
  }

  const fixtures = readdirSync(evalsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (fixtures.length === 0) {
    fail('evals/ is empty', 'Re-run: pnpm sync-evals');
    return;
  }
  pass(`evals/ — ${fixtures.length} fixture(s)`);
}

// Experiments

/** Load the named experiments (or all of them) exactly as the runner does. */
async function loadExperiments(patterns) {
  const dir = resolve('experiments');
  if (!existsSync(dir)) {
    fail('experiments/ is missing', 'Are you running this from the repo root?');
    return [];
  }

  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_temp_'))
    .sort();

  const selected =
    patterns.length === 0
      ? all
      : all.filter((f) => {
          const name = basename(f, '.ts');
          return patterns.some((p) => (p.includes('*') ? minimatch(name, p) : name === p));
        });

  if (patterns.length > 0 && selected.length === 0) {
    fail(
      `No experiments matched: ${patterns.join(', ')}`,
      `Available: ${list(all.map((f) => basename(f, '.ts')), 8)}`
    );
    return [];
  }

  const loaded = [];
  for (const file of selected) {
    const name = basename(file, '.ts');
    try {
      loaded.push({ name, config: await loadConfig(resolve(dir, file)) });
    } catch (err) {
      fail(`experiments/${file} failed to load`, err instanceof Error ? err.message : String(err));
    }
  }
  return loaded;
}

// Sandbox

/**
 * Vercel Sandbox accepts either the full VERCEL_TOKEN triple or an OIDC token.
 * A partial triple is the trap: @vercel/sandbox only treats the params as
 * credentials when all three are present, so 1-or-2 falls through to OIDC and
 * fails there instead of saying which variable you forgot.
 */
function checkVercelSandbox(users) {
  const TRIPLE = ['VERCEL_TOKEN', 'VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID'];
  const present = TRIPLE.filter(has);
  const missing = TRIPLE.filter((n) => !has(n));

  if (present.length === TRIPLE.length) {
    pass('auth — VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID');
    return;
  }
  if (has('VERCEL_OIDC_TOKEN')) {
    if (present.length > 0) {
      caution(
        `auth — using VERCEL_OIDC_TOKEN; ${list(present)} ignored (incomplete triple, missing ${list(missing)})`,
        'Harmless, but set all three or none so it is clear which path is live.'
      );
    } else {
      pass('auth — VERCEL_OIDC_TOKEN');
    }
    return;
  }

  if (present.length > 0) {
    fail(
      `auth — incomplete: ${list(present)} set, missing ${list(missing)}`,
      'All three are required together. A partial set falls back to OIDC and dies with ' +
        '"Could not get credentials from OIDC context".'
    );
  } else {
    fail(
      `auth — no Vercel Sandbox credentials (needed by ${users} experiment(s))`,
      'Either: npx vercel link && npx vercel env pull .env.local   (writes VERCEL_OIDC_TOKEN)\n' +
        '    or: set VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID. See .env.example.'
    );
  }
}

function checkDockerSandbox(users) {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    pass('docker daemon reachable');
  } catch {
    fail(
      `docker daemon unreachable (needed by ${users} experiment(s))`,
      'Start Docker, or point those experiments at sandbox: "vercel".'
    );
  }
}

function checkSandboxes(experiments) {
  const byBackend = new Map();
  for (const { name, config } of experiments) {
    const backend = resolveBackend({ backend: config.sandbox });
    if (!byBackend.has(backend)) byBackend.set(backend, []);
    byBackend.get(backend).push(name);
  }

  for (const [backend, users] of byBackend) {
    console.log(heading(`Sandbox: ${backend} — ${users.length} experiment(s)`));
    if (backend === 'vercel') checkVercelSandbox(users.length);
    else checkDockerSandbox(users.length);
  }
}

// Agent credentials

/**
 * Group the experiments by the env var their agent reads, then report each var
 * once. `strict` is set when the user named experiments explicitly: asking
 * about an experiment you cannot run should fail, whereas the default sweep
 * covers five providers at once and nobody holds every key.
 */
function checkAgentCredentials(experiments, strict) {
  console.log(heading('Agent credentials'));

  const byEnvVar = new Map();
  for (const { name, config } of experiments) {
    let envVar;
    try {
      envVar = getAgent(config.agent).getApiKeyEnvVar();
    } catch (err) {
      fail(`${name}: unknown agent "${config.agent}"`, err instanceof Error ? err.message : String(err));
      continue;
    }
    if (!byEnvVar.has(envVar)) byEnvVar.set(envVar, []);
    byEnvVar.get(envVar).push(name);
  }

  if (byEnvVar.size === 0) return;

  // VERCEL_OIDC_TOKEN authenticates the AI Gateway too, so the framework falls
  // back to it for every agent.
  const oidc = has('VERCEL_OIDC_TOKEN');

  for (const [envVar, users] of [...byEnvVar].sort((a, b) => b[1].length - a[1].length)) {
    const label = `${envVar} ${dim(`— ${users.length} experiment(s): ${list(users)}`)}`;
    if (has(envVar)) {
      pass(label);
    } else if (oidc) {
      pass(`${label}\n    ${dim('unset; falling back to VERCEL_OIDC_TOKEN')}`);
    } else {
      const hint = `Unset, and no VERCEL_OIDC_TOKEN to fall back on — the runner skips these experiments.`;
      if (strict) fail(label, hint);
      else caution(label, hint);
    }
  }
}

// Failure classifier

/**
 * Not required to run, but without it every infra hiccup is kept as a result
 * and pollutes results/ — worth one line so it is a choice, not a surprise.
 */
function checkClassifier() {
  console.log(heading('Failure classifier'));
  if (has('AI_GATEWAY_API_KEY')) pass('enabled', 'via AI_GATEWAY_API_KEY');
  else if (has('VERCEL_OIDC_TOKEN')) pass('enabled', 'via VERCEL_OIDC_TOKEN');
  else
    caution(
      'disabled — infra/timeout failures will be kept as real results',
      'Set AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN to let housekeeping drop non-model failures.'
    );
}

// main

const patterns = process.argv.slice(2);
const strict = patterns.length > 0;

checkToolchain();
checkFixtures();

const experiments = await loadExperiments(patterns);
if (experiments.length > 0) {
  checkSandboxes(experiments);
  checkAgentCredentials(experiments, strict);
}
checkClassifier();

console.log('');
if (errors.length > 0) {
  console.log(bad(`${errors.length} blocking problem(s), ${warnings.length} warning(s).`));
  process.exit(1);
}
if (warnings.length > 0) {
  console.log(warn(`${warnings.length} warning(s) — you can run evals, but read the notes above.`));
} else {
  console.log(ok('Ready. Try: pnpm eval:smoke <experiment>'));
}
