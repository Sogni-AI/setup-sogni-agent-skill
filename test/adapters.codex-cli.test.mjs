import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import adapter from '../src/adapters/codex-cli.mjs';
import { withTempHome, FIXTURE_SKILL_SRC } from './helpers.mjs';

test('install copies full package layout into ~/.codex/skills/', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const skillDir = join(home, '.codex/skills/sogni-creative-agent-skill');
  for (const file of ['SKILL.md', 'llm.txt', 'version.mjs', 'skill-package.json', 'env.mjs', 'ssrf-guard.mjs', 'sogni-agent.mjs', 'openclaw-plugin.mjs', 'openclaw.plugin.json']) {
    assert.ok(existsSync(join(skillDir, file)), `expected ${file} to exist`);
  }
  assert.ok(existsSync(join(skillDir, 'scripts/check-creative-agent-runtime.mjs')));
  assert.ok(existsSync(join(skillDir, 'generated/creative-agent-runtime.mjs')));
  const marker = JSON.parse(readFileSync(join(skillDir, '.sogni-installed.json'), 'utf8'));
  assert.equal(marker.version, '2.3.0');
  assert.equal(marker.adapter, 'codex-cli');
});

test('install does not copy node_modules even if present in srcDir', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const skillDir = join(home, '.codex/skills/sogni-creative-agent-skill');
  assert.equal(existsSync(join(skillDir, 'node_modules')), false);
});

test('idempotent at same version', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  const second = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  assert.equal(second.status, 'up-to-date');
});

test('upgrade replaces files and bumps marker', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0' });
  const second = adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  assert.equal(second.status, 'upgraded');
});

test('uninstall removes skill dir', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.3.0' });
  adapter.uninstall();
  assert.equal(existsSync(join(home, '.codex/skills/sogni-creative-agent-skill')), false);
});
