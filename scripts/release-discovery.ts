import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';

import type { ReleaseTarget } from './release-automation.js';

const stableVersionPattern = /^\d+\.\d+\.\d+$/;
const canaryVersionPattern = /^\d+\.\d+\.\d+-canary\.\d+$/;
const shaPattern = /^[0-9a-f]{40}$/;
const repository = 'vercel/next-evals-oss';
const nextRepository = 'vercel/next.js';
const releaseWorkflow = 'build_and_deploy.yml';

type DiscoveryMode = 'manual' | 'stable' | 'canary';

interface MonitorConfig {
  stablePublishedAfter: string;
}

interface WorkflowRun {
  conclusion: string | null;
  event: string;
  head_branch: string;
  head_sha: string;
  html_url: string;
}

interface GitReference {
  object: {
    sha: string;
    type: 'commit' | 'tag';
  };
}

interface GitTag {
  object: {
    sha: string;
    type: 'commit' | 'tag';
  };
}

interface BranchAtCommit {
  name: string;
}

interface SearchResult {
  items: Array<{
    title: string;
  }>;
}

interface GithubClient {
  get<T>(path: string): Promise<T>;
}

export function selectScheduledVersions(options: {
  mode: Exclude<DiscoveryMode, 'manual'>;
  publishedAt: Record<string, string>;
  stablePublishedAfter: string;
  canaryVersion: string;
}): string[] {
  if (options.mode === 'canary') {
    if (!canaryVersionPattern.test(options.canaryVersion)) {
      throw new Error('The npm canary dist-tag is not an exact canary version');
    }
    return [options.canaryVersion];
  }

  const threshold = Date.parse(options.stablePublishedAfter);
  if (!Number.isFinite(threshold)) {
    throw new Error('stablePublishedAfter must be an ISO timestamp');
  }

  return Object.entries(options.publishedAt)
    .filter(
      ([version, published]) =>
        stableVersionPattern.test(version) && Date.parse(published) > threshold,
    )
    .sort(([, left], [, right]) => Date.parse(left) - Date.parse(right))
    .map(([version]) => version);
}

export function classifyReleaseRuns(options: {
  version: string;
  sha: string;
  runs: WorkflowRun[];
  branchesAtSha?: string[];
}): Pick<ReleaseTarget, 'kind' | 'sourceRunUrl'> | undefined {
  const ref = `v${options.version}`;
  const successfulRuns = options.runs.filter(
    (run) =>
      run.event === 'push' &&
      run.conclusion === 'success' &&
      run.head_sha === options.sha,
  );
  const tagRun = successfulRuns.find((run) => run.head_branch === ref);
  if (!tagRun) return undefined;

  if (canaryVersionPattern.test(options.version)) {
    return { kind: 'canary', sourceRunUrl: tagRun.html_url };
  }

  const sourceBranches = [
    ...new Set(
      [
        ...successfulRuns.map((run) => run.head_branch),
        ...(options.branchesAtSha ?? []),
      ].filter(
        (branch) => branch === 'canary' || /^next-\d+-\d+$/.test(branch),
      ),
    ),
  ];
  const ltsBranches = [
    ...new Set(
      [
        ...successfulRuns.map((run) => run.head_branch),
        ...(options.branchesAtSha ?? []),
      ].filter(
        (branch) =>
          branch === 'releases/lts/active' ||
          branch === 'releases/lts/maintenance',
      ),
    ),
  ];

  const sourceBranch =
    sourceBranches.length === 1
      ? sourceBranches[0]
      : sourceBranches.length === 0 && ltsBranches.length === 1
        ? ltsBranches[0]
        : undefined;
  if (!sourceBranch) {
    throw new Error(
      `Could not identify one source branch for ${options.sha}; found: ${[
        ...sourceBranches,
        ...ltsBranches,
      ].join(', ') || 'none'}`,
    );
  }

  return {
    kind: sourceBranch === 'canary' ? 'release' : 'backport',
    sourceRunUrl: tagRun.html_url,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function npmJson<T>(args: string[]): T {
  return JSON.parse(execFileSync('npm', args, { encoding: 'utf8' })) as T;
}

function createGithubClient(token: string): GithubClient {
  return {
    async get<T>(path: string): Promise<T> {
      const response = await fetch(`https://api.github.com${path}`, {
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${token}`,
          'user-agent': 'next-evals-release-discovery',
          'x-github-api-version': '2022-11-28',
        },
      });
      if (!response.ok) {
        throw new Error(
          `GitHub request ${path} failed with status ${response.status}`,
        );
      }
      return (await response.json()) as T;
    },
  };
}

async function resolveTagSha(
  github: GithubClient,
  ref: string,
): Promise<string> {
  let object = (
    await github.get<GitReference>(
      `/repos/${nextRepository}/git/ref/tags/${encodeURIComponent(ref)}`,
    )
  ).object;
  for (let depth = 0; object.type === 'tag' && depth < 5; depth += 1) {
    object = (
      await github.get<GitTag>(
        `/repos/${nextRepository}/git/tags/${object.sha}`,
      )
    ).object;
  }
  if (object.type !== 'commit' || !shaPattern.test(object.sha)) {
    throw new Error(`${ref} does not resolve to one commit SHA`);
  }
  return object.sha;
}

async function hasMeasurement(
  github: GithubClient,
  version: string,
): Promise<boolean> {
  const query = encodeURIComponent(
    `repo:${repository} is:pr in:title "Record Next.js v${version} pass@1 measurement"`,
  );
  const { items } = await github.get<SearchResult>(
    `/search/issues?q=${query}&per_page=10`,
  );
  return items.some(
    (pull) => pull.title === `Record Next.js v${version} pass@1 measurement`,
  );
}

async function resolveTarget(
  github: GithubClient,
  version: string,
): Promise<Omit<ReleaseTarget, 'evaluatedAt'> | undefined> {
  const ref = `v${version}`;
  const sha = await resolveTagSha(github, ref);
  const query = new URLSearchParams({
    event: 'push',
    head_sha: sha,
    per_page: '100',
  });
  const { workflow_runs: runs } = await github.get<{
    workflow_runs: WorkflowRun[];
  }>(
    `/repos/${nextRepository}/actions/workflows/${releaseWorkflow}/runs?${query}`,
  );
  const branchesAtSha = await github.get<BranchAtCommit[]>(
    `/repos/${nextRepository}/commits/${sha}/branches-where-head`,
  );
  const provenance = classifyReleaseRuns({
    version,
    sha,
    runs,
    branchesAtSha: branchesAtSha.map((branch) => branch.name),
  });
  if (!provenance) return undefined;
  return { version, ref, sha, ...provenance };
}

async function writeOutput(name: string, value: string): Promise<void> {
  await appendFile(requiredEnv('GITHUB_OUTPUT'), `${name}=${value}\n`);
}

async function main(): Promise<void> {
  const mode = requiredEnv('DISCOVERY_MODE') as DiscoveryMode;
  if (!['manual', 'stable', 'canary'].includes(mode)) {
    throw new Error('DISCOVERY_MODE must be manual, stable, or canary');
  }

  const publishedAt = npmJson<Record<string, string>>([
    'view',
    'next',
    'time',
    '--json',
  ]);
  const requestedVersion = process.env.REQUESTED_VERSION?.trim() ?? '';
  let candidates: string[];

  if (mode === 'manual') {
    if (
      !stableVersionPattern.test(requestedVersion) &&
      !canaryVersionPattern.test(requestedVersion)
    ) {
      throw new Error('nextVersion must be an exact stable or canary version');
    }
    candidates = [requestedVersion];
  } else {
    const config = JSON.parse(
      await readFile('release-monitor.json', 'utf8'),
    ) as MonitorConfig;
    const canaryVersion =
      mode === 'canary'
        ? npmJson<string>(['view', 'next', 'dist-tags.canary', '--json'])
        : '';
    candidates = selectScheduledVersions({
      mode,
      publishedAt,
      stablePublishedAfter: config.stablePublishedAfter,
      canaryVersion,
    });
  }

  if (candidates.length === 0) {
    await writeOutput('should-run', 'false');
    console.log('No published Next.js version is ready for measurement.');
    return;
  }
  if (mode === 'manual' && !publishedAt[candidates[0]]) {
    throw new Error(`next@${requestedVersion} is not published`);
  }

  const github = createGithubClient(requiredEnv('GH_TOKEN'));
  const force = process.env.FORCE === 'true';
  let version: string | undefined;
  for (const candidate of candidates) {
    if (force || !(await hasMeasurement(github, candidate))) {
      version = candidate;
      break;
    }
  }
  if (!version) {
    await writeOutput('should-run', 'false');
    console.log(
      'Every discovered Next.js version already has a measurement PR.',
    );
    return;
  }

  const target = await resolveTarget(github, version);
  if (!target) {
    if (mode === 'manual') {
      throw new Error(
        `next@${version} is published, but its successful build-and-deploy tag run is not available`,
      );
    }
    await writeOutput('should-run', 'false');
    console.log(`Next.js v${version} is published but not ready for measurement.`);
    return;
  }

  await writeOutput('should-run', 'true');
  await writeOutput('release-kind', target.kind);
  await writeOutput('next-version', target.version);
  await writeOutput('next-ref', target.ref);
  await writeOutput('next-sha', target.sha);
  await writeOutput('source-run-url', target.sourceRunUrl);
  console.log(
    `Discovered Next.js v${target.version} (${target.kind}) at ${target.sha}.`,
  );
}

if (process.argv[1]?.endsWith('release-discovery.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
