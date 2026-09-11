import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatElevatedSetupCommand,
  formatSetupCommand,
  installCli,
  isPermissionError,
  npmInvocation,
  resolveLatestSkillVersion,
  SKILL_PACKAGE,
} from '../src/install-cli.mjs';

// Runs `body` (a Node script source) as the "npm" process, so the lookup's
// real spawn, capture and timeout logic is exercised without a registry.
function fakeNpm(t, body) {
  const dir = mkdtempSync(join(tmpdir(), 'sogni-fake-npm-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const script = join(dir, 'npm-cli.mjs');
  const argsFile = join(dir, 'args.json');
  writeFileSync(
    script,
    `import { writeFileSync } from 'node:fs';\n` +
      `writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));\n` +
      body
  );
  return {
    invocation: (args) => ({ command: process.execPath, args: [script, ...args] }),
    args: () => JSON.parse(readFileSync(argsFile, 'utf8')),
  };
}

test('isPermissionError matches EACCES output', () => {
  const sample = `npm error code EACCES
npm error syscall mkdir
npm error path /usr/local/lib/node_modules/@sogni-ai
npm error errno -13
npm error Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules/@sogni-ai'`;
  assert.equal(isPermissionError(sample), true);
});

test('isPermissionError matches EPERM output', () => {
  assert.equal(isPermissionError('npm error code EPERM'), true);
});

test('isPermissionError matches generic "Permission denied"', () => {
  assert.equal(isPermissionError('rm: /usr/local/bin/sogni-agent: Permission denied'), true);
});

test('isPermissionError returns false on unrelated errors', () => {
  assert.equal(isPermissionError('npm error code ETARGET\nnpm error notarget No matching version'), false);
});

test('isPermissionError returns false on empty input', () => {
  assert.equal(isPermissionError(''), false);
  assert.equal(isPermissionError(undefined), false);
  assert.equal(isPermissionError(null), false);
});

test('formatSetupCommand preserves flags when suggesting sudo rerun', () => {
  assert.equal(
    formatSetupCommand(['--only=codex', '--version=2.3.0'], { sudo: true }),
    'sudo npx setup-sogni-agent-skill --only=codex --version=2.3.0'
  );
});

test('formatSetupCommand shell-quotes unsafe flag values', () => {
  assert.equal(
    formatSetupCommand(['--output-chatgpt-bundle=/tmp/my bundle.txt'], { sudo: true }),
    "sudo npx setup-sogni-agent-skill '--output-chatgpt-bundle=/tmp/my bundle.txt'"
  );
});

test('formatElevatedSetupCommand uses Administrator-terminal style on Windows', () => {
  assert.equal(
    formatElevatedSetupCommand(['--only=codex'], { platform: 'win32' }),
    'npx setup-sogni-agent-skill --only=codex'
  );
  assert.equal(
    formatElevatedSetupCommand(['--only=codex'], { platform: 'darwin' }),
    'sudo npx setup-sogni-agent-skill --only=codex'
  );
});

test('npmInvocation keeps direct npm execution off Windows', () => {
  assert.deepEqual(
    npmInvocation(['install', '-g', 'example'], { platform: 'darwin' }),
    { command: 'npm', args: ['install', '-g', 'example'] }
  );
});

test('resolveLatestSkillVersion asks npm for the latest dist-tag and returns it', async (t) => {
  const npm = fakeNpm(t, `process.stdout.write('"3.43.0"\\n');\n`);
  const version = await resolveLatestSkillVersion({ invocation: npm.invocation });
  assert.equal(version, '3.43.0');
  assert.deepEqual(npm.args(), ['view', SKILL_PACKAGE, 'dist-tags.latest', '--json']);
});

test('resolveLatestSkillVersion fails with npm output when npm exits non-zero', async (t) => {
  const npm = fakeNpm(
    t,
    `console.error('npm error code ECONNREFUSED');\n` +
      `console.error('npm error FetchError: request to http://127.0.0.1:9/ failed');\n` +
      `process.exitCode = 1;\n`
  );
  await assert.rejects(
    resolveLatestSkillVersion({ invocation: npm.invocation }),
    (err) => {
      assert.match(err.message, /Could not look up the latest @sogni-ai\/sogni-creative-agent-skill release/);
      assert.match(err.message, /exited with code 1/);
      assert.match(err.message, /npm error code ECONNREFUSED/);
      assert.match(err.message, /no built-in fallback version/);
      assert.match(err.message, /--version=X\.Y\.Z/);
      return true;
    }
  );
});

test('resolveLatestSkillVersion rejects a dist-tag that is not valid semver', async (t) => {
  const npm = fakeNpm(t, `process.stdout.write('"banana"\\n');\n`);
  await assert.rejects(
    resolveLatestSkillVersion({ invocation: npm.invocation }),
    /`latest` dist-tag for @sogni-ai\/sogni-creative-agent-skill is "banana", which is not a valid semantic version/
  );
});

test('resolveLatestSkillVersion rejects empty output (no latest dist-tag)', async (t) => {
  const npm = fakeNpm(t, '');
  await assert.rejects(
    resolveLatestSkillVersion({ invocation: npm.invocation }),
    /npm returned no `latest` dist-tag/
  );
});

test('resolveLatestSkillVersion rejects output that is not JSON', async (t) => {
  const npm = fakeNpm(t, `process.stdout.write('<html>captive portal</html>');\n`);
  await assert.rejects(
    resolveLatestSkillVersion({ invocation: npm.invocation }),
    /printed output that is not JSON/
  );
});

test('resolveLatestSkillVersion stops a lookup that exceeds the timeout', async (t) => {
  const npm = fakeNpm(t, `setTimeout(() => process.stdout.write('"3.43.0"'), 30000);\n`);
  const started = Date.now();
  await assert.rejects(
    resolveLatestSkillVersion({ invocation: npm.invocation, timeoutMs: 500 }),
    /did not finish within 0\.5 s and was stopped/
  );
  assert.ok(Date.now() - started < 10000, 'timed-out lookup must not wait for npm');
});

test('resolveLatestSkillVersion reports a missing npm', async () => {
  await assert.rejects(
    resolveLatestSkillVersion({
      invocation: (args) => ({ command: join(tmpdir(), 'definitely-missing-npm-binary'), args }),
    }),
    /npm not found on PATH/
  );
});

test('installCli requires an exact version instead of defaulting', async () => {
  await assert.rejects(installCli({}), /installCli needs an exact skill version, got undefined/);
  await assert.rejects(installCli({ version: 'latest' }), /got "latest"/);
});

test('npmInvocation runs npm CLI through Node on Windows', () => {
  const npmCli = 'C:\\node\\node_modules\\npm\\bin\\npm-cli.js';
  const node = 'C:\\node\\node.exe';
  assert.deepEqual(
    npmInvocation(['install', '-g', 'example'], {
      platform: 'win32',
      env: {
        npm_execpath: npmCli,
        npm_node_execpath: node,
      },
      execPath: node,
      pathExists: candidate => candidate === npmCli || candidate === node,
    }),
    {
      command: node,
      args: [npmCli, 'install', '-g', 'example'],
    }
  );
});
