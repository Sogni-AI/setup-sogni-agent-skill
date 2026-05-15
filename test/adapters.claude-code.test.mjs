import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import adapter from '../src/adapters/claude-code.mjs';
import { withTempHome, FIXTURE_SKILL_SRC } from './helpers.mjs';

test('install copies skill files into ~/.claude/skills/', (t) => {
  const home = withTempHome(t);
  const result = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const skillDir = join(home, '.claude/skills/sogni-creative-agent-skill');
  assert.ok(existsSync(join(skillDir, 'SKILL.md')));
  assert.ok(existsSync(join(skillDir, 'llm.txt')));
  assert.ok(existsSync(join(skillDir, 'version.mjs')));
  assert.ok(existsSync(join(skillDir, '.sogni-installed.json')));
  const marker = JSON.parse(readFileSync(join(skillDir, '.sogni-installed.json'), 'utf8'));
  assert.equal(marker.version, '2.3.0');
  assert.equal(marker.adapter, 'claude-code');
  assert.deepEqual(result.written.length > 0, true);
});

test('install is idempotent at same version', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const second = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  assert.equal(second.status, 'up-to-date');
});

test('install upgrades on version bump', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0' });
  const second = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  assert.equal(second.status, 'upgraded');
  assert.equal(second.previousVersion, '2.2.0');
});

test('uninstall removes skill dir and marker', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const result = adapter.uninstall();
  assert.equal(existsSync(join(home, '.claude/skills/sogni-creative-agent-skill')), false);
  assert.equal(result.removed.length > 0, true);
});

test('uninstall is a no-op when not installed', (t) => {
  withTempHome(t);
  const result = adapter.uninstall();
  assert.deepEqual(result.removed, []);
});

test('dryRun: no writes', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0', dryRun: true });
  assert.equal(existsSync(join(home, '.claude/skills/sogni-creative-agent-skill')), false);
});
