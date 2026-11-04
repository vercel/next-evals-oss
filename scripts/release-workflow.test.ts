import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL(
  '../.github/workflows/release-evals.yml',
  import.meta.url,
);
const notificationSchemaPath = new URL(
  '../apps/release-agent/agent/lib/release-notification.ts',
  import.meta.url,
);

test('release scoring and confirmations both load the Sandbox refresh hook', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  for (const step of ['Run published evals against the release package', 'Confirm first-attempt model failures']) {
    const body = workflow.split(`- name: ${step}\n`)[1].split('\n      - name:')[0];
    assert.match(body, /NODE_OPTIONS: --import=\$\{\{ github\.workspace \}\}\/scripts\/ci-sandbox-auth\.mjs/);
  }
});

test('release workflow syncs the same published suite as model registration', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /pnpm sync-evals "\$SUITE_REF"/);
  assert.equal((workflow.match(/pnpm sync-evals/g) ?? []).length, 1);
  assert.match(workflow, /SUITE_REF: \$\{\{ steps\.release\.outputs\.suite-ref \}\}/);
  assert.match(workflow, /RELEASE_BASELINE_ROOT: \$\{\{ github\.workspace \}\}\/measurements\/releases/);
  assert.doesNotMatch(workflow, /RELEASE_BASELINE_ROOT: .*measurement-repository/);
});

test('release automation is standalone and restricted to merged main', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /cron: "17 15 \* \* \*"/);
  assert.doesNotMatch(workflow, /cron: "43 7 \* \* \*"/);
  assert.match(
    workflow,
    /github\.event_name == 'workflow_dispatch' && 'manual' \|\| 'stable'/,
  );
  assert.match(
    workflow,
    /github\.ref == 'refs\/heads\/main'/,
  );
  assert.doesNotMatch(workflow, /workflow_call:/);
  assert.doesNotMatch(workflow, /create-github-app-token/);
  assert.doesNotMatch(workflow, /RELEASE_GITHUB_APP_PRIVATE_KEY/);
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /pnpm\/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6\.1\.0/);
});

test('release measurements are single-flight', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(
    workflow,
    /concurrency:\n(?:  #[^\n]*\n)*  group: next-release-evals\n  cancel-in-progress: false/,
  );
});

test('repository write access starts only after sanitization', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const [beforePublish, publish] = workflow.split('\n  publish:\n');
  assert.ok(beforePublish);
  assert.ok(publish);
  assert.doesNotMatch(beforePublish, /contents: write/);
  assert.match(beforePublish, /release-durable-measurement/);
  assert.match(publish, /contents: write/);
  assert.match(publish, /pull-requests: write/);
  assert.match(publish, /assert-no-secrets\.mjs/);
  assert.match(publish, /\$GITHUB_WORKSPACE\/scripts\/commit-results\.mjs/);
  assert.doesNotMatch(publish, /git commit|git push/);
});

test('result archive validation consumes the complete tar listing', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /tar -tzf .* \| sed -n '1p'/);
  assert.doesNotMatch(workflow, /tar -tzf .* \| head/);
});

test('the release agent accepts standalone workflow URLs', async () => {
  const schema = await readFile(notificationSchemaPath, 'utf8');
  assert.match(
    schema,
    /github\\\.com\\\/vercel\\\/next-evals-oss\\\/actions\\\/runs/,
  );
  assert.doesNotMatch(
    schema,
    /workflowUrl:[\s\S]*github\\\.com\\\/vercel\\\/next\\\.js\\\/actions\\\/runs/,
  );
});

test('release jobs use short-lived scoped credentials without a stored token', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  const intake = await readFile(
    new URL(
      '../apps/release-agent/agent/channels/release-intake.ts',
      import.meta.url,
    ),
    'utf8',
  );

  assert.doesNotMatch(workflow, /Install Vercel CLI/);
  assert.match(workflow, /RELEASE_WORKFLOW_OIDC_TOKEN/);
  assert.doesNotMatch(workflow, /\$VERCEL_OIDC_TOKEN/);
  assert.match(intake, /https:\/\/token\.actions\.githubusercontent\.com/);
  assert.match(intake, /repo:vercel\/next-evals-oss:ref:refs\/heads\/main/);
});


test('release artifacts preserve token and cost inputs through the report handoff', async (t) => {
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { readEvalEffort } = await import('./effort.js');
  const root = await mkdtemp(join(tmpdir(), 'release-usage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'sol/task/run-1'), { recursive: true });
  await mkdir(join(root, 'report'));
  await writeFile(join(root, 'sol/task/summary.json'), JSON.stringify({totalRuns:1,passedRuns:1}));
  await writeFile(join(root, 'sol/task/run-1/transcript-raw.jsonl'), JSON.stringify({type:'turn.completed', usage:{input_tokens:1000,cached_input_tokens:800,output_tokens:50}}));
  const workflow = await readFile(workflowPath, 'utf8');
  const archive = workflow.match(/find "\$EXPERIMENT"[^\n]+\n\s+\| tar[^\n]+/)?.[0];
  assert.ok(archive);
  execFileSync('bash', ['-c', archive], {cwd:root,env:{...process.env,EXPERIMENT:'sol',RUNNER_TEMP:root}});
  execFileSync('tar', ['-C', join(root,'report'), '-xzf', join(root,'sol.tar.gz')]);
  const effort = await readEvalEffort(join(root,'report/sol/task'),1,{input:1,output:2,cacheRead:0.1,cacheWrite:1.25});
  assert.equal(effort.tokenUsage.inputTokens,1000);
  assert.equal(effort.tokenUsage.measuredRuns,1);
  assert.equal(effort.costUsd,0.00038);
});
