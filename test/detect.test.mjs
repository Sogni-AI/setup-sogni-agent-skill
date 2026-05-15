import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectAll } from '../src/detect.mjs';
import { withTempHome } from './helpers.mjs';

test('detects Claude Code via ~/.claude/', (t) => {
  const home = withTempHome(t);
  mkdirSync(join(home, '.claude'));
  const result = detectAll();
  const claude = result.find(r => r.runtime === 'claude-code');
  assert.equal(claude.status, 'available');
  assert.equal(claude.path, join(home, '.claude'));
  assert.equal(claude.installedVersion, null);
});

test('detects Codex CLI via ~/.codex/', (t) => {
  const home = withTempHome(t);
  mkdirSync(join(home, '.codex'));
  const result = detectAll();
  const codex = result.find(r => r.runtime === 'codex-cli');
  assert.equal(codex.status, 'available');
  assert.equal(codex.installedVersion, null);
});

test('detects existing Codex skill install with marker', (t) => {
  const home = withTempHome(t);
  mkdirSync(join(home, '.codex/skills/sogni-creative-agent-skill'), { recursive: true });
  writeFileSync(
    join(home, '.codex/skills/sogni-creative-agent-skill/.sogni-installed.json'),
    JSON.stringify({ version: '2.1.0', installedAt: '2026-01-01', adapter: 'codex-cli' })
  );
  const result = detectAll();
  const codex = result.find(r => r.runtime === 'codex-cli');
  assert.equal(codex.installedVersion, '2.1.0');
});

test('detects Hermes Agent across categories', (t) => {
  const home = withTempHome(t);
  mkdirSync(join(home, '.hermes/skills/media/sogni-creative-agent-skill'), { recursive: true });
  writeFileSync(
    join(home, '.hermes/skills/media/sogni-creative-agent-skill/.sogni-installed.json'),
    JSON.stringify({ version: '2.2.0', adapter: 'hermes' })
  );
  const result = detectAll();
  const hermes = result.find(r => r.runtime === 'hermes');
  assert.equal(hermes.status, 'available');
  assert.equal(hermes.installedVersion, '2.2.0');
  assert.equal(hermes.installedCategory, 'media');
});

test('not-found when runtime dir missing', (t) => {
  withTempHome(t);
  const result = detectAll();
  for (const r of result.filter(r => r.runtime !== 'chatgpt-web')) {
    assert.equal(r.status, 'not-found');
  }
});

test('chatgpt-web always available', (t) => {
  withTempHome(t);
  const chatgpt = detectAll().find(r => r.runtime === 'chatgpt-web');
  assert.equal(chatgpt.status, 'available');
});
