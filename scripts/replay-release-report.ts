import { execFileSync } from 'node:child_process';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateReleaseTarget } from './release-automation.js';

const repository = 'vercel/next-evals-oss';
export function measurementSource(pr: { state: string; user: { login: string }; head: { ref: string; sha: string; repo: { full_name: string } } }) {
  const match = /^automation\/measure-next-(16\.\d+\.\d+(?:-canary\.\d+)?)-(\d+)$/.exec(pr.head.ref);
  if (pr.state !== 'open' || pr.user.login !== 'github-actions[bot]' ||
      pr.head.repo.full_name !== repository || !/^[a-f0-9]{40}$/.test(pr.head.sha) || !match)
    throw new Error('Expected an open automation-authored measurement PR in this repository');
  return { branch: pr.head.ref, head: pr.head.sha, version: match[1], run: match[2], destination: `measurements/releases/${match[1]}/${match[2]}` };
}

async function main() {
  const number = process.argv[2];
  if (!/^[1-9]\d*$/.test(number ?? '')) throw new Error('Usage: replay-release-report.ts <measurement-pr>');
  const api = (path: string) => JSON.parse(execFileSync('gh', ['api', path], { maxBuffer: 4 * 1024 * 1024 }).toString());
  const source = measurementSource(api(`repos/${repository}/pulls/${number}`));
  const directory = join(process.env.RUNNER_TEMP ?? '.local-report', 'release-report-replay');
  await mkdir(directory, { recursive: true });
  const files: Record<string, string> = {};
  for (const name of ['measurement.json', 'diagnostics.json']) {
    const data = api(`repos/${repository}/contents/${source.destination}/${name}?ref=${source.head}`);
    if (data.encoding !== 'base64' || data.type !== 'file' || data.size > 2 * 1024 * 1024)
      throw new Error('Invalid retained measurement file');
    files[name] = Buffer.from(data.content, 'base64').toString('utf8');
    await writeFile(join(directory, name), files[name]);
  }
  const target = validateReleaseTarget(JSON.parse(files['measurement.json']).metadata.evaluationTarget);
  if (target.version !== source.version) throw new Error('Measurement version differs from its branch');
  const env = {
    RELEASE_KIND: target.kind, NEXT_VERSION: target.version, NEXT_REF: target.ref,
    NEXT_SHA: target.sha, SOURCE_RUN_URL: target.sourceRunUrl, EVALUATED_AT: target.evaluatedAt,
    WORKFLOW_URL: `https://github.com/${repository}/actions/runs/${source.run}`,
    MEASUREMENT_URL: `https://github.com/${repository}/pull/${number}`,
    RELEASE_MEASUREMENT_PATH: join(directory, 'measurement.json'),
    RELEASE_DIAGNOSTICS_PATH: join(directory, 'diagnostics.json'),
    AGENT_PAYLOAD_PATH: join(directory, 'notification.json'),
  };
  if (!process.env.GITHUB_ENV || !process.env.GITHUB_OUTPUT) throw new Error('Run through the report-only workflow');
  await appendFile(process.env.GITHUB_ENV, Object.entries(env).map(([k, v]) => `${k}=${v}\n`).join(''));
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(source).map(([k, v]) => `${k}=${v}\n`).join(''));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
