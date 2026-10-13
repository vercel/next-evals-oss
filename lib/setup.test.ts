import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import type { Sandbox } from '@vercel/agent-eval';

import { getNextPackageSpec, installNext } from './setup.js';

const originalVersion = process.env.NEXT_EVAL_VERSION;

afterEach(() => {
  if (originalVersion === undefined) delete process.env.NEXT_EVAL_VERSION;
  else process.env.NEXT_EVAL_VERSION = originalVersion;
});

test('manual runs continue to install canary', () => {
  delete process.env.NEXT_EVAL_VERSION;
  assert.equal(getNextPackageSpec(), 'next@canary');
});

test('release runs require an exact npm version', () => {
  process.env.NEXT_EVAL_VERSION = '16.2.4';
  assert.equal(getNextPackageSpec(), 'next@16.2.4');

  process.env.NEXT_EVAL_VERSION = '^16.2.4';
  assert.throws(() => getNextPackageSpec(), /must be an exact npm version/);
});

test('release runs verify the installed package version', async () => {
  process.env.NEXT_EVAL_VERSION = '16.2.4';
  const commands: Array<[string, string[] | undefined]> = [];
  const sandbox = {
    async runCommand(command: string, args?: string[]) {
      commands.push([command, args]);
      if (command === 'npm') return { stdout: '', stderr: '', exitCode: 0 };
      return { stdout: '16.2.4\n', stderr: '', exitCode: 0 };
    },
  } as Sandbox;

  await installNext(sandbox);

  assert.deepEqual(commands[0], ['npm', ['install', 'next@16.2.4']]);
  assert.equal(commands[1]?.[0], 'node');
});

test('release runs stop when npm resolves a different version', async () => {
  process.env.NEXT_EVAL_VERSION = '16.2.4';
  const sandbox = {
    async runCommand(command: string) {
      if (command === 'npm') return { stdout: '', stderr: '', exitCode: 0 };
      return { stdout: '16.2.5\n', stderr: '', exitCode: 0 };
    },
  } as Sandbox;

  await assert.rejects(() => installNext(sandbox), /Expected next@16\.2\.4/);
});

test('manual runs preserve the previous install failure behavior', async () => {
  delete process.env.NEXT_EVAL_VERSION;
  const sandbox = {
    async runCommand() {
      return { stdout: '', stderr: 'registry unavailable', exitCode: 1 };
    },
  } as unknown as Sandbox;

  const result = await installNext(sandbox);
  assert.equal(result.exitCode, 1);
});
