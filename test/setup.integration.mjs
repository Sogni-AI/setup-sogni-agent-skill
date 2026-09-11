import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const PKG = '@sogni-ai/sogni-creative-agent-skill';
const VIEW_LATEST_ARGS = ['view', PKG, 'dist-tags.latest', '--json'];

function makeFakeNpmRoot(version = '2.3.0') {
  const root = mkdtempSync(join(tmpdir(), 'sogni-int-npm-'));
  const pkgDir = join(root, PKG);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'SKILL.md'), '# integration fixture\n');
  writeFileSync(join(pkgDir, 'llm.txt'), 'integration fixture\n');
  writeFileSync(join(pkgDir, 'version.mjs'), `export const VERSION = '${version}';\n`);
  writeFileSync(join(pkgDir, 'skill-package.json'), '{}\n');
  writeFileSync(join(pkgDir, 'env.mjs'), '\n');
  writeFileSync(join(pkgDir, 'ssrf-guard.mjs'), '\n');
  writeFileSync(join(pkgDir, 'sogni-agent.mjs'), '\n');
  writeFileSync(join(pkgDir, 'openclaw-plugin.mjs'), '\n');
  writeFileSync(join(pkgDir, 'openclaw.plugin.json'), '{}\n');
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version }));
  mkdirSync(join(pkgDir, 'scripts'), { recursive: true });
  mkdirSync(join(pkgDir, 'generated'), { recursive: true });
  writeFileSync(join(pkgDir, 'scripts/check-creative-agent-runtime.mjs'), '\n');
  writeFileSync(join(pkgDir, 'generated/creative-agent-runtime.mjs'), '\n');
  return root;
}

// A stand-in for npm that records every call's arguments and answers
// `npm view` with `viewStdout`. Every other command succeeds without doing
// anything. It is reached through PATH on macOS/Linux and through
// npm_execpath on Windows, the two routes npmInvocation() uses.
function writeNpmShim(binDir, { viewStdout = '"2.3.0"\n', viewStderr = '', viewExitCode = 0 } = {}) {
  const callsPath = join(binDir, 'npm-calls.jsonl');
  const npmExecPath = join(binDir, 'npm-cli.mjs');
  writeFileSync(
    npmExecPath,
    `import { appendFileSync } from 'node:fs';\n` +
      `const args = process.argv.slice(2);\n` +
      `appendFileSync(${JSON.stringify(callsPath)}, JSON.stringify(args) + '\\n');\n` +
      `if (args[0] === 'view') {\n` +
      `  process.stderr.write(${JSON.stringify(viewStderr)});\n` +
      `  process.stdout.write(${JSON.stringify(viewStdout)});\n` +
      `  process.exitCode = ${viewExitCode};\n` +
      `}\n`
  );
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'npm.cmd'), `@"${process.execPath}" "${npmExecPath}" %*\r\n`);
  } else {
    writeFileSync(
      join(binDir, 'npm'),
      `#!/bin/sh\nexec "${process.execPath}" "${npmExecPath}" "$@"\n`,
      { mode: 0o755 }
    );
  }
  return {
    npmExecPath,
    calls() {
      if (!existsSync(callsPath)) return [];
      return readFileSync(callsPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    },
  };
}

// Status words and versions can sit in different color spans.
const plain = (text) => text.replace(/\x1b\[[0-9;]*m/g, '');

function readMarkerVersion(skillDir) {
  return JSON.parse(readFileSync(join(skillDir, '.sogni-installed.json'), 'utf8')).version;
}

function writeFailingNpmShim(binDir, detail) {
  const npmExecPath = join(binDir, 'npm-cli.mjs');
  writeFileSync(
    npmExecPath,
    `console.error(${JSON.stringify('npm error code EACCES')});\n` +
      `console.error(${JSON.stringify(`npm error Error: EACCES: permission denied, ${detail}`)});\n` +
      'process.exitCode = 1;\n'
  );

  if (process.platform === 'win32') {
    writeFileSync(
      join(binDir, 'npm.cmd'),
      `@echo off\r\necho npm error code EACCES 1>&2\r\necho npm error Error: EACCES: permission denied, ${detail} 1>&2\r\nexit /b 1\r\n`
    );
    return npmExecPath;
  }

  writeFileSync(
    join(binDir, 'npm'),
    `#!/bin/sh\necho "npm error code EACCES" >&2\necho "npm error Error: EACCES: permission denied, ${detail}" >&2\nexit 1\n`,
    { mode: 0o755 }
  );
  return npmExecPath;
}

function withPathPrefix(env, binDir) {
  const pathEntry = Object.entries(env).find(([key]) => key.toLowerCase() === 'path');
  const normalized = Object.fromEntries(
    Object.entries(env).filter(([key]) => key.toLowerCase() !== 'path')
  );
  return {
    ...normalized,
    PATH: `${binDir}${delimiter}${pathEntry?.[1] ?? ''}`,
  };
}

// Runs setup against a temporary HOME, a fake global npm root, and the npm
// stand-in above. `installCli: 'skip'` keeps the global install out of the
// run; pass '' to let setup call `npm install -g` (answered by the stand-in).
function runSetup(t, args, { home, npmRoot, shim = {}, installCli = 'skip' }) {
  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  const npm = writeNpmShim(binDir, shim);
  const r = spawnSync(process.execPath, ['bin/setup.mjs', ...args], {
    cwd: process.cwd(),
    env: withPathPrefix({
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: installCli,
      SOGNI_TEST_NPM_ROOT: npmRoot,
      npm_execpath: npm.npmExecPath,
      npm_node_execpath: process.execPath,
    }, binDir),
    encoding: 'utf8',
  });
  return { r, npm };
}

function tempHome(t, runtimeDirs = []) {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  t.after(() => rmSync(home, { recursive: true, force: true }));
  for (const dir of runtimeDirs) mkdirSync(join(home, dir), { recursive: true });
  return home;
}

function fakeNpmRoot(t, version) {
  const npmRoot = makeFakeNpmRoot(version);
  t.after(() => rmSync(npmRoot, { recursive: true, force: true }));
  return npmRoot;
}

function assertExitZero(r) {
  if (r.status !== 0) {
    throw new Error(`exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  }
}

function seedInstalledSkill(skillDir, version) {
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, 'SKILL.md'), `# skill ${version}\n`);
  writeFileSync(join(skillDir, '.sogni-installed.json'), JSON.stringify({ version }));
}

const SKILL_DIRS = {
  claude: ['.claude', 'skills', 'sogni-creative-agent-skill'],
  codex: ['.codex', 'skills', 'sogni-creative-agent-skill'],
  hermes: ['.hermes', 'skills', 'media', 'sogni-creative-agent-skill'],
};

test('--dry-run prints detection table and writes nothing', (t) => {
  const home = tempHome(t, ['.claude', '.codex']);
  const npmRoot = fakeNpmRoot(t);

  const { r } = runSetup(t, ['--dry-run', '--yes', '--no-credentials'], { home, npmRoot });
  assertExitZero(r);

  assert.match(r.stdout, /Detected runtimes:/);
  assert.match(r.stdout, /Claude Code/);
  assert.match(r.stdout, /OpenAI Codex CLI/);
  assert.match(r.stdout, /Dry run/);
  // Nothing written
  assert.equal(existsSync(join(home, '.claude/skills/sogni-creative-agent-skill')), false);
  assert.equal(existsSync(join(home, '.codex/skills/sogni-creative-agent-skill')), false);
});

test('default install asks npm for the latest release, prints it, and records it in every runtime', (t) => {
  const home = tempHome(t, ['.claude', '.codex', '.hermes']);
  const npmRoot = fakeNpmRoot(t, '2.3.0');

  const { r, npm } = runSetup(t, ['--yes', '--no-credentials'], {
    home,
    npmRoot,
    shim: { viewStdout: '"2.3.0"\n' },
  });
  assertExitZero(r);

  assert.deepEqual(npm.calls()[0], VIEW_LATEST_ARGS);
  assert.match(r.stdout, /Looking up the latest @sogni-ai\/sogni-creative-agent-skill release on npm/);
  assert.match(r.stdout, /npm latest is 2\.3\.0/);
  assert.match(r.stdout, /Installing @sogni-ai\/sogni-creative-agent-skill@2\.3\.0 globally/);
  for (const parts of Object.values(SKILL_DIRS)) {
    const skillDir = join(home, ...parts);
    assert.equal(readMarkerVersion(skillDir), '2.3.0', parts.join('/'));
    const launcher = readFileSync(join(skillDir, '.sogni-agent-launcher.mjs'), 'utf8');
    assert.match(launcher, /SOGNI_AGENT_SURFACE_VERSION: "2\.3\.0"/);
  }
});

test('an older installed skill upgrades to the resolved latest in every runtime', (t) => {
  const home = tempHome(t);
  for (const parts of Object.values(SKILL_DIRS)) seedInstalledSkill(join(home, ...parts), '2.2.0');
  const npmRoot = fakeNpmRoot(t, '2.3.0');

  const { r } = runSetup(t, ['--yes', '--no-credentials'], { home, npmRoot });
  assertExitZero(r);

  const out = plain(r.stdout);
  assert.equal((out.match(/v2\.2\.0 → 2\.3\.0/g) ?? []).length, 3, out);
  assert.equal((out.match(/→ upgraded 2\.2\.0 → 2\.3\.0/g) ?? []).length, 3, out);
  for (const parts of Object.values(SKILL_DIRS)) {
    assert.equal(readMarkerVersion(join(home, ...parts)), '2.3.0', parts.join('/'));
  }
});

test('re-running when every runtime already has the latest release reports up-to-date', (t) => {
  const home = tempHome(t, ['.claude', '.codex', '.hermes']);
  const npmRoot = fakeNpmRoot(t, '2.3.0');

  assertExitZero(runSetup(t, ['--yes', '--no-credentials'], { home, npmRoot }).r);
  const markersBefore = Object.values(SKILL_DIRS).map((parts) =>
    readFileSync(join(home, ...parts, '.sogni-installed.json'), 'utf8'));

  const { r } = runSetup(t, ['--yes', '--no-credentials'], { home, npmRoot });
  assertExitZero(r);

  const out = plain(r.stdout);
  assert.equal((out.match(/v2\.3\.0 — up-to-date, will re-verify/g) ?? []).length, 3, out);
  assert.equal((out.match(/→ up-to-date/g) ?? []).length, 3, out);
  const markersAfter = Object.values(SKILL_DIRS).map((parts) =>
    readFileSync(join(home, ...parts, '.sogni-installed.json'), 'utf8'));
  assert.deepEqual(markersAfter, markersBefore, 'up-to-date runs must not rewrite markers');
});

test('a failed latest-version lookup stops setup before installing anything', (t) => {
  const home = tempHome(t, ['.claude', '.codex']);
  const npmRoot = fakeNpmRoot(t);

  const { r, npm } = runSetup(t, ['--yes', '--no-credentials'], {
    home,
    npmRoot,
    installCli: '',
    shim: {
      viewStdout: '',
      viewStderr: 'npm error code ECONNREFUSED\nnpm error FetchError: request to http://127.0.0.1:9/ failed\n',
      viewExitCode: 1,
    },
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /setup-sogni-agent-skill failed: Could not look up the latest @sogni-ai\/sogni-creative-agent-skill release/);
  assert.match(r.stderr, /npm error code ECONNREFUSED/);
  assert.match(r.stderr, /no built-in fallback version/);
  assert.deepEqual(npm.calls(), [VIEW_LATEST_ARGS], 'npm install -g must not run after a failed lookup');
  assert.equal(existsSync(join(home, '.claude/skills')), false);
  assert.equal(existsSync(join(home, '.codex/skills')), false);
});

test('a latest dist-tag that is not valid semver stops setup before installing anything', (t) => {
  const home = tempHome(t, ['.codex']);
  const npmRoot = fakeNpmRoot(t);

  const { r, npm } = runSetup(t, ['--yes', '--no-credentials'], {
    home,
    npmRoot,
    installCli: '',
    shim: { viewStdout: '"banana"\n' },
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /is "banana", which is not a valid semantic version/);
  assert.deepEqual(npm.calls(), [VIEW_LATEST_ARGS]);
  assert.equal(existsSync(join(home, '.codex/skills')), false);
});

test('an explicit --version installs that release without asking npm for latest', (t) => {
  const home = tempHome(t, ['.codex']);
  const npmRoot = fakeNpmRoot(t, '2.3.0');

  const { r, npm } = runSetup(t, ['--yes', '--no-credentials', '--version=2.3.0'], { home, npmRoot });
  assertExitZero(r);

  assert.match(r.stdout, /Using @sogni-ai\/sogni-creative-agent-skill@2\.3\.0 \(requested with --version\)/);
  assert.equal(npm.calls().some((args) => args[0] === 'view'), false, 'explicit versions skip the lookup');
  assert.equal(readMarkerVersion(join(home, ...SKILL_DIRS.codex)), '2.3.0');
});

test('setup stops when the global package is not the version it installed', (t) => {
  const home = tempHome(t, ['.codex']);
  const npmRoot = fakeNpmRoot(t, '2.3.0');

  // The stand-in "installs" 9.9.9 by exiting 0, but the global root still
  // holds 2.3.0 — as when `npm install -g` and `npm root -g` disagree.
  const { r, npm } = runSetup(t, ['--yes', '--no-credentials'], {
    home,
    npmRoot,
    installCli: '',
    shim: { viewStdout: '"9.9.9"\n' },
  });

  assert.equal(r.status, 1);
  assert.deepEqual(npm.calls(), [VIEW_LATEST_ARGS, ['install', '-g', `${PKG}@9.9.9`]]);
  assert.match(r.stderr, /Expected @sogni-ai\/sogni-creative-agent-skill@9\.9\.9 in the global npm folder, but .* contains 2\.3\.0/);
  assert.equal(existsSync(join(home, '.codex/skills')), false, 'no runtime may record a version that was not installed');
});

test('--help notes that local --only targets must already exist', () => {
  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(r.status, 0);
  assert.match(r.stdout, /--only=claude,desktop,codex,hermes,chatgpt/);
  assert.match(r.stdout, /Local targets must already have config dirs/);
});

test('--help says the default skill release is npm latest, looked up at run time', () => {
  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--help'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  assert.equal(r.status, 0);
  assert.match(r.stdout, /--version=X\.Y\.Z\s+Install this exact skill release/);
  assert.match(r.stdout, /default: the release npm tags latest/);
  assert.doesNotMatch(r.stdout, /default: \d+\.\d+\.\d+/);
});

test('flagless run does not dump ChatGPT instructions, prints a pointer instead', (t) => {
  const home = tempHome(t);
  const npmRoot = fakeNpmRoot(t);

  const { r } = runSetup(t, ['--yes', '--no-credentials'], { home, npmRoot });
  assertExitZero(r);
  assert.doesNotMatch(r.stdout, /Custom GPT setup/, 'full instructions must not print without --only=chatgpt');
  assert.doesNotMatch(r.stdout, /instructions printed/, 'summary must not claim ChatGPT instructions were printed');
  assert.match(r.stdout, /--only=chatgpt/, 'pointer to the explicit ChatGPT path expected');
  assert.equal(existsSync(join(home, '.claude')), false, 'must not create Claude Code dirs when not detected');
  assert.equal(existsSync(join(home, '.codex')), false, 'must not create Codex dirs when not detected');
  assert.equal(existsSync(join(home, '.hermes')), false, 'must not create Hermes dirs when not detected');
});

test('--only=chatgpt prints the full Custom-GPT instructions', (t) => {
  const home = tempHome(t);
  const npmRoot = fakeNpmRoot(t);

  const { r } = runSetup(t, ['--yes', '--only=chatgpt'], { home, npmRoot });
  assertExitZero(r);
  assert.match(r.stdout, /Custom GPT setup/, 'explicit request must print the instructions');
  assert.match(r.stdout, /instructions printed/, 'summary should reflect explicit ChatGPT output');
  assert.match(r.stdout, /not needed for ChatGPT Custom-GPT instructions/);
  assert.equal(existsSync(join(home, '.config/sogni/credentials')), false, 'ChatGPT-only setup must not write local credentials');
});

test('flagless run installs only detected local runtimes', (t) => {
  const home = tempHome(t, ['.codex']);
  const npmRoot = fakeNpmRoot(t);

  const { r } = runSetup(t, ['--yes', '--no-credentials'], { home, npmRoot });
  assertExitZero(r);
  assert.equal(existsSync(join(home, '.codex/skills/sogni-creative-agent-skill/SKILL.md')), true);
  assert.equal(existsSync(join(home, '.claude')), false, 'must not create Claude Code dirs when not detected');
  assert.equal(existsSync(join(home, '.hermes')), false, 'must not create Hermes dirs when not detected');
});

test('--only for a missing local runtime exits before the version lookup and global CLI install', (t) => {
  const home = tempHome(t);
  const npmRoot = fakeNpmRoot(t);

  const { r, npm } = runSetup(t, ['--only=codex', '--yes'], { home, npmRoot, installCli: '' });

  assert.equal(r.status, 1);
  assert.match(r.stdout, /No selected local agent runtimes found/);
  assert.deepEqual(npm.calls(), [], 'npm must not be invoked when the selected runtime is missing');
});

test('--dry-run looks up the version it would install but skips the global CLI install', (t) => {
  const home = tempHome(t);
  const npmRoot = fakeNpmRoot(t);

  const { r, npm } = runSetup(t, ['--dry-run', '--yes', '--no-credentials'], {
    home,
    npmRoot,
    // make sure the env-var skip is NOT what saves us
    installCli: '',
    shim: { viewStdout: '"2.4.0"\n' },
  });
  assertExitZero(r);
  assert.match(r.stdout, /skipping global CLI install \(would run: npm install -g @sogni-ai\/sogni-creative-agent-skill@2\.4\.0\)/);
  assert.deepEqual(npm.calls(), [VIEW_LATEST_ARGS], 'a dry run may only query the registry, never install');
});

test('--dry-run shows the upgrade a real run would make', (t) => {
  const home = tempHome(t);
  seedInstalledSkill(join(home, ...SKILL_DIRS.codex), '2.2.0');
  // The global package on disk is older than npm latest; the plan must show
  // the version a real run would install, not the one already on disk.
  const npmRoot = fakeNpmRoot(t, '2.2.0');

  const { r } = runSetup(t, ['--dry-run', '--yes', '--no-credentials'], {
    home,
    npmRoot,
    shim: { viewStdout: '"2.4.0"\n' },
  });
  assertExitZero(r);
  assert.match(r.stdout, /v2\.2\.0 → 2\.4\.0/);
  assert.equal(readMarkerVersion(join(home, ...SKILL_DIRS.codex)), '2.2.0', 'a dry run must not upgrade');
});

test('permission-denied global install suggests rerunning the full setup command with admin rights', (t) => {
  const home = mkdtempSync(join(tmpdir(), 'sogni-int-home-'));
  mkdirSync(join(home, '.codex'), { recursive: true });
  t.after(() => rmSync(home, { recursive: true, force: true }));

  const binDir = mkdtempSync(join(tmpdir(), 'sogni-int-bin-'));
  t.after(() => rmSync(binDir, { recursive: true, force: true }));
  const npmExecPath = writeFailingNpmShim(binDir, "mkdir '/usr/local/lib/node_modules/@sogni-ai'");

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--only=codex', '--version=2.3.0'], {
    cwd: process.cwd(),
    env: withPathPrefix({
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      INSTALL_CLI: '',
      npm_execpath: npmExecPath,
      npm_node_execpath: process.execPath,
    }, binDir),
    encoding: 'utf8',
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not install/);
  const elevatedPrefix = process.platform === 'win32' ? '' : 'sudo ';
  assert.ok(
    r.stderr.includes(`${elevatedPrefix}npx setup-sogni-agent-skill --only=codex --version=2.3.0`)
  );
  assert.match(r.stderr, /detect your agents and prompt for your Sogni API key in this same flow/);
  assert.equal(
    existsSync(join(home, '.codex/skills/sogni-creative-agent-skill')),
    false,
    'skill files must not be written when global install fails'
  );
});

test('--dry-run still works when the skill package is not installed yet', (t) => {
  const home = tempHome(t, ['.claude']);
  const emptyRoot = mkdtempSync(join(tmpdir(), 'sogni-int-empty-root-'));
  t.after(() => rmSync(emptyRoot, { recursive: true, force: true }));

  const { r } = runSetup(t, ['--dry-run', '--yes', '--no-credentials'], { home, npmRoot: emptyRoot });
  assertExitZero(r);
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
  const npmExecPath = writeFailingNpmShim(binDir, "unlink '/usr/local/bin/sogni-agent'");

  const r = spawnSync(process.execPath, ['bin/setup.mjs', '--uninstall', '--remove-cli', '--only=codex'], {
    cwd: process.cwd(),
    env: withPathPrefix({
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      npm_execpath: npmExecPath,
      npm_node_execpath: process.execPath,
    }, binDir),
    encoding: 'utf8',
  });

  assert.equal(r.status, 1);
  assert.match(r.stderr, /Could not remove the global CLI/);
  const elevatedPrefix = process.platform === 'win32' ? '' : 'sudo ';
  assert.ok(
    r.stderr.includes(
      `${elevatedPrefix}npx setup-sogni-agent-skill --uninstall --remove-cli --only=codex`
    )
  );
  assert.equal(existsSync(skillDir), true, 'skill files must remain when CLI removal fails first');
});
