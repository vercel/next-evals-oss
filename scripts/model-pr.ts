import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PullRequestSnapshot {
  number: number;
  state: string;
  user: { login: string };
  base: { ref: string };
  head: {
    ref: string;
    sha: string;
    repo: { full_name: string } | null;
  };
}

export interface PullRequestFile {
  filename: string;
  status: string;
}

export interface ModelPullRequestCandidate {
  pullRequest: PullRequestSnapshot;
  files: PullRequestFile[];
}

const EXPERIMENT = /^experiments\/([a-z0-9][a-z0-9.-]*)(--agents-md)?\.ts$/;
const SAFE_SUPPORT_FILES = new Set([
  'agent-results.json',
  'lib/tier-one.ts',
  'scripts/check-stale.mjs',
  'scripts/cost.ts',
  'scripts/export-results.ts',
]);

function fail(message: string): never {
  throw new Error(`Model registration PR is not eligible: ${message}`);
}

export function selectModelExperiments(
  pullRequest: PullRequestSnapshot,
  files: PullRequestFile[],
  repository: string,
) {
  if (pullRequest.state !== 'open') fail('the pull request is not open');
  if (pullRequest.user.login !== 'roboeve[bot]') {
    fail('only RoboEve-authored pull requests run automatically');
  }
  if (pullRequest.base.ref !== 'main') fail('the base branch must be main');
  if (pullRequest.head.repo?.full_name !== repository) {
    fail('the head branch must belong to this repository');
  }
  if (!pullRequest.head.ref.startsWith('v/register-')) {
    fail('the head branch must start with v/register-');
  }
  if (!/^[a-f0-9]{40}$/.test(pullRequest.head.sha)) {
    fail('the head SHA is invalid');
  }

  const added = new Set<string>();
  for (const file of files) {
    const match = file.filename.match(EXPERIMENT);
    if (match && file.status === 'added')
      added.add(`${match[1]}${match[2] ?? ''}`);
  }

  const bases = [...added]
    .filter((experiment) => !experiment.endsWith('--agents-md'))
    .sort();
  if (bases.length === 0) fail('no new base experiment was found');

  for (const base of bases) {
    if (!added.has(`${base}--agents-md`)) {
      fail(`${base} is missing its --agents-md experiment`);
    }
  }
  for (const experiment of added) {
    if (
      experiment.endsWith('--agents-md') &&
      !added.has(experiment.slice(0, -'--agents-md'.length))
    ) {
      fail(`${experiment} is missing its base experiment`);
    }
  }

  const selected = new Set(
    bases.flatMap((base) => [base, `${base}--agents-md`]),
  );
  for (const file of files) {
    const match = file.filename.match(EXPERIMENT);
    const fullExperiment = match ? `${match[1]}${match[2] ?? ''}` : undefined;
    const selectedResult = [...selected].some((name) =>
      file.filename.startsWith(`results/${name}/`),
    );

    if (
      (fullExperiment && selected.has(fullExperiment)) ||
      selectedResult ||
      SAFE_SUPPORT_FILES.has(file.filename)
    ) {
      continue;
    }
    fail(`unexpected changed path ${file.filename}`);
  }

  return {
    number: pullRequest.number,
    headRef: pullRequest.head.ref,
    headSha: pullRequest.head.sha,
    pairs: bases.map((base) => ({
      base,
      experiments: [base, `${base}--agents-md`],
    })),
  };
}

function hasCompleteResultPaths(
  selection: ReturnType<typeof selectModelExperiments>,
  files: PullRequestFile[],
) {
  const changed = new Set(files.map((file) => file.filename));
  const experiments = selection.pairs.flatMap((pair) => pair.experiments);
  return (
    changed.has('agent-results.json') &&
    experiments.every((experiment) =>
      files.some((file) => file.filename.startsWith(`results/${experiment}/`)),
    )
  );
}

export function selectModelCandidate(
  candidates: ModelPullRequestCandidate[],
  repository: string,
  includeMeasured = false,
) {
  for (const candidate of candidates) {
    try {
      const selection = selectModelExperiments(
        candidate.pullRequest,
        candidate.files,
        repository,
      );
      if (
        includeMeasured ||
        !hasCompleteResultPaths(selection, candidate.files)
      ) {
        return selection;
      }
    } catch (error) {
      console.warn(
        `Skipping PR #${candidate.pullRequest.number}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return null;
}

function writeOutput(name: string, value: string | number) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) throw new Error('GITHUB_OUTPUT is required');
  appendFileSync(output, `${name}=${value}\n`);
}

function discover() {
  const candidatesPath = process.env.MODEL_PR_CANDIDATES_JSON;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!candidatesPath || !repository) {
    throw new Error(
      'MODEL_PR_CANDIDATES_JSON and GITHUB_REPOSITORY are required',
    );
  }

  const candidates = JSON.parse(
    readFileSync(candidatesPath, 'utf8'),
  ) as ModelPullRequestCandidate[];
  const selected = selectModelCandidate(
    candidates,
    repository,
    process.env.FORCE === 'true',
  );
  if (!selected) {
    writeOutput('should-run', 'false');
    writeOutput('pairs', '[]');
    console.log('No unmeasured RoboEve model-registration PR found');
    return;
  }

  writeOutput('should-run', 'true');
  writeOutput('pr-number', selected.number);
  writeOutput('head-ref', selected.headRef);
  writeOutput('head-sha', selected.headSha);
  writeOutput('pairs', JSON.stringify(selected.pairs));
}

function validateResults(experiments: string[]) {
  if (experiments.length === 0) throw new Error('No experiments were provided');

  const status = JSON.parse(
    execFileSync('pnpm', ['exec', 'agent-eval', 'status', '--json'], {
      encoding: 'utf8',
    }),
  ) as {
    work: Array<{ experiment: string; new: string[]; changed: string[] }>;
  };
  const work = new Map(status.work.map((entry) => [entry.experiment, entry]));
  const incomplete: string[] = [];

  for (const experiment of experiments) {
    if (!existsSync(join('results', experiment))) {
      incomplete.push(`${experiment}: no results directory`);
      continue;
    }
    const pending = work.get(experiment);
    if (pending && (pending.new.length > 0 || pending.changed.length > 0)) {
      incomplete.push(
        `${experiment}: ${pending.new.length} new, ${pending.changed.length} changed eval(s)`,
      );
    }
  }

  if (incomplete.length > 0) {
    throw new Error(`Incomplete model results:\n${incomplete.join('\n')}`);
  }
  console.log(`Complete results for ${experiments.join(', ')}`);
}

const [command, ...args] = process.argv.slice(2);
if (command === 'discover') discover();
else if (command === 'validate-results') validateResults(args);
else if (import.meta.url === `file://${process.argv[1]}`) {
  throw new Error(
    'Usage: model-pr.ts discover | validate-results <experiment...>',
  );
}
