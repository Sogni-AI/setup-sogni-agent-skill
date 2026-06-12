import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

test('upgrade reinstalls runtime deps when the previous install had node_modules', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0' });
  const skillDir = join(home, '.codex/skills/sogni-creative-agent-skill');
  // Simulate a previous install whose deps were bootstrapped (SKILL.md hook).
  mkdirSync(join(skillDir, 'node_modules'), { recursive: true });
  writeFileSync(join(skillDir, 'node_modules/.keep'), '');

  const spawnCalls = [];
  const result = adapter.install({
    srcDir: FIXTURE_SKILL_SRC,
    version: '2.3.0',
    spawnImpl: (cmd, args, opts) => { spawnCalls.push({ cmd, args, cwd: opts.cwd }); return { status: 0 }; },
  });

  assert.equal(result.status, 'upgraded');
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].cmd, 'npm');
  assert.equal(spawnCalls[0].args[0], 'install');
  assert.equal(spawnCalls[0].cwd, skillDir);
  assert.ok(existsSync(join(skillDir, 'package.json')), 'package.json bootstrapped from skill-package.json for npm install');
  assert.ok(result.notes.some(n => /Reinstalled local runtime dependencies/.test(n)), `expected reinstall note, got: ${result.notes}`);
});

test('upgrade without prior node_modules does not run npm install', (t) => {
  withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0' });
  const spawnCalls = [];
  const result = adapter.install({
    srcDir: FIXTURE_SKILL_SRC,
    version: '2.3.0',
    spawnImpl: (...args) => { spawnCalls.push(args); return { status: 0 }; },
  });
  assert.equal(result.status, 'upgraded');
  assert.equal(spawnCalls.length, 0, 'fresh dep-less installs stay dep-less by design');
});

test('failed dep reinstall degrades to a warning note, not a failed install', (t) => {
  const home = withTempHome(t);
  adapter.install({ srcDir: FIXTURE_SKILL_SRC, version: '2.2.0' });
  const skillDir = join(home, '.codex/skills/sogni-creative-agent-skill');
  mkdirSync(join(skillDir, 'node_modules'), { recursive: true });

  const result = adapter.install({
    srcDir: FIXTURE_SKILL_SRC,
    version: '2.3.0',
    spawnImpl: () => ({ status: 1 }),
  });
  assert.equal(result.status, 'upgraded');
  assert.ok(result.notes.some(n => /Could not reinstall/.test(n)), `expected warning note, got: ${result.notes}`);
});
