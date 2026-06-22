import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatElevatedSetupCommand, formatSetupCommand, isPermissionError } from '../src/install-cli.mjs';

test('isPermissionError matches EACCES output', () => {
  const sample = `npm error code EACCES
npm error syscall mkdir
npm error path /usr/local/lib/node_modules/@sogni-ai
npm error errno -13
npm error Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@sogni-ai'`;
  assert.equal(isPermissionError(sample), true);
});

test('isPermissionError matches EPERM output', () => {
  assert.equal(isPermissionError('npm error code EPERM'), true);
});

test('isPermissionError matches generic "Permission denied"', () => {
  assert.equal(isPermissionError('rm: /usr/local/bin/sogni-agent: Permission denied'), true);
});

test('isPermissionError returns false on unrelated errors', () => {
  assert.equal(isPermissionError('npm error code ETARGET\nnpm error notarget No matching version'), false);
});

test('isPermissionError returns false on empty input', () => {
  assert.equal(isPermissionError(''), false);
  assert.equal(isPermissionError(undefined), false);
  assert.equal(isPermissionError(null), false);
});

test('formatSetupCommand preserves flags when suggesting sudo rerun', () => {
  assert.equal(
    formatSetupCommand(['--only=codex', '--version=2.3.0'], { sudo: true }),
    'sudo npx setup-sogni-agent-skill --only=codex --version=2.3.0'
  );
});

test('formatSetupCommand shell-quotes unsafe flag values', () => {
  assert.equal(
    formatSetupCommand(['--output-chatgpt-bundle=/tmp/my bundle.txt'], { sudo: true }),
    "sudo npx setup-sogni-agent-skill '--output-chatgpt-bundle=/tmp/my bundle.txt'"
  );
});

test('formatElevatedSetupCommand uses Administrator-terminal style on Windows', () => {
  assert.equal(
    formatElevatedSetupCommand(['--only=codex'], { platform: 'win32' }),
    'npx setup-sogni-agent-skill --only=codex'
  );
  assert.equal(
    formatElevatedSetupCommand(['--only=codex'], { platform: 'darwin' }),
    'sudo npx setup-sogni-agent-skill --only=codex'
  );
});
