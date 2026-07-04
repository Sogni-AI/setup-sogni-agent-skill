import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { detectAll, claudeDesktopConfigPath } from '../src/detect.mjs';
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

test('claudeDesktopConfigPath per platform', () => {
  assert.equal(
    claudeDesktopConfigPath({ platform: 'darwin', home: '/Users/x', env: {} }),
    '/Users/x/Library/Application Support/Claude/claude_desktop_config.json',
  );
  assert.equal(
    claudeDesktopConfigPath({ platform: 'win32', home: 'C:\\Users\\x', env: { APPDATA: 'C:\\Users\\x\\AppData\\Roaming' } }),
    join('C:\\Users\\x\\AppData\\Roaming', 'Claude', 'claude_desktop_config.json'),
  );
  assert.equal(
    claudeDesktopConfigPath({ platform: 'linux', home: '/home/x', env: {} }),
    '/home/x/.config/Claude/claude_desktop_config.json',
  );
});

test('detectAll reports claude-desktop not-found without the config dir', (t) => {
  withTempHome(t);
  const d = detectAll().find((r) => r.runtime === 'claude-desktop');
  assert.equal(d.status, 'not-found');
});

test('detectAll reports claude-desktop available with installed version', (t) => {
  withTempHome(t);
  // Same platform-aware path detectClaudeDesktop() reads; withTempHome has
  // redirected HOME/APPDATA so this resolves inside the sandbox on every CI leg.
  const dir = dirname(claudeDesktopConfigPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'claude_desktop_config.json'), JSON.stringify({
    mcpServers: { 'sogni-creative-agent': { command: 'node', args: [], env: { SOGNI_SKILL_VERSION: '3.7.0' } } },
  }));
  const d = detectAll().find((r) => r.runtime === 'claude-desktop');
  assert.equal(d.status, 'available');
  assert.equal(d.installedVersion, '3.7.0');
});
