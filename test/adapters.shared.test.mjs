import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync, writeFileSync as rawWrite } from 'node:fs';
import { join } from 'node:path';
import { writeMarker, readMarker, MARKER_NAME } from '../src/adapters/shared.mjs';
import { withTempHome } from './helpers.mjs';

test('writes and reads marker file', (t) => {
  const home = withTempHome(t);
  const dir = join(home, 'skill');
  mkdirSync(dir);
  writeMarker(dir, { version: '2.3.0', adapter: 'claude-code' });
  const m = readMarker(dir);
  assert.equal(m.version, '2.3.0');
  assert.equal(m.adapter, 'claude-code');
  assert.ok(m.installedAt);
});

test('readMarker returns null when missing', (t) => {
  const home = withTempHome(t);
  assert.equal(readMarker(home), null);
});

test('readMarker returns null on invalid JSON', (t) => {
  const home = withTempHome(t);
  const dir = join(home, 'skill');
  mkdirSync(dir);
  rawWrite(join(dir, MARKER_NAME), 'not json');
  assert.equal(readMarker(dir), null);
});
