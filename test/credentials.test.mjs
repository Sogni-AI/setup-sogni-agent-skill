import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prompts from 'prompts';
import { ensureCredentials } from '../src/credentials.mjs';
import { withTempHome } from './helpers.mjs';

test('skips when SOGNI_API_KEY env is set', async (t) => {
  withTempHome(t);
  const prev = process.env.SOGNI_API_KEY;
  process.env.SOGNI_API_KEY = 'sk-env';
  t.after(() => { process.env.SOGNI_API_KEY = prev; });
  const result = await ensureCredentials();
  assert.equal(result.action, 'skipped-env');
});

test('skips when credentials file already has SOGNI_API_KEY', async (t) => {
  const home = withTempHome(t);
  const prev = process.env.SOGNI_API_KEY;
  delete process.env.SOGNI_API_KEY;
  t.after(() => { if (prev !== undefined) process.env.SOGNI_API_KEY = prev; });
  mkdirSync(join(home, '.config/sogni'), { recursive: true });
  writeFileSync(join(home, '.config/sogni/credentials'), 'SOGNI_API_KEY=sk-existing\n');
  const result = await ensureCredentials();
  assert.equal(result.action, 'skipped-file');
});

test('prompts and writes file with 0o600 when nothing set', async (t) => {
  const home = withTempHome(t);
  const prev = process.env.SOGNI_API_KEY;
  delete process.env.SOGNI_API_KEY;
  t.after(() => { if (prev !== undefined) process.env.SOGNI_API_KEY = prev; });
  prompts.inject(['sk-new-key']);
  const result = await ensureCredentials();
  const path = join(home, '.config/sogni/credentials');
  assert.ok(existsSync(path));
  assert.equal(readFileSync(path, 'utf8'), 'SOGNI_API_KEY=sk-new-key\n');
  // POSIX mode bits are not meaningful on Windows; skip the perm assertion there.
  if (process.platform !== 'win32') {
    assert.equal(statSync(path).mode & 0o777, 0o600);
  }
  assert.equal(result.action, 'written');
  assert.equal(result.path, path);
});

test('skip on empty input', async (t) => {
  withTempHome(t);
  const prev = process.env.SOGNI_API_KEY;
  delete process.env.SOGNI_API_KEY;
  t.after(() => { if (prev !== undefined) process.env.SOGNI_API_KEY = prev; });
  prompts.inject(['']);
  const result = await ensureCredentials();
  assert.equal(result.action, 'skipped-user');
});

test('honors skipPrompt option', async (t) => {
  withTempHome(t);
  const prev = process.env.SOGNI_API_KEY;
  delete process.env.SOGNI_API_KEY;
  t.after(() => { if (prev !== undefined) process.env.SOGNI_API_KEY = prev; });
  const result = await ensureCredentials({ skipPrompt: true });
  assert.equal(result.action, 'skipped-flag');
});
