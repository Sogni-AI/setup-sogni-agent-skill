import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SKILL_DIR_NAME = 'sogni-creative-agent-skill';
const MARKER = '.sogni-installed.json';

function readMarker(dir) {
  const p = join(dir, MARKER);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function detectClaudeCode() {
  const home = homedir();
  const path = join(home, '.claude');
  if (!existsSync(path)) {
    return { runtime: 'claude-code', status: 'not-found', path: null, installedVersion: null };
  }
  const skillDir = join(path, 'skills', SKILL_DIR_NAME);
  const marker = readMarker(skillDir);
  return {
    runtime: 'claude-code',
    status: 'available',
    path,
    skillDir,
    installedVersion: marker?.version ?? null,
  };
}

function detectCodexCli() {
  const home = homedir();
  const path = join(home, '.codex');
  if (!existsSync(path)) {
    return { runtime: 'codex-cli', status: 'not-found', path: null, installedVersion: null };
  }
  const skillDir = join(path, 'skills', SKILL_DIR_NAME);
  const marker = readMarker(skillDir);
  return {
    runtime: 'codex-cli',
    status: 'available',
    path,
    skillDir,
    installedVersion: marker?.version ?? null,
  };
}

function detectHermes() {
  const home = homedir();
  const path = join(home, '.hermes');
  if (!existsSync(path)) {
    return { runtime: 'hermes', status: 'not-found', path: null, installedVersion: null };
  }
  const skillsRoot = join(path, 'skills');
  let installedCategory = null;
  let installedVersion = null;
  let skillDir = null;
  if (existsSync(skillsRoot)) {
    for (const entry of readdirSync(skillsRoot)) {
      const candidate = join(skillsRoot, entry, SKILL_DIR_NAME);
      if (existsSync(candidate) && statSync(candidate).isDirectory()) {
        installedCategory = entry;
        skillDir = candidate;
        const marker = readMarker(candidate);
        installedVersion = marker?.version ?? null;
        break;
      }
    }
  }
  return {
    runtime: 'hermes',
    status: 'available',
    path,
    skillDir,
    installedCategory,
    installedVersion,
  };
}

function detectChatgptWeb() {
  return {
    runtime: 'chatgpt-web',
    status: 'available',
    path: null,
    skillDir: null,
    installedVersion: null,
  };
}

export function detectAll() {
  return [detectClaudeCode(), detectCodexCli(), detectHermes(), detectChatgptWeb()];
}
