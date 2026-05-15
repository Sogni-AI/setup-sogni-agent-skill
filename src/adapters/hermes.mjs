import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeMarker, readMarker } from './shared.mjs';

const SKILL_NAME = 'sogni-creative-agent-skill';

function hermesSkillsRoot() {
  return join(homedir(), '.hermes', 'skills');
}

function findExistingSkillDir() {
  const root = hermesSkillsRoot();
  if (!existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    const candidate = join(root, entry, SKILL_NAME);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return { dir: candidate, category: entry };
    }
  }
  return null;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export default {
  name: 'hermes',

  detect() {
    const hermesPath = join(homedir(), '.hermes');
    if (!existsSync(hermesPath)) return { found: false, path: null, installedVersion: null };
    const existing = findExistingSkillDir();
    const marker = existing ? readMarker(existing.dir) : null;
    return {
      found: true,
      path: hermesPath,
      installedVersion: marker?.version ?? null,
      installedCategory: existing?.category ?? null,
    };
  },

  install({ srcDir, version, category = 'media', dryRun = false }) {
    const existing = findExistingSkillDir();
    const targetCategory = existing?.category ?? category;
    const dir = join(hermesSkillsRoot(), targetCategory, SKILL_NAME);
    const existingMarker = readMarker(dir);

    if (existingMarker?.version === version) {
      return { status: 'up-to-date', written: [], notes: [`Already at ${version} in category "${targetCategory}"`] };
    }
    if (dryRun) return { status: 'would-install', written: [], notes: [`Would write to ${dir}`] };

    mkdirSync(dir, { recursive: true });
    const skillMdPath = join(dir, 'SKILL.md');

    // Backup existing SKILL.md before overwrite
    if (existsSync(skillMdPath)) {
      const backupName = `SKILL.md.bak-before-${version}-${timestamp()}`;
      renameSync(skillMdPath, join(dir, backupName));
    }

    const content = readFileSync(join(srcDir, 'SKILL.md'));
    writeFileSync(skillMdPath, content, { mode: 0o600 });

    writeMarker(dir, { version, adapter: 'hermes', srcDir });

    return {
      status: existingMarker ? 'upgraded' : 'installed',
      previousVersion: existingMarker?.version ?? null,
      written: [skillMdPath, join(dir, '.sogni-installed.json')],
      notes: [`Category: ${targetCategory}`],
    };
  },

  uninstall() {
    const existing = findExistingSkillDir();
    if (!existing) return { removed: [] };
    rmSync(existing.dir, { recursive: true, force: true });
    return { removed: [existing.dir] };
  },
};
