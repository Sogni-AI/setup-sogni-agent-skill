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
