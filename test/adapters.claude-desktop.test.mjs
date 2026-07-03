import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import adapter from '../src/adapters/claude-desktop.mjs';
import { withTempHome, FIXTURE_SKILL_SRC } from './helpers.mjs';

function desktopDir(home) {
  return join(home, 'Library', 'Application Support', 'Claude');
}

function configPathFor(home) {
  return join(desktopDir(home), 'claude_desktop_config.json');
}

function setupDesktop(home) {
  mkdirSync(desktopDir(home), { recursive: true });
}

// Copy the shared fixture into the per-test temp home and use the copy as srcDir.
// `node --test` runs test files in parallel processes, so mutating the committed
// FIXTURE_SKILL_SRC (adding/removing desktop-extension) could race with the other
// adapter test files and would also leave the fixture dir dirty in git. The copy
// isolates every mutation to this test's temp home (withTempHome cleans it up).
function setupSkillSrc(home) {
  const srcDir = join(home, 'skill-src');
  cpSync(FIXTURE_SKILL_SRC, srcDir, { recursive: true });
  return srcDir;
}

// The adapter validates that the skill package actually ships the server file.
function setupServerFile(srcDir) {
  const serverDir = join(srcDir, 'desktop-extension', 'server');
  mkdirSync(serverDir, { recursive: true });
  writeFileSync(join(serverDir, 'index.mjs'), '// stub server');
}

test('install writes a merged mcpServers entry', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  writeFileSync(configPathFor(home), JSON.stringify({ mcpServers: { other: { command: 'x' } }, theme: 'dark' }));

  const result = adapter.install({ srcDir, version: '3.7.0' });
  assert.equal(result.status, 'installed');

  const cfg = JSON.parse(readFileSync(configPathFor(home), 'utf8'));
  assert.equal(cfg.theme, 'dark');                       // untouched sibling keys
  assert.ok(cfg.mcpServers.other);                       // untouched sibling server
  const entry = cfg.mcpServers['sogni-creative-agent'];
  assert.equal(entry.command, process.execPath);         // absolute node — GUI PATH is minimal
  assert.deepEqual(entry.args, [join(srcDir, 'desktop-extension', 'server', 'index.mjs')]);
  assert.equal(entry.env.SOGNI_AGENT_PATH, join(srcDir, 'sogni-agent.mjs'));
  assert.equal(entry.env.SOGNI_SKILL_VERSION, '3.7.0');
});

test('install creates the config file when absent', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  const result = adapter.install({ srcDir, version: '3.7.0' });
  assert.equal(result.status, 'installed');
  assert.ok(existsSync(configPathFor(home)));
});

test('install is idempotent and reports upgrades', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  adapter.install({ srcDir, version: '3.7.0' });
  assert.equal(adapter.install({ srcDir, version: '3.7.0' }).status, 'up-to-date');
  const up = adapter.install({ srcDir, version: '3.8.0' });
  assert.equal(up.status, 'upgraded');
  assert.equal(up.previousVersion, '3.7.0');
});

test('install refuses to clobber invalid JSON', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  writeFileSync(configPathFor(home), '{broken');
  assert.throws(() => adapter.install({ srcDir, version: '3.7.0' }), /not valid JSON/);
  assert.equal(readFileSync(configPathFor(home), 'utf8'), '{broken'); // untouched
});

test('install fails clearly when the package lacks desktop-extension', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  rmSync(join(srcDir, 'desktop-extension'), { recursive: true, force: true });
  assert.throws(() => adapter.install({ srcDir, version: '3.7.0' }), /3\.7\.0/);
});

test('uninstall removes only our entry', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  writeFileSync(configPathFor(home), JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  adapter.install({ srcDir, version: '3.7.0' });
  const result = adapter.uninstall();
  assert.equal(result.removed.length, 1);
  const cfg = JSON.parse(readFileSync(configPathFor(home), 'utf8'));
  assert.ok(cfg.mcpServers.other);
  assert.equal('sogni-creative-agent' in cfg.mcpServers, false);
});

test('dryRun writes nothing', (t) => {
  const home = withTempHome(t);
  setupDesktop(home);
  const srcDir = setupSkillSrc(home);
  setupServerFile(srcDir);
  const result = adapter.install({ srcDir, version: '3.7.0', dryRun: true });
  assert.equal(result.status, 'would-install');
  assert.equal(existsSync(configPathFor(home)), false);
});
