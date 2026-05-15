import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveSkillSource } from '../src/resolve-skill.mjs';

test('resolves skill source from a given npm-root path', () => {
  const fakeRoot = join(tmpdir(), `sogni-resolve-${Date.now()}`);
  const pkgDir = join(fakeRoot, '@sogni-ai/sogni-creative-agent-skill');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'SKILL.md'), '# fixture');
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '2.3.0' }));
  const result = resolveSkillSource({ npmRoot: fakeRoot });
  assert.equal(result.srcDir, pkgDir);
  assert.equal(result.version, '2.3.0');
});

test('throws if SKILL.md missing in resolved path', () => {
  const fakeRoot = join(tmpdir(), `sogni-resolve-missing-${Date.now()}`);
  const pkgDir = join(fakeRoot, '@sogni-ai/sogni-creative-agent-skill');
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({ version: '2.3.0' }));
  assert.throws(() => resolveSkillSource({ npmRoot: fakeRoot }), /SKILL\.md not found/);
});
