import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeMarker, readMarker } from './shared.mjs';

const SKILL_NAME = 'sogni-creative-agent-skill';

// Mirrors the main package.json `files` whitelist (minus README/LICENSE which Codex doesn't need).
const ENTRIES_TO_COPY = [
  'SKILL.md',
  'llm.txt',
  'version.mjs',
  'skill-package.json',
  'env.mjs',
  'ssrf-guard.mjs',
  'sogni-agent.mjs',
  'openclaw-plugin.mjs',
  'openclaw.plugin.json',
  'scripts',
  'generated',
];

function skillDir() {
  return join(homedir(), '.codex', 'skills', SKILL_NAME);
}

export default {
  name: 'codex-cli',

  detect() {
    const codexPath = join(homedir(), '.codex');
    if (!existsSync(codexPath)) return { found: false, path: null, installedVersion: null };
    const marker = readMarker(skillDir());
    return { found: true, path: codexPath, installedVersion: marker?.version ?? null };
  },

  install({ srcDir, version, dryRun = false }) {
    const dir = skillDir();
    const existing = readMarker(dir);
    if (existing?.version === version) {
      return { status: 'up-to-date', written: [], notes: [`Already at ${version}`] };
    }
    if (dryRun) return { status: 'would-install', written: [], notes: [`Would write to ${dir}`] };

    // Wipe & recreate to ensure removed files don't linger from old versions.
    if (existing) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    const written = [];
    for (const entry of ENTRIES_TO_COPY) {
      const from = join(srcDir, entry);
      if (!existsSync(from)) continue;
      const to = join(dir, entry);
      cpSync(from, to, { recursive: true });
      written.push(to);
    }
    writeMarker(dir, { version, adapter: 'codex-cli', srcDir });
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
