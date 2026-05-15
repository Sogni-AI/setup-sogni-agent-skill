import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeMarker, readMarker } from './shared.mjs';

const SKILL_NAME = 'sogni-creative-agent-skill';
const FILES_TO_COPY = ['SKILL.md', 'llm.txt', 'version.mjs', 'skill-package.json'];

function skillDir() {
  return join(homedir(), '.claude', 'skills', SKILL_NAME);
}

export default {
  name: 'claude-code',

  detect() {
    const claudePath = join(homedir(), '.claude');
    if (!existsSync(claudePath)) return { found: false, path: null, installedVersion: null };
    const marker = readMarker(skillDir());
    return { found: true, path: claudePath, installedVersion: marker?.version ?? null };
  },

  install({ srcDir, version, dryRun = false }) {
    const dir = skillDir();
    const written = [];
    const existing = readMarker(dir);
    if (existing?.version === version) {
      return { status: 'up-to-date', written: [], notes: [`Already at ${version}`] };
    }
    if (dryRun) return { status: 'would-install', written: [], notes: [`Would write to ${dir}`] };
    mkdirSync(dir, { recursive: true });
    for (const file of FILES_TO_COPY) {
      const from = join(srcDir, file);
      if (!existsSync(from)) continue;
      const to = join(dir, file);
      copyFileSync(from, to);
      written.push(to);
    }
    writeMarker(dir, { version, adapter: 'claude-code', srcDir });
    written.push(join(dir, '.sogni-installed.json'));
    return {
      status: existing ? 'upgraded' : 'installed',
      previousVersion: existing?.version ?? null,
      written,
      notes: [],
    };
  },

  uninstall() {
    const dir = skillDir();
    if (!existsSync(dir)) return { removed: [] };
    rmSync(dir, { recursive: true, force: true });
    return { removed: [dir] };
  },
};
