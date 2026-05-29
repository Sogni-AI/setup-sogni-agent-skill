import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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
