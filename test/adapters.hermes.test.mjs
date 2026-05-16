import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import adapter from '../src/adapters/hermes.mjs';
import { withTempHome, FIXTURE_SKILL_SRC } from './helpers.mjs';

test('install writes SKILL.md only with 0o600 perms', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'media' });
  const skillDir = join(home, '.hermes/skills/media/sogni-creative-agent-skill');
  assert.ok(existsSync(join(skillDir, 'SKILL.md')));
  assert.equal(existsSync(join(skillDir, 'llm.txt')), false);
  // POSIX mode bits do not exist on Windows: fs.chmod cannot express
  // user/group/other separation, and statSync reports 0o666 for any writable
  // file regardless of what mode was requested. The install code still calls
  // chmod(0o600) on Windows (no-op), but the assertion is untestable there.
  if (process.platform !== 'win32') {
    const mode = statSync(join(skillDir, 'SKILL.md')).mode & 0o777;
    assert.equal(mode, 0o600);
  }
});

test('backs up existing SKILL.md before overwriting', (t) => {
  const home = withTempHome(t);
  // Pre-existing v2.2.0 install
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0', category: 'media' });
  const skillDir = join(home, '.hermes/skills/media/sogni-creative-agent-skill');
  writeFileSync(join(skillDir, 'SKILL.md'), '# v2.2.0 content', { mode: 0o600 });
  // Upgrade to v2.3.0
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'media' });
  const files = readdirSync(skillDir);
  const backup = files.find(f => f.startsWith('SKILL.md.bak-before-2.3.0-'));
  assert.ok(backup, `expected backup file, got: ${files.join(', ')}`);
  assert.equal(readFileSync(join(skillDir, backup), 'utf8'), '# v2.2.0 content');
});

test('reuses existing category instead of creating duplicate', (t) => {
  const home = withTempHome(t);
  // Existing install in "creative" category
  mkdirSync(join(home, '.hermes/skills/creative/sogni-creative-agent-skill'), { recursive: true });
  writeFileSync(join(home, '.hermes/skills/creative/sogni-creative-agent-skill/SKILL.md'), '# old');
  // Install with default category "media" — should detect & reuse "creative"
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'media' });
  assert.ok(existsSync(join(home, '.hermes/skills/creative/sogni-creative-agent-skill/SKILL.md')));
  assert.equal(existsSync(join(home, '.hermes/skills/media/sogni-creative-agent-skill/SKILL.md')), false);
});

test('idempotent at same version', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'media' });
  const second = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'media' });
  assert.equal(second.status, 'up-to-date');
});

test('uninstall removes skill dir from whichever category it was installed in', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', category: 'creative' });
  adapter.uninstall();
  assert.equal(existsSync(join(home, '.hermes/skills/creative/sogni-creative-agent-skill')), false);
});
