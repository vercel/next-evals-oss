import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { findInvalidRunReason } from './release-automation.js';

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

export interface PullRequestApproval {
  login: string;
  /** GitHub collaborator permission: admin, write, read, or none. */
  permission: string;
}

export interface PullRequestReview {
  /** Approving reviews submitted for exactly the head SHA. */
  approvals: PullRequestApproval[];
}

export interface ModelPullRequestCandidate extends PullRequestReview {
  pullRequest: PullRequestSnapshot;
  files: PullRequestFile[];
  measuredByAutomation: boolean;
}

const EXPERIMENT = /^experiments\/([a-z0-9][a-z0-9.-]*)(--agents-md)?\.ts$/;
const SAFE_SUPPORT_FILES = new Set([
  'agent-results.json',
  'lib/tier-one.ts',
  'scripts/check-stale.mjs',
  'scripts/cost.ts',
  'scripts/export-results.ts',
]);

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/messages';

type Fetch = typeof globalThis.fetch;
type Sleep = (milliseconds: number) => Promise<void>;

const sleep: Sleep = (milliseconds) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function fail(message: string): never {
  throw new Error(`Model registration PR is not eligible: ${message}`);
}

export function hasRequiredModelApprovals(approvedBy: string[]) {
  return approvedBy.length >= 2;
}

export function gatewayModelId(model: string, agent?: string) {
  const withoutProvider = model.startsWith('vercel/')
    ? model.slice('vercel/'.length)
    : model;
  const withoutOptions = withoutProvider.split('?', 1)[0];
  if (!withoutOptions.includes('/') && agent?.endsWith('/claude-code')) {
    return `anthropic/${withoutOptions}`;
  }
  return withoutOptions;
}

export async function checkGatewayModelAccess(
  model: string,
  apiKey: string,
  fetchImpl: Fetch = globalThis.fetch,
  agent?: string,
  sleepImpl: Sleep = sleep,
) {
  const gatewayModel = gatewayModelId(model, agent);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetchImpl(GATEWAY_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: gatewayModel,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ok' }],
      }),
    });
    if (response.ok) return gatewayModel;

    const body = (await response.text()).replace(/\s+/g, ' ').slice(0, 500);
    const accessDenied = /restricted access|not allowed|provider allowlist/i.test(
      body,
    );
    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500;
    if (accessDenied || !retryable || attempt === 3) {
      throw new Error(
        `AI Gateway rejected ${gatewayModel} before the eval matrix started (${response.status}): ${body}`,
      );
    }
    await sleepImpl(attempt * 1_000);
  }
  throw new Error(`AI Gateway access probe did not finish for ${gatewayModel}`);
}

async function probeModelAccess(experiment: string) {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  if (!apiKey) throw new Error('AI_GATEWAY_API_KEY is required');

  const experimentPath = resolve('experiments', `${experiment}.ts`);
  if (!existsSync(experimentPath)) {
    throw new Error(`Unknown experiment: ${experiment}`);
  }
  const imported = (await import(pathToFileURL(experimentPath).href)) as {
    default?: { agent?: unknown; model?: unknown };
  };
  const model = imported.default?.model;
  if (typeof model !== 'string' || model.length === 0) {
    throw new Error(`${experiment} does not define a string model`);
  }
  const agent = imported.default?.agent;
  if (typeof agent !== 'string' || !agent.startsWith('vercel-ai-gateway/')) {
    throw new Error(`${experiment} does not use a Vercel AI Gateway agent`);
  }

  const gatewayModel = await checkGatewayModelAccess(
    model,
    apiKey,
    globalThis.fetch,
    agent,
  );
  console.log(`AI Gateway access confirmed for ${gatewayModel}`);
}

export function selectModelExperiments(
  pullRequest: PullRequestSnapshot,
  files: PullRequestFile[],
  repository: string,
  review: PullRequestReview,
  options: { requireApproval?: boolean } = {},
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

  // The experiment files are TypeScript that the credentialed job executes.
  // Git author and committer identities are editable metadata, so require two
  // distinct maintainers to approve exactly this head SHA. Any later push
  // drops both approvals until the new head is reviewed.
  const approvedBy = [
    ...new Set(
      review.approvals
        .filter(
          (approval) =>
            approval.permission === 'admin' || approval.permission === 'write',
        )
        .map((approval) => approval.login),
    ),
  ].sort();
  if (
    options.requireApproval !== false &&
    !hasRequiredModelApprovals(approvedBy)
  ) {
    fail('the head commit needs approving reviews from two maintainers');
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
    approvedBy,
    pairs: bases.map((base) => ({
      base,
      experiments: [base, `${base}--agents-md`],
    })),
  };
}

export function selectModelCandidate(
  candidates: ModelPullRequestCandidate[],
  repository: string,
  includeMeasured = false,
) {
  for (const candidate of candidates) {
    try {
      // Partial or smoke results may already be committed to a registration
      // PR. Only the workflow's own verified result commit proves that its
      // complete matrix was written successfully.
      if (!includeMeasured && candidate.measuredByAutomation) continue;
      const selection = selectModelExperiments(
        candidate.pullRequest,
        candidate.files,
        repository,
        candidate,
      );
      return selection;
    } catch (error) {
      console.warn(
        `Skipping PR #${candidate.pullRequest.number}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return null;
}

export function selectModelNotificationCandidate(
  candidates: ModelPullRequestCandidate[],
  repository: string,
  includeMeasured = false,
) {
  for (const candidate of candidates) {
    try {
      if (!includeMeasured && candidate.measuredByAutomation) continue;
      return selectModelExperiments(
        candidate.pullRequest,
        candidate.files,
        repository,
        candidate,
        { requireApproval: false },
      );
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
  const includeMeasured = process.env.FORCE === 'true';
  // Do not let an older PR that still needs approval starve a newer approved
  // PR. Run the oldest approved candidate first; only use the oldest
  // unapproved candidate for an approval notification when no work can run.
  const approvedCandidate = selectModelCandidate(
    candidates,
    repository,
    includeMeasured,
  );
  const candidate =
    approvedCandidate ??
    selectModelNotificationCandidate(candidates, repository, includeMeasured);
  if (!candidate) {
    writeOutput('has-candidate', 'false');
    writeOutput('should-run', 'false');
    writeOutput('pairs', '[]');
    console.log('No unmeasured RoboEve model-registration PR found');
    return;
  }

  writeOutput('has-candidate', 'true');
  writeOutput('pr-number', candidate.number);
  writeOutput('head-ref', candidate.headRef);
  writeOutput('head-sha', candidate.headSha);
  writeOutput('pairs', JSON.stringify(candidate.pairs));
  writeOutput(
    'approval-needed',
    hasRequiredModelApprovals(candidate.approvedBy) ? 'false' : 'true',
  );

  if (!approvedCandidate) {
    writeOutput('should-run', 'false');
    console.log(
      `PR #${candidate.number} needs two approving reviews for ${candidate.headSha}`,
    );
    return;
  }

  console.log(
    `Measuring PR #${candidate.number} at ${candidate.headSha}, approved by ${candidate.approvedBy.join(', ')}`,
  );
  writeOutput('should-run', 'true');
}

interface Summary {
  totalRuns: number;
  passedRuns: number;
  valid?: boolean;
}

function readJson<T>(path: string): T | undefined {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function listDirectories(path: string, pattern = /^[^.]/) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * The runner's status check only compares fingerprints, so it accepts a 0%
 * result whose failure classification never ran, a batch marked invalid, or a
 * run without a transcript. Those are infrastructure gaps, not model signal.
 * Apply the release gate's validity rules to the newest batch of every eval
 * before accepting a matrix as complete.
 *
 * The runner also reuses any fresh batch with a pass, so a rejected result
 * would survive every recovery pass. With `remove`, the rejected eval result
 * is deleted so the next `eval:run` measures it again, as the release
 * workflow does for infrastructure attempts.
 */
export function findIncompleteResults(
  root: string,
  experiment: string,
  evalNames: readonly string[],
  options: { remove?: boolean } = {},
) {
  const problems: string[] = [];
  const experimentDir = join(root, 'results', experiment);
  const batches = listDirectories(experimentDir).sort().reverse();

  for (const evalName of evalNames) {
    const found = problems.length;
    const batch = batches.find((name) =>
      existsSync(join(experimentDir, name, evalName, 'summary.json')),
    );
    if (!batch) {
      problems.push(`${evalName}: no result`);
      continue;
    }
    const evalDir = join(experimentDir, batch, evalName);
    const summary = readJson<Summary>(join(evalDir, 'summary.json'));
    if (!summary) {
      problems.push(`${evalName}: invalid summary.json`);
      continue;
    }
    if (summary.valid === false) {
      problems.push(`${evalName}: summary is marked invalid`);
    }
    if (
      !Number.isInteger(summary.totalRuns) ||
      summary.totalRuns < 1 ||
      !Number.isInteger(summary.passedRuns) ||
      summary.passedRuns < 0 ||
      summary.passedRuns > summary.totalRuns
    ) {
      problems.push(`${evalName}: impossible run counts in summary.json`);
      continue;
    }
    if (summary.passedRuns === 0) {
      const classification = readJson<{ failureType?: string }>(
        join(evalDir, 'classification.json'),
      );
      if (!classification) {
        problems.push(`${evalName}: failure was never classified`);
      } else if (classification.failureType !== 'model') {
        problems.push(
          `${evalName}: ${classification.failureType} failure is not model signal`,
        );
      }
    }

    const runs = listDirectories(evalDir, /^run-\d+$/).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
    if (runs.length !== summary.totalRuns) {
      problems.push(
        `${evalName}: summary reports ${summary.totalRuns} run(s), found ${runs.length}`,
      );
    }
    for (const run of runs) {
      const runDir = join(evalDir, run);
      const result = readJson<{ status?: string; error?: string }>(
        join(runDir, 'result.json'),
      );
      if (!result) {
        problems.push(`${evalName}/${run}: missing or invalid result.json`);
        continue;
      }
      let evalOutput: string | undefined;
      try {
        evalOutput = readFileSync(join(runDir, 'outputs', 'eval.txt'), 'utf8');
      } catch {}
      const reason = findInvalidRunReason({
        result,
        hasTranscript:
          existsSync(join(runDir, 'transcript-raw.jsonl')) ||
          existsSync(join(runDir, 'transcript.json')),
        evalOutput,
      });
      if (reason) problems.push(`${evalName}/${run}: ${reason}`);
    }

    if (options.remove && problems.length > found) {
      rmSync(evalDir, { recursive: true, force: true });
      problems.push(`${evalName}: removed so the next recovery pass re-runs it`);
    }
  }
  return problems;
}

function validateResults(experiments: string[]) {
  if (experiments.length === 0) throw new Error('No experiments were provided');

  const evalNames = listDirectories('evals').sort();
  if (evalNames.length === 0) throw new Error('The eval suite is empty');

  const agentEval = resolve(
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'agent-eval.cmd' : 'agent-eval',
  );
  const status = JSON.parse(
    execFileSync(agentEval, ['status', '--json'], {
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
    for (const problem of findIncompleteResults('.', experiment, evalNames, {
      remove: true,
    })) {
      incomplete.push(`${experiment}/${problem}`);
    }
  }

  if (incomplete.length > 0) {
    throw new Error(`Incomplete model results:\n${incomplete.join('\n')}`);
  }
  console.log(`Complete results for ${experiments.join(', ')}`);
}

if (process.argv[1]?.endsWith('model-pr.ts')) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'discover') discover();
  else if (command === 'validate-results') validateResults(args);
  else if (command === 'probe-model-access') {
    if (args.length !== 1) {
      throw new Error(
        'Usage: model-pr.ts probe-model-access <base-experiment>',
      );
    }
    await probeModelAccess(args[0]);
  } else {
    throw new Error(
      'Usage: model-pr.ts discover | probe-model-access <base-experiment> | validate-results <experiment...>',
    );
  }
}
