import {
  appendFile,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';

import { TIER_ONE_RELEASE_MATRIX } from '../lib/tier-one.js';

export interface ReleaseTarget {
  kind: 'release' | 'backport';
  version: string;
  ref: string;
  sha: string;
  sourceRunUrl: string;
  evaluatedAt: string;
}

const stableVersionPattern = /^\d+\.\d+\.\d+$/;
const shaPattern = /^[0-9a-f]{40}$/i;

export function validateReleaseTarget(input: ReleaseTarget): ReleaseTarget {
  const target = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value.trim()]),
  ) as unknown as ReleaseTarget;

  if (target.kind !== 'release' && target.kind !== 'backport') {
    throw new Error('releaseKind must be release or backport');
  }
  if (!stableVersionPattern.test(target.version)) {
    throw new Error(
      `nextVersion must be a stable exact version; received ${JSON.stringify(target.version)}`,
    );
  }
  if (target.ref !== `v${target.version}`) {
    throw new Error(
      `nextRef must be v${target.version}; received ${JSON.stringify(target.ref)}`,
    );
  }
  if (!shaPattern.test(target.sha)) {
    throw new Error('nextSha must be a full 40-character commit SHA');
  }
  if (!Number.isFinite(Date.parse(target.evaluatedAt))) {
    throw new Error('evaluatedAt must be an ISO timestamp');
  }

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(target.sourceRunUrl);
  } catch {
    throw new Error('sourceRunUrl must be a GitHub Actions run URL');
  }
  if (
    sourceUrl.protocol !== 'https:' ||
    sourceUrl.hostname !== 'github.com' ||
    !/^\/vercel\/next\.js\/actions\/runs\/\d+(?:\/.*)?$/.test(
      sourceUrl.pathname,
    )
  ) {
    throw new Error(
      'sourceRunUrl must point to a vercel/next.js GitHub Actions run',
    );
  }

  return target;
}

export function parseResultTimestamp(value: string): number {
  const normalized = value.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(\.\d+Z)$/,
    '$1T$2:$3:$4$5',
  );
  return Date.parse(normalized);
}

interface Summary {
  totalRuns: number;
  passedRuns: number;
  valid?: boolean;
}

interface RunResult {
  status?: string;
  error?: string;
}

const evaluatorStartupFailurePatterns = [
  /Startup Error/i,
  /failed to load config from .*vitest/i,
  /Cannot find (?:package|module) ['"]vitest\/config/i,
  /Cannot resolve (?:package|module) ['"]vitest\/config/i,
];

export function findInvalidRunReason(options: {
  result: RunResult;
  hasTranscript: boolean;
  evalOutput?: string;
}): string | undefined {
  if (!options.hasTranscript) return 'has no agent transcript';
  if (options.evalOutput === undefined) return 'has no evaluator output';
  if (/agent runner exited with code 143/i.test(options.result.error ?? '')) {
    return 'contains an agent runner exit 143';
  }
  if (
    evaluatorStartupFailurePatterns.some((pattern) =>
      pattern.test(options.evalOutput!),
    )
  ) {
    return 'contains an evaluator startup failure';
  }
  return undefined;
}

interface ScoreSnapshot {
  experiment: string;
  evalName: string;
  current: boolean;
  previous?: boolean;
}

function percentage(passed: number, total: number): number {
  return total === 0 ? 0 : Math.round((passed / total) * 1000) / 10;
}

export function formatReleaseSummary(options: {
  target: ReleaseTarget;
  prUrl: string;
  snapshots: ScoreSnapshot[];
}): string {
  const condition = (experiment: string) =>
    experiment.endsWith('--agents-md') ? 'with AGENTS.md' : 'without AGENTS.md';
  const scoreLine = (agentsMd: boolean) => {
    const current = options.snapshots.filter((snapshot) =>
      agentsMd
        ? snapshot.experiment.endsWith('--agents-md')
        : !snapshot.experiment.endsWith('--agents-md'),
    );
    const previous = current.filter(
      (snapshot) => snapshot.previous !== undefined,
    );
    const currentPassed = current.filter((snapshot) => snapshot.current).length;
    const previousPassed = previous.filter(
      (snapshot) => snapshot.previous,
    ).length;
    const delta =
      percentage(currentPassed, current.length) -
      percentage(previousPassed, previous.length);
    const deltaLabel =
      previous.length > 0
        ? ` (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pp)`
        : '';
    return `• ${agentsMd ? 'With' : 'Without'} AGENTS.md: ${currentPassed}/${current.length} passed (${percentage(currentPassed, current.length).toFixed(1)}%)${deltaLabel}`;
  };

  const changesByEval = new Map<string, string[]>();
  for (const snapshot of options.snapshots) {
    if (
      snapshot.previous === undefined ||
      snapshot.previous === snapshot.current
    )
      continue;
    const model = snapshot.experiment.replace(/--agents-md$/, '');
    const change = `${model} ${condition(snapshot.experiment)} ${snapshot.previous ? '✅' : '❌'}→${snapshot.current ? '✅' : '❌'}`;
    const changes = changesByEval.get(snapshot.evalName) ?? [];
    changes.push(change);
    changesByEval.set(snapshot.evalName, changes);
  }

  const changeLines = [...changesByEval]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([evalName, changes]) => `• ${evalName}: ${changes.sort().join('; ')}`,
    );
  const heading = `*Next.js ${options.target.ref} ${options.target.kind} evals — pass@1*`;
  const fixedLines = [
    heading,
    scoreLine(false),
    scoreLine(true),
    `*Changed task/agent results since their previous run (${changeLines.length} tasks):*`,
  ];

  const included: string[] = [];
  let omitted = 0;
  for (const line of changeLines) {
    const candidate = [
      ...fixedLines,
      ...included,
      line,
      `<${options.prUrl}|Review the results PR>`,
    ].join('\n');
    if (candidate.length > 3600) omitted++;
    else included.push(line);
  }
  if (changeLines.length === 0)
    included.push('• No task/agent result changed.');
  if (omitted > 0)
    included.push(`• …and ${omitted} more changed tasks in the PR.`);

  return [
    ...fixedLines,
    ...included,
    `<${options.prUrl}|Review the results PR>`,
  ].join('\n');
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

async function collectScoreSnapshots(options: {
  root: string;
  startedAt: string;
  experiments?: readonly string[];
}): Promise<ScoreSnapshot[]> {
  const startTime = Date.parse(options.startedAt);
  const experiments = options.experiments ?? TIER_ONE_RELEASE_MATRIX;
  const snapshots: ScoreSnapshot[] = [];

  for (const experiment of experiments) {
    const experimentDir = join(options.root, 'results', experiment);
    const batches = (await readdir(experimentDir, { withFileTypes: true }))
      .filter(
        (entry) =>
          entry.isDirectory() &&
          Number.isFinite(parseResultTimestamp(entry.name)),
      )
      .sort(
        (a, b) => parseResultTimestamp(b.name) - parseResultTimestamp(a.name),
      );
    const evalNames = new Set<string>();
    for (const batch of batches.filter(
      (entry) => parseResultTimestamp(entry.name) >= startTime,
    )) {
      const entries = await readdir(join(experimentDir, batch.name), {
        withFileTypes: true,
      });
      for (const entry of entries)
        if (entry.isDirectory()) evalNames.add(entry.name);
    }

    for (const evalName of evalNames) {
      let current: boolean | undefined;
      let previous: boolean | undefined;
      for (const batch of batches) {
        let summary: Summary;
        try {
          summary = JSON.parse(
            await readFile(
              join(experimentDir, batch.name, evalName, 'summary.json'),
              'utf8',
            ),
          ) as Summary;
        } catch {
          continue;
        }
        if (summary.valid === false) continue;
        const passed = summary.passedRuns > 0;
        if (
          parseResultTimestamp(batch.name) >= startTime &&
          current === undefined
        )
          current = passed;
        if (
          parseResultTimestamp(batch.name) < startTime &&
          previous === undefined
        )
          previous = passed;
      }
      if (current !== undefined)
        snapshots.push({ experiment, evalName, current, previous });
    }
  }

  return snapshots;
}

export async function validateReleaseResults(options: {
  root: string;
  startedAt: string;
  experiments?: readonly string[];
}): Promise<void> {
  const startTime = Date.parse(options.startedAt);
  if (!Number.isFinite(startTime))
    throw new Error('startedAt must be an ISO timestamp');

  const experiments = options.experiments ?? TIER_ONE_RELEASE_MATRIX;
  const evalNames = (
    await readdir(join(options.root, 'evals'), { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort();
  if (evalNames.length === 0)
    throw new Error('The canonical eval suite is empty');

  const problems: string[] = [];
  for (const experiment of experiments) {
    const experimentDir = join(options.root, 'results', experiment);
    const timestampEntries = await readdir(experimentDir, {
      withFileTypes: true,
    }).catch(() => []);
    const currentRuns = timestampEntries
      .filter(
        (entry) =>
          entry.isDirectory() && parseResultTimestamp(entry.name) >= startTime,
      )
      .sort(
        (a, b) => parseResultTimestamp(b.name) - parseResultTimestamp(a.name),
      );

    if (currentRuns.length === 0) {
      problems.push(`${experiment}: found no result batch from this workflow`);
      continue;
    }

    for (const evalName of evalNames) {
      let evalDir: string | undefined;
      for (const batch of currentRuns) {
        const candidate = join(experimentDir, batch.name, evalName);
        if (await exists(join(candidate, 'summary.json'))) {
          evalDir = candidate;
          break;
        }
      }
      if (!evalDir) {
        problems.push(
          `${experiment}/${evalName}: no result remained after infrastructure retries`,
        );
        continue;
      }

      let summary: Summary;
      try {
        summary = JSON.parse(
          await readFile(join(evalDir, 'summary.json'), 'utf8'),
        ) as Summary;
      } catch {
        problems.push(
          `${experiment}/${evalName}: missing or invalid summary.json`,
        );
        continue;
      }

      if (summary.valid === false) {
        problems.push(`${experiment}/${evalName}: summary is marked invalid`);
      }
      if (
        !Number.isInteger(summary.totalRuns) ||
        summary.totalRuns !== 1 ||
        !Number.isInteger(summary.passedRuns) ||
        summary.passedRuns < 0 ||
        summary.passedRuns > summary.totalRuns
      ) {
        problems.push(
          `${experiment}/${evalName}: impossible run counts in summary.json`,
        );
        continue;
      }

      const runEntries = (await readdir(evalDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory() && /^run-\d+$/.test(entry.name))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
      if (runEntries.length !== summary.totalRuns) {
        problems.push(
          `${experiment}/${evalName}: summary reports ${summary.totalRuns} run(s), found ${runEntries.length}`,
        );
      }

      for (const runEntry of runEntries) {
        const runDir = join(evalDir, runEntry.name);
        let result: RunResult;
        try {
          result = JSON.parse(
            await readFile(join(runDir, 'result.json'), 'utf8'),
          ) as RunResult;
        } catch {
          problems.push(
            `${experiment}/${evalName}/${runEntry.name}: missing or invalid result.json`,
          );
          continue;
        }

        const transcript =
          (await exists(join(runDir, 'transcript-raw.jsonl'))) ||
          (await exists(join(runDir, 'transcript.json')));
        const evalOutput = await readFile(
          join(runDir, 'outputs', 'eval.txt'),
          'utf8',
        ).catch(() => undefined);
        const invalidReason = findInvalidRunReason({
          result,
          hasTranscript: transcript,
          evalOutput,
        });
        if (invalidReason) {
          problems.push(
            `${experiment}/${evalName}/${runEntry.name}: ${invalidReason}`,
          );
        }
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Release results are not publishable:\n- ${problems.join('\n- ')}`,
    );
  }
}

async function writeOutput(name: string, value: string): Promise<void> {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  await appendFile(outputPath, `${name}=${value}\n`);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === 'prepare') {
    const evaluatedAt = new Date().toISOString();
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt,
    });
    const suiteRef = (await readFile('eval-suite-ref.txt', 'utf8')).trim();
    if (!shaPattern.test(suiteRef))
      throw new Error('eval-suite-ref.txt must contain a full commit SHA');

    await writeOutput('next-version', target.version);
    await writeOutput('release-kind', target.kind);
    await writeOutput('next-ref', target.ref);
    await writeOutput('next-sha', target.sha);
    await writeOutput('source-run-url', target.sourceRunUrl);
    await writeOutput('evaluated-at', target.evaluatedAt);
    await writeOutput('suite-ref', suiteRef);
    await writeOutput(
      'matrix',
      JSON.stringify({ experiment: TIER_ONE_RELEASE_MATRIX }),
    );
    return;
  }

  if (command === 'validate-results') {
    await validateReleaseResults({
      root: process.cwd(),
      startedAt: process.env.EVALUATED_AT ?? '',
    });
    console.log(
      `Validated ${TIER_ONE_RELEASE_MATRIX.length} complete experiment runs.`,
    );
    return;
  }

  if (command === 'write-target') {
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt: process.env.EVALUATED_AT ?? '',
    });
    await writeFile(
      'evaluation-target.json',
      `${JSON.stringify(target, null, 2)}\n`,
    );
    return;
  }

  if (command === 'slack-summary') {
    const target = validateReleaseTarget({
      kind: (process.env.RELEASE_KIND ?? '') as ReleaseTarget['kind'],
      version: process.env.NEXT_VERSION ?? '',
      ref: process.env.NEXT_REF ?? '',
      sha: process.env.NEXT_SHA ?? '',
      sourceRunUrl: process.env.SOURCE_RUN_URL ?? '',
      evaluatedAt: process.env.EVALUATED_AT ?? '',
    });
    const prUrl = process.env.PR_URL ?? '';
    if (
      !/^https:\/\/github\.com\/vercel\/next-evals-oss\/pull\/\d+$/.test(prUrl)
    ) {
      throw new Error(
        'PR_URL must point to a vercel/next-evals-oss pull request',
      );
    }
    const text = formatReleaseSummary({
      target,
      prUrl,
      snapshots: await collectScoreSnapshots({
        root: process.cwd(),
        startedAt: target.evaluatedAt,
      }),
    });
    await writeFile(
      process.env.SLACK_PAYLOAD_PATH ?? 'slack-summary.json',
      `${JSON.stringify({ text }, null, 2)}\n`,
    );
    console.log(text);
    return;
  }

  throw new Error(
    'Usage: release-automation.ts <prepare|validate-results|write-target|slack-summary>',
  );
}

if (process.argv[1]?.endsWith('release-automation.ts')) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
