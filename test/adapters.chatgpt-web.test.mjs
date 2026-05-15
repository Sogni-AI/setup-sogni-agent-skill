import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import adapter from '../src/adapters/chatgpt-web.mjs';
import { FIXTURE_SKILL_SRC } from './helpers.mjs';

test('install returns instructions text without writing anything', () => {
  const result = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  assert.equal(result.status, 'instructions');
  assert.ok(result.instructions.includes('Custom GPT'));
  assert.ok(result.instructions.includes('sogni-creative-agent-skill'));
  assert.deepEqual(result.written, []);
});

test('install writes bundle file when outputBundle path is given', () => {
  const file = join(tmpdir(), `sogni-bundle-${Date.now()}.md`);
  const result = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', outputBundle: file });
  assert.ok(existsSync(file));
  assert.ok(readFileSync(file, 'utf8').includes('Custom GPT'));
  assert.deepEqual(result.written, [file]);
});

test('uninstall is a no-op', () => {
  assert.deepEqual(adapter.uninstall().removed, []);
});
