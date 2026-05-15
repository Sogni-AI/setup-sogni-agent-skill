import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG = '@sogni-ai/sogni-creative-agent-skill';

export function resolveSkillSource({ npmRoot } = {}) {
  const root = npmRoot ?? execSync('npm root -g', { encoding: 'utf8' }).trim();
  const srcDir = join(root, PKG);
  const skillMd = join(srcDir, 'SKILL.md');
  if (!existsSync(skillMd)) {
    throw new Error(`SKILL.md not found at ${skillMd} — is ${PKG} installed globally?`);
  }
  const pkgJson = JSON.parse(readFileSync(join(srcDir, 'package.json'), 'utf8'));
  return { srcDir, version: pkgJson.version };
}
