import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { validateReleaseTarget } from './release-automation.js';
import { measurementSource } from './replay-release-report.js';
test('report replay accepts only the pinned automated measurement branch', () => {
  const pr = { state: 'open', user: { login: 'github-actions[bot]' }, head: { ref: 'automation/measure-next-16.4.6-42843516470', sha: 'a'.repeat(40), repo: { full_name: 'vercel/next-evals-oss' } } };
  assert.equal(measurementSource(pr).destination, 'measurements/releases/16.4.6/42843516470');
  for (const change of [() => { pr.head.repo.full_name = 'fork/repo'; }, () => { pr.head.ref = 'main'; }, () => { pr.user.login = 'someone'; }, () => { pr.state = 'closed'; }]) {
    const saved = structuredClone(pr); change(); assert.throws(() => measurementSource(pr)); Object.assign(pr, saved);
  }
});


test('report replay accepts the retained target with nested comparison metadata', async () => {
  const data = JSON.parse(await readFile(new URL('../measurements/releases/16.4.5/41856939453/measurement.json', import.meta.url), 'utf8'));
  assert.equal(typeof data.metadata.evaluationTarget.comparisonInputs, 'object');
  const target = validateReleaseTarget(data.metadata.evaluationTarget);
  assert.equal(target.version, '16.4.5');
  assert.deepEqual(Object.keys(target).sort(), ['kind','version','ref','sha','sourceRunUrl','evaluatedAt'].sort());
});
