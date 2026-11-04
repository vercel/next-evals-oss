import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  symlinkSync,
  existsSync,
  lstatSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractRunTokens, MODEL_PRICING, priceUsage } from './cost.js';
import { findInvalidRunReason } from './release-automation.js';

const require = createRequire(import.meta.url);
const sdkRoot = dirname(require.resolve('@vercel/agent-eval/package.json'));
export interface ComparisonPlan {
  name: string;
  pullRequest: string;
  repository: string;
  taskRepository: string;
  treatment: 'bundled-docs' | 'packages';
  packageName: string;
  tarballEnv: string;
  setupSteps: string[];
  scripts: string[];
  ignoredFiles: string[];
  packageArtifacts?: Record<'base' | 'head', { url: string; sha256: string }>;
  runtime?: string;
  base: string;
  head: string;
  fixtureRef: string;
  experiment: string;
  model: string;
  tasks: string[];
  defaultTask: string;
  guides: string[];
  limitations: string;
}
const hash = (value: string | Buffer) =>
  createHash('sha256').update(value).digest('hex');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path: string, value: unknown) =>
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');

export function loadPlan(repo: string, name: string): ComparisonPlan {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))
    throw new Error('Invalid comparison name');
  const path = join(repo, 'comparisons', `${name}.json`);
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink())
    throw new Error('Comparison must be a reviewed manifest file');
  const plan = json(path);
  if (plan.name !== name) throw new Error('Comparison name mismatch');
  validatePlan(plan, '');
  return plan;
}

// Read PR JSON as data; never check out or run the request PR's runner code.
export async function resolveRequest(
  number: string,
  reviewedHead: string,
  name: string,
  read: (endpoint: string) => Promise<any>,
  actor: string,
) {
  if (
    !/^[1-9][0-9]*$/.test(number) ||
    !/^[a-f0-9]{40}$/.test(reviewedHead) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)
  )
    throw new Error(
      'Provide a comparison PR number, exact reviewed head SHA and manifest name',
    );
  const repository = 'vercel/next-evals-oss';
  const pr = await read(`/repos/${repository}/pulls/${number}`);
  if (
    pr.state !== 'open' ||
    pr.base.repo.full_name !== repository ||
    pr.base.ref !== 'main' ||
    pr.head.repo?.full_name !== repository ||
    pr.head.sha !== reviewedHead
  )
    throw new Error(
      'Comparison PR must be open, in this repository, target main and match the reviewed SHA',
    );
  const file = await read(
    `/repos/${repository}/contents/comparisons/${name}.json?ref=${reviewedHead}`,
  );
  if (file.type !== 'file' || file.encoding !== 'base64' || file.size > 65536)
    throw new Error('Expected a small comparison manifest file');
  const plan = JSON.parse(
    Buffer.from(file.content, 'base64').toString('utf8'),
  ) as ComparisonPlan;
  if (plan.name !== name) throw new Error('Comparison name mismatch');
  validatePlan(plan, '');
  const match = plan.pullRequest.match(
    /^https:\/\/github.com\/([^/]+\/[^/]+)\/pull\/(\d+)$/,
  )!;
  if (match[1] !== plan.repository)
    throw new Error('PR repository does not match the manifest');
  const source = await read(`/repos/${plan.repository}/pulls/${match[2]}`);
  if (
    source.state !== 'open' ||
    source.base.sha !== plan.base ||
    source.head.sha !== plan.head
  )
    throw new Error(
      'Framework/docs PR changed; update and review the manifest base/head before running',
    );
  return {
    ...plan,
    request: { repository, number: Number(number), head: reviewedHead, actor },
  };
}

export function validatePlan(plan: ComparisonPlan, task: string) {
  task ||= plan.defaultTask;
  if (
    !/^[a-z0-9-]+$/.test(plan.name) ||
    ![plan.repository, plan.taskRepository].every((repo) =>
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo),
    ) ||
    !/^(?:@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(plan.packageName) ||
    !/^[A-Z][A-Z0-9_]*_TARBALL$/.test(plan.tarballEnv) ||
    !plan.setupSteps.length ||
    !plan.setupSteps.every((step) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(step)) ||
    !plan.scripts.every((script) => /^[a-zA-Z0-9:_-]+$/.test(script)) ||
    !plan.ignoredFiles.every(
      (path) =>
        /^(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\/?$/.test(path) &&
        !path.split('/').includes('..'),
    ) ||
    !['bundled-docs', 'packages'].includes(plan.treatment) ||
    (plan.treatment === 'bundled-docs' &&
      (plan.packageName !== 'next' ||
        !/^\d+\.\d+\.\d+(?:-canary\.\d+)?$/.test(plan.runtime ?? '') ||
        !plan.guides.length)) ||
    (plan.treatment === 'packages' &&
      (plan.guides.length !== 0 ||
        !['base', 'head'].every((condition) => {
          const artifact =
            plan.packageArtifacts?.[condition as 'base' | 'head'];
          return (
            artifact &&
            /^https:\/\//.test(artifact.url) &&
            /^[a-f0-9]{64}$/.test(artifact.sha256)
          );
        }))) ||
    ![plan.base, plan.head, plan.fixtureRef].every((ref) =>
      /^[a-f0-9]{40}$/.test(ref),
    ) ||
    !/^https:\/\/github.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+\/pull\/\d+$/.test(
      plan.pullRequest,
    ) ||
    !MODEL_PRICING[plan.experiment] ||
    !plan.model.startsWith('openai/') ||
    !plan.tasks.includes(plan.defaultTask) ||
    !plan.tasks.length ||
    plan.tasks.length > 4 ||
    new Set(plan.tasks).size !== plan.tasks.length ||
    !plan.tasks.every((name) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) ||
    !plan.guides.every((name) => /^(?:[a-z0-9-]+\/)+[a-z0-9-]+$/.test(name))
  ) {
    throw new Error('Invalid reviewed comparison manifest');
  }
  if (task !== 'all' && !plan.tasks.includes(task))
    throw new Error('Task is not in the reviewed manifest');
  return task === 'all' ? plan.tasks : [task];
}

export function files(root: string, prefix = ''): string[] {
  return readdirSync(join(root, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(prefix, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Unexpected symlink: ${path}`);
      return entry.isDirectory() ? files(root, path) : [path];
    })
    .sort();
}
export function fileHashes(root: string) {
  return Object.fromEntries(
    files(root).map((path) => [path, hash(readFileSync(join(root, path)))]),
  );
}
export function assertDocsOnly(
  before: Record<string, string>,
  after: Record<string, string>,
  guides: string[],
) {
  const allowed = new Set(
    guides.map((guide) => `package/dist/docs/${guide}.md`),
  );
  const changed = [
    ...new Set([...Object.keys(before), ...Object.keys(after)]),
  ].filter((path) => before[path] !== after[path]);
  if (!changed.length || changed.some((path) => !allowed.has(path)))
    throw new Error('Expected a docs-only package difference');
  return changed;
}

function fetchSource(
  root: string,
  label: string,
  ref: string,
  repository: string,
) {
  const dir = join(root, label);
  const git = (...args: string[]) =>
    execFileSync('git', ['-C', dir, ...args], {
      stdio: 'pipe',
      timeout: 180_000,
    });
  mkdirSync(dir, { recursive: true });
  git('init', '-q');
  git('remote', 'add', 'origin', `https://github.com/${repository}.git`);
  git('sparse-checkout', 'init', '--cone');
  git('sparse-checkout', 'set', 'evals', 'docs');
  git('fetch', '--depth=1', '--filter=blob:none', 'origin', ref);
  git('-c', 'core.hooksPath=/dev/null', 'checkout', '--detach', 'FETCH_HEAD');
  if (git('rev-parse', 'HEAD').toString().trim() !== ref)
    throw new Error('Source revision mismatch');
  return dir;
}

export async function prepare(
  repo: string,
  root: string,
  plan: ComparisonPlan,
  task: string,
) {
  const tasks = validatePlan(plan, task);
  if (existsSync(root))
    throw new Error('Use a fresh comparison workspace, never reuse results');
  mkdirSync(root, { recursive: true });
  const sources = {
    base:
      plan.treatment === 'bundled-docs'
        ? fetchSource(root, 'source-base', plan.base, plan.repository)
        : '',
    head:
      plan.treatment === 'bundled-docs'
        ? fetchSource(root, 'source-head', plan.head, plan.repository)
        : '',
    fixture: '',
  };
  sources.fixture =
    plan.taskRepository === plan.repository &&
    plan.fixtureRef === plan.head &&
    sources.head
      ? sources.head
      : fetchSource(
          root,
          'source-fixture',
          plan.fixtureRef,
          plan.taskRepository,
        );
  if (plan.treatment === 'packages') {
    for (const condition of ['base', 'head'] as const) {
      const artifact = plan.packageArtifacts![condition];
      const response = await fetch(artifact.url, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok)
        throw new Error(`Package download failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes) !== artifact.sha256)
        throw new Error('Package artifact hash mismatch');
      writeFileSync(join(root, `download-${condition}.tgz`), bytes);
    }
    prepareWorkspace(repo, root, plan, tasks, sources);
  } else {
    // npm verifies registry integrity; derive both docs treatments from one runtime.
    const packed = JSON.parse(
      execFileSync(
        'npm',
        [
          'pack',
          `next@${plan.runtime}`,
          '--ignore-scripts',
          '--json',
          '--pack-destination',
          root,
        ],
        { encoding: 'utf8', timeout: 180_000 },
      ),
    )[0];
    prepareWorkspace(
      repo,
      root,
      plan,
      tasks,
      sources,
      join(root, packed.filename),
      packed.integrity,
    );
  }
}

export function prepareWorkspace(
  repo: string,
  root: string,
  plan: ComparisonPlan,
  tasks: string[],
  sources: { base: string; head: string; fixture: string },
  runtimeTarball?: string,
  registryIntegrity?: string,
) {
  const packages: Record<
    string,
    { sha256: string; version: string; guides: Record<string, string> }
  > = {};
  const inventories: Record<string, Record<string, string>> = {};
  for (const condition of ['base', 'head'] as const) {
    const dir = join(root, `package-${condition}`);
    mkdirSync(dir);
    const input = runtimeTarball ?? join(root, `download-${condition}.tgz`);
    if (
      plan.treatment === 'packages' &&
      hash(readFileSync(input)) !== plan.packageArtifacts![condition].sha256
    )
      throw new Error('Package artifact hash mismatch');
    execFileSync('tar', ['-xzf', input, '-C', dir]);
    const pkg = json(join(dir, 'package/package.json'));
    if (pkg.name !== plan.packageName) throw new Error('Package name mismatch');
    const guides: Record<string, string> = {};
    for (const guide of plan.guides) {
      const contents = readFileSync(
        join(sources[condition], `docs/${guide}.mdx`),
      );
      const path = `package/dist/docs/${guide}.md`;
      if (!existsSync(join(dir, path)))
        throw new Error(`Missing bundled guide: ${guide}`);
      writeFileSync(join(dir, path), contents);
      guides[path] = hash(contents);
    }
    inventories[condition] = fileHashes(dir);
    const tarball = join(root, `${condition}.tgz`);
    if (plan.treatment === 'bundled-docs')
      execFileSync('tar', ['-czf', tarball, '-C', dir, 'package']);
    else cpSync(input, tarball);
    packages[condition] = {
      sha256: hash(readFileSync(tarball)),
      version: pkg.version,
      guides,
    };
  }
  const changedFiles =
    plan.treatment === 'bundled-docs'
      ? assertDocsOnly(inventories.base, inventories.head, plan.guides)
      : [
          ...new Set([
            ...Object.keys(inventories.base),
            ...Object.keys(inventories.head),
          ]),
        ].filter((path) => inventories.base[path] !== inventories.head[path]);
  if (!changedFiles.length)
    throw new Error('Treatments have identical package contents');
  const workspace = join(root, 'evals');
  mkdirSync(join(workspace, 'evals'), { recursive: true });
  mkdirSync(join(workspace, 'experiments'));
  cpSync(join(sources.fixture, 'evals/lib'), join(workspace, 'lib'), {
    recursive: true,
  });
  for (const name of tasks) {
    const source = join(sources.fixture, 'evals/evals', name);
    fileHashes(source); // Reject symlinks before copying task code.
    cpSync(source, join(workspace, 'evals', name), { recursive: true });
  }
  symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'), 'dir');
  writeFileSync(
    join(root, 'package.json'),
    '{"private":true,"type":"module"}\n',
  );
  for (const condition of ['base', 'head']) {
    writeFileSync(
      join(workspace, 'experiments', `${condition}.ts`),
      `import { comparisonExperiment } from ${JSON.stringify(join(repo, 'scripts/pr-comparison-experiment.ts'))};\nimport * as setup from '../lib/setup.js';\nexport default comparisonExperiment(${JSON.stringify(condition)}, setup);\n`,
    );
  }
  save(join(root, 'provenance.json'), {
    ...plan,
    tasks,
    packages,
    changedFiles,
    fixtureHashes: fileHashes(join(workspace, 'evals')),
    helperHashes: fileHashes(join(workspace, 'lib')),
    registryIntegrity: registryIntegrity ?? null,
    runtimeSha256: runtimeTarball ? hash(readFileSync(runtimeTarball)) : null,
    sdkVersion: json(join(sdkRoot, 'package.json')).version,
    runnerCommit: execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    pricing: MODEL_PRICING[plan.experiment],
    runsPerTaskPerCondition: 1,
    workflowRun: process.env.GITHUB_RUN_ID ?? null,
    createdAt: new Date().toISOString(),
  });
}

export function summarizeAttempt(
  runDir: string | undefined,
  pricing: NonNullable<(typeof MODEL_PRICING)[string]>,
) {
  if (!runDir)
    return {
      status: 'unavailable',
      reason: 'No saved attempt',
      inputTokens: null,
      costUsd: null,
      durationSeconds: null,
    };
  const result = json(join(runDir, 'result.json'));
  const raw = existsSync(join(runDir, 'transcript-raw.jsonl'))
    ? readFileSync(join(runDir, 'transcript-raw.jsonl'), 'utf8')
    : '';
  const outputPath = join(runDir, 'outputs/eval.txt');
  const evalOutput = existsSync(outputPath)
    ? readFileSync(outputPath, 'utf8')
    : undefined;
  const invalid = findInvalidRunReason({
    result,
    hasTranscript: Boolean(raw),
    evalOutput,
  });
  const usage = extractRunTokens(raw);
  const status =
    invalid || !['passed', 'failed'].includes(result.status)
      ? 'unavailable'
      : result.status;
  return {
    status,
    reason: invalid ?? null,
    inputTokens: usage
      ? usage.input + usage.cacheRead + usage.cacheWrite
      : null,
    outputTokens: usage?.output ?? null,
    cacheReadTokens: usage?.cacheRead ?? null,
    cacheWriteTokens: usage?.cacheWrite ?? null,
    costUsd: usage ? priceUsage(usage, pricing) : null,
    durationSeconds: Number.isFinite(result.duration) ? result.duration : null,
    provenance: result.provenance ?? null,
    observedModel: result.observedModel ?? null,
    checks: evalOutput?.match(/Tests\s+[^\n]+/)?.[0] ?? null,
  };
}

export async function retain(root: string) {
  const provenance = json(join(root, 'provenance.json'));
  const output = join(root, 'artifact');
  mkdirSync(output);
  const results = join(root, 'evals/results');
  const resultFiles = existsSync(results) ? files(results) : [];
  const { redactSecretsBuffer } = await import(
    pathToFileURL(join(sdkRoot, 'dist/lib/agents/redact.js')).href
  );
  const { sensitiveEnvironment, findSecretLeaks } = await import(
    new URL('./assert-no-secrets.mjs', import.meta.url).href
  );
  const secrets = sensitiveEnvironment().map(
    ([, value]: [string, string]) => value,
  );
  for (const path of resultFiles) {
    const target = join(output, 'results', path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      redactSecretsBuffer(readFileSync(join(results, path)), secrets),
    );
  }
  cpSync(join(root, 'provenance.json'), join(output, 'provenance.json'));
  if (existsSync(join(root, 'runner-status.json')))
    cpSync(
      join(root, 'runner-status.json'),
      join(output, 'runner-status.json'),
    );
  cpSync(join(root, 'evals/evals'), join(output, 'tasks'), { recursive: true });
  cpSync(join(root, 'evals/lib'), join(output, 'helpers'), { recursive: true });
  // Retain the exact guide treatments, not a moving link to the PR.
  for (const condition of ['base', 'head'])
    for (const guide of provenance.guides) {
      const target = join(output, 'guides', condition, `${guide}.md`);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(
        join(root, `package-${condition}`, `package/dist/docs/${guide}.md`),
        target,
      );
    }
  const records = [];
  for (const task of provenance.tasks)
    for (const condition of ['base', 'head']) {
      const matches = resultFiles.filter(
        (path) =>
          path.startsWith(`${condition}/`) &&
          path.endsWith(`/${task}/run-1/result.json`),
      );
      if (matches.length > 1)
        throw new Error('Multiple attempts found for one comparison cell');
      const runDir = matches[0]
        ? dirname(join(output, 'results', matches[0]))
        : undefined;
      records.push({
        task,
        condition,
        ...summarizeAttempt(runDir, provenance.pricing),
      });
    }
  save(join(output, 'comparison.json'), { provenance, records });
  const display = (n: number | null | undefined, money = false) =>
    n == null ? 'N/A' : money ? `$${n.toFixed(4)}` : n.toLocaleString('en-US');
  const text = [
    `# ${provenance.name} comparison`,
    '',
    provenance.pullRequest,
    '',
    provenance.treatment === 'bundled-docs'
      ? 'Same runtime, fixtures, graders, model and AGENTS.md pointer. Only bundled guide contents differ.'
      : 'Same fixtures, graders, model and setup. Before/after package artifacts differ; inspect the recorded source and package hashes.',
    '',
    '| Task | Docs | Outcome | Input tokens | Estimated coding cost | Run seconds |',
    '| --- | --- | --- | ---: | ---: | ---: |',
    ...records.map(
      (row) =>
        `| ${row.task} | ${row.condition} | ${row.status} | ${display(row.inputTokens)} | ${display(row.costUsd, true)} | ${display(row.durationSeconds)} |`,
    ),
    '',
    provenance.limitations,
    '',
    'Input includes cache reads and writes. Cost uses the recorded repository rates, excludes grading and Sandbox, and is not an invoice. Run duration includes validation. Inspect traces for docs discovery and recovery work. Unavailable attempts are not model failures. No retries or confirmations are included.',
    '',
    'Artifacts expire after 90 days (or the repository limit). Review and retain this complete artifact in an approved store before expiry. Public artifacts are not suitable for held-out tasks or customer data. This does not publish to nextjs.org/evals.',
    '',
  ].join('\n');
  writeFileSync(join(output, 'README.md'), text);
  if (findSecretLeaks([output]).length)
    throw new Error('Credential scan failed; artifact upload blocked');
  if (process.env.GITHUB_STEP_SUMMARY)
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  if (process.env.GITHUB_OUTPUT)
    writeFileSync(
      process.env.GITHUB_OUTPUT,
      `safe=true\ncomplete=${records.every((row) => row.status !== 'unavailable')}\n`,
    );
}

async function main() {
  const repo = process.cwd();
  const root = resolve(
    process.env.COMPARISON_WORKSPACE ?? '/tmp/next-pr-comparison',
  );
  const command = process.argv[2];
  if (command === 'request') {
    if (!process.env.GH_TOKEN || !process.env.COMPARISON_REQUEST_FILE)
      throw new Error('Missing request authentication or output path');
    const plan = await resolveRequest(
      process.env.COMPARISON_PR ?? '',
      process.env.COMPARISON_REVIEWED_HEAD ?? '',
      process.env.COMPARISON_NAME ?? 'activity-docs',
      async (endpoint) => {
        const response = await fetch(`https://api.github.com${endpoint}`, {
          redirect: 'error',
          headers: {
            authorization: `Bearer ${process.env.GH_TOKEN}`,
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (!response.ok)
          throw new Error(`GitHub request failed: ${response.status}`);
        return response.json();
      },
      process.env.GITHUB_ACTOR ?? 'local',
    );
    save(process.env.COMPARISON_REQUEST_FILE, plan);
  } else if (command === 'prepare') {
    const plan = process.env.COMPARISON_PR
      ? json(process.env.COMPARISON_REQUEST_FILE!)
      : loadPlan(repo, process.env.COMPARISON_NAME ?? 'activity-docs');
    await prepare(repo, root, plan, process.env.COMPARISON_TASK ?? '');
  } else if (command === 'run') {
    const statuses = [];
    for (const condition of ['base', 'head']) {
      const result = spawnSync(
        process.execPath,
        [
          join(sdkRoot, 'dist/cli.js'),
          'run',
          '--force',
          '--ack-failures',
          condition,
        ],
        {
          cwd: join(root, 'evals'),
          stdio: 'inherit',
          env: {
            ...process.env,
            [json(join(root, 'provenance.json')).tarballEnv]: join(
              root,
              `${condition}.tgz`,
            ),
          },
        },
      );
      statuses.push({
        condition,
        exitCode: result.status,
        signal: result.signal,
      });
      if (result.signal || result.error) break;
    }
    save(join(root, 'runner-status.json'), statuses);
  } else if (command === 'retain') await retain(root);
  else throw new Error('Usage: pr-comparison.ts request|prepare|run|retain');
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main();
