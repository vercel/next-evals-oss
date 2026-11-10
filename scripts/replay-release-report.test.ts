import assert from 'node:assert/strict';
import test from 'node:test';
import { measurementSource } from './replay-release-report.js';
test('report replay accepts only the pinned automated measurement branch', () => {
  const pr = { state: 'open', user: { login: 'github-actions[bot]' }, head: { ref: 'automation/measure-next-16.4.6-42843516470', sha: 'a'.repeat(40), repo: { full_name: 'vercel/next-evals-oss' } } };
  assert.equal(measurementSource(pr).destination, 'measurements/releases/16.4.6/42843516470');
  for (const change of [() => { pr.head.repo.full_name = 'fork/repo'; }, () => { pr.head.ref = 'main'; }, () => { pr.user.login = 'someone'; }, () => { pr.state = 'closed'; }]) {
    const saved = structuredClone(pr); change(); assert.throws(() => measurementSource(pr)); Object.assign(pr, saved);
  }
});
