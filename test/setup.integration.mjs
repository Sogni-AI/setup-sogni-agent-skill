import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeFakeNpmRoot() {
  const root = mkdtempSync(join(tmpdir(), 'sogni-int-npm-'));
  const pkgDir = join(root, '@sogni-ai/sogni-creative-agent-skill');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'SKILL.md'), '# integration fixture\n');
  writeFileSync(join(pkgDir, 'llm.txt'), 'integration fixture\n');
  writeFileSync(join(pkgDir, 'version.mjs'), `export const VERSION = '2.3.0';\n`);
  writeFileSync(join(pkgDir, 'skill-package.json'), '{}\n');
  writeFileSync(join(pkgDir, 'env.mjs'), '\n');
  writeFileSync(join(pkgDir, 'ssrf-guard.mjs'), '\n');
  writeFileSync(join(pkgDir, 'sogni-agent.mjs'), '\n');
  writeFileSync(join(pkgDir, 'openclaw-plugin.mjs'), '\n');
  writeFileSync(join(pkgDir, 'openclaw.plugin.json'), '{}\n');
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '2.3.0' }));
  mkdirSync(join(pkgDir, 'scripts'), { recursive: true });
  mkdirSync(join(pkgDir, 'generated'), { recursive: true });
  writeFileSync(join(pkgDir, 'scripts/check-creative-agent-runtime.mjs'), '\n');
  writeFileSync(join(pkgDir, 'generated/creative-agent-runtime.mjs'), '\n');
  return root;
}

test('--dry-run prints detection table and writes nothing', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  mkdirSync(join(home, '.claude'));
  mkdirSync(join(home, '.codex'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const npmRoot = makeFakeNpmRoot();
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--dry-run', '--yes', '--no-credentials'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: 'skip',
      SOGNI_TEST_NPM_ROOT: npmRoot,
    },
    encoding: 'utf8',
  });

  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }

  assert.match(r.stdout, /Detected runtimes:/);
  assert.match(r.stdout, /Claude Code/);
  assert.match(r.stdout, /OpenAI Codex CLI/);
  assert.match(r.stdout, /Dry run/);
  // Nothing written
  assert.equal(existsSync(join(home, '.claude/skills/sogni-creative-agent-skill')), false);
  assert.equal(existsSync(join(home, '.codex/skills/sogni-creative-agent-skill')), false);
});

function runSetup(args, home, npmRoot) {
  return spawnSync(process.execPath, ['bin/setup.mjs', ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: 'skip',
      SOGNI_TEST_NPM_ROOT: npmRoot,
    },
    encoding: 'utf8',
  });
}

test('--help notes that local --only targets must already exist', () => {
  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(r.status, 0);
  assert.match(r.stdout, /--only=claude,codex,hermes,chatgpt/);
  assert.match(r.stdout, /Local targets must already have config dirs/);
});

test('flagless run does not dump ChatGPT instructions, prints a pointer instead', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const npmRoot = makeFakeNpmRoot();
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));

  const r = runSetup(['--yes', '--no-credentials'], home, npmRoot);
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  assert.doesNotMatch(r.stdout, /Custom GPT setup/, 'full instructions must not print without --only=chatgpt');
  assert.doesNotMatch(r.stdout, /instructions printed/, 'summary must not claim ChatGPT instructions were printed');
  assert.match(r.stdout, /--only=chatgpt/, 'pointer to the explicit ChatGPT path expected');
  assert.equal(existsSync(join(home, '.claude')), false, 'must not create Claude Code dirs when not detected');
  assert.equal(existsSync(join(home, '.codex')), false, 'must not create Codex dirs when not detected');
  assert.equal(existsSync(join(home, '.hermes')), false, 'must not create Hermes dirs when not detected');
});

test('--only=chatgpt prints the full Custom-GPT instructions', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const npmRoot = makeFakeNpmRoot();
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));

  const r = runSetup(['--yes', '--only=chatgpt'], home, npmRoot);
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  assert.match(r.stdout, /Custom GPT setup/, 'explicit request must print the instructions');
  assert.match(r.stdout, /instructions printed/, 'summary should reflect explicit ChatGPT output');
  assert.match(r.stdout, /not needed for ChatGPT Custom-GPT instructions/);
  assert.equal(existsSync(join(home, '.config/sogni/credentials')), false, 'ChatGPT-only setup must not write local credentials');
});

test('flagless run installs only detected local runtimes', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  mkdirSync(join(home, '.codex'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const npmRoot = makeFakeNpmRoot();
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));

  const r = runSetup(['--yes', '--no-credentials'], home, npmRoot);
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  assert.equal(existsSync(join(home, '.codex/skills/sogni-creative-agent-skill/SKILL.md')), true);
  assert.equal(existsSync(join(home, '.claude')), false, 'must not create Claude Code dirs when not detected');
  assert.equal(existsSync(join(home, '.hermes')), false, 'must not create Hermes dirs when not detected');
});

test('--only for a missing local runtime exits before global CLI install', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  const markerPath = join(binDir, 'npm-was-called');
  writeFileSync(join(binDir, 'npm'), `#!/bin/sh\necho called > "${markerPath}"\nexit 0\n`, { mode: 0o755 });

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--only=codex', '--yes'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      PATH: `${binDir}:${process.env.PATH}`,
    },
    encoding: 'utf8',
  });

  assert.equal(r.status, 1);
  assert.match(r.stdout, /No selected local agent runtimes found/);
  assert.equal(existsSync(markerPath), false, 'npm must not be invoked when the selected runtime is missing');
});

test('--dry-run skips the global CLI install entirely', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const npmRoot = makeFakeNpmRoot();
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));

  // Shim npm onto PATH: any invocation writes a marker. Dry run must not call it.
  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  const markerPath = join(binDir, 'npm-was-called');
  writeFileSync(join(binDir, 'npm'), `#!/bin/sh\necho called > "${markerPath}"\nexit 0\n`, { mode: 0o755 });

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--dry-run', '--yes', '--no-credentials'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: '', // make sure the env-var skip is NOT what saves us
      SOGNI_TEST_NPM_ROOT: npmRoot,
      PATH: `${binDir}:${process.env.PATH}`,
    },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  assert.match(r.stdout, /skipping global CLI install/);
  assert.equal(existsSync(markerPath), false, 'npm must not be invoked during --dry-run');
});

test('permission-denied global install suggests rerunning the full setup command with sudo', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  mkdirSync(join(home, '.codex'), { recursive: true });
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  writeFileSync(
    join(binDir, 'npm'),
    '#!/bin/sh\n' +
      'echo "npm error code EACCES" >&2\n' +
      'echo "npm error Error: EACCES: permission denied, mkdir \'/usr/local/lib/node_modules/@sogni-ai\'" >&2\n' +
      'exit 1\n',
    { mode: 0o755 }
  );

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--only=codex', '--version=2.3.0'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: '',
      PATH: `${binDir}:${process.env.PATH}`,
    },
    encoding: 'utf8',
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not install/);
  assert.match(r.stderr, /sudo npx setup-sogni-agent-skill --only=codex --version=2.3.0/);
  assert.match(r.stderr, /detect your agents and prompt for your Sogni API key in this same flow/);
  assert.equal(
    existsSync(join(home, '.codex/skills/sogni-creative-agent-skill')),
    false,
    'skill files must not be written when global install fails'
  );
});

test('--dry-run still works when the skill package is not installed yet', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  mkdirSync(join(home, '.claude'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  const emptyRoot = mkdtempSync(join(tmpdir(), 'sogni-int-empty-root-'));
  t.after(() => rmSync(emptyRoot, { recursive: true, force: true }));

  const r = runSetup(['--dry-run', '--yes', '--no-credentials'], home, emptyRoot);
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
  assert.match(r.stdout, /Detected runtimes:/);
  assert.match(r.stdout, /Dry run/);
});

test('--uninstall --remove-cli aborts before removing skill files when npm needs admin rights', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  const skillDir = join(home, '.codex/skills/sogni-creative-agent-skill');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, '.sogni-installed.json'), JSON.stringify({ version: '2.3.0' }));
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  writeFileSync(
    join(binDir, 'npm'),
    '#!/bin/sh\n' +
      'echo "npm error code EACCES" >&2\n' +
      'echo "npm error Error: EACCES: permission denied, unlink \'/usr/local/bin/sogni-agent\'" >&2\n' +
      'exit 1\n',
    { mode: 0o755 }
  );

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--uninstall', '--remove-cli', '--only=codex'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      PATH: `${binDir}:${process.env.PATH}`,
    },
    encoding: 'utf8',
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not remove the global CLI/);
  assert.match(r.stderr, /sudo npx setup-sogni-agent-skill --uninstall --remove-cli --only=codex/);
  assert.equal(existsSync(skillDir), true, 'skill files must remain when CLI removal fails first');
});
