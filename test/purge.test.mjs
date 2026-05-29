import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import prompts from 'prompts';
import { runPurge } from '../src/purge.mjs';
import { withTempHome } from './helpers.mjs';

function seedDataDir(home) {
  const dir = join(home, '.config', 'sogni');
  mkdirSync(join(dir, 'personas'), { recursive: true });
  writeFileSync(join(dir, 'personas', 'index.json'), '{}');
  writeFileSync(join(dir, 'personas', 'alice.json'), '{}');
  writeFileSync(join(dir, 'personas', 'bob.json'), '{}');
  writeFileSync(join(dir, 'memories.json'), '[]');
  writeFileSync(join(dir, 'personality.txt'), 'friendly');
  writeFileSync(join(dir, 'credentials'), 'SOGNI_API_KEY=sk-x\n');
  writeFileSync(join(dir, 'last-render.json'), '{}');
  return dir;
}

const FIXED = new Date(2026, 4, 29, 13, 5, 9); // 2026-05-29 13:05:09 local

test('backs up then deletes the data dir', async (t) => {
  const home = withTempHome(t);
  const dir = seedDataDir(home);
  const result = await runPurge({ yes: true, now: FIXED });
  assert.equal(result.status, 'purged');
  assert.equal(result.removed, dir);
  assert.equal(existsSync(dir), false);
  // backup tarball sits beside the removed dir, under ~/.config
  const backups = readdirSync(join(home, '.config')).filter(n => n.startsWith('sogni.backup-'));
  assert.equal(backups.length, 1);
  assert.equal(backups[0], 'sogni.backup-20260529-130509.tar.gz');
  assert.equal(result.backup, join(home, '.config', backups[0]));
});

test('no-op when data dir does not exist', async (t) => {
  withTempHome(t);
  const result = await runPurge({ yes: true, now: FIXED });
  assert.equal(result.status, 'skipped');
  assert.equal(result.removed, null);
});

test('dry-run writes nothing and reports would-purge', async (t) => {
  const home = withTempHome(t);
  const dir = seedDataDir(home);
  const result = await runPurge({ dryRun: true, yes: true, now: FIXED });
  assert.equal(result.status, 'would-purge');
  assert.equal(existsSync(dir), true); // still there
  const backups = readdirSync(join(home, '.config')).filter(n => n.startsWith('sogni.backup-'));
  assert.equal(backups.length, 0); // no tarball written
});

test('declined confirmation leaves data untouched', async (t) => {
  const home = withTempHome(t);
  const dir = seedDataDir(home);
  prompts.inject([false]);
  const result = await runPurge({ now: FIXED }); // yes defaults false → prompts
  assert.equal(result.status, 'cancelled');
  assert.equal(existsSync(dir), true);
});

test('--yes skips the prompt and deletes', async (t) => {
  const home = withTempHome(t);
  const dir = seedDataDir(home);
  // No prompts.inject — if runPurge tried to prompt, the test would hang/throw.
  const result = await runPurge({ yes: true, now: FIXED });
  assert.equal(result.status, 'purged');
  assert.equal(existsSync(dir), false);
});

test('backup failure aborts the delete', async (t) => {
  const home = withTempHome(t);
  const dir = seedDataDir(home);
  const failing = () => { throw new Error('tar boom'); };
  const result = await runPurge({ yes: true, now: FIXED, backupFn: failing });
  assert.equal(result.status, 'failed');
  assert.equal(existsSync(dir), true); // data preserved
});

test('shared paths outside ~/.config/sogni are never touched', async (t) => {
  const home = withTempHome(t);
  seedDataDir(home);
  // Seed shared, non-Sogni-owned paths.
  mkdirSync(join(home, '.openclaw'), { recursive: true });
  writeFileSync(join(home, '.openclaw', 'openclaw.json'), '{"x":1}');
  mkdirSync(join(home, '.clawdbot', 'media', 'inbound'), { recursive: true });
  writeFileSync(join(home, '.clawdbot', 'media', 'inbound', 'pic.png'), 'data');
  await runPurge({ yes: true, now: FIXED });
  assert.equal(existsSync(join(home, '.openclaw', 'openclaw.json')), true);
  assert.equal(existsSync(join(home, '.clawdbot', 'media', 'inbound', 'pic.png')), true);
});
