import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { platform as osPlatform } from 'node:os';
import { dirname, join } from 'node:path';
import { claudeDesktopConfigPath } from '../detect.mjs';

const SERVER_KEY = 'sogni-creative-agent';

// Claude Desktop launches MCP servers from a GUI context with a minimal PATH,
// so the registered entry uses only absolute paths: the node binary running
// this installer, the server script inside the global package, and ffmpeg.
function resolveFfmpeg() {
  const cmd = osPlatform() === 'win32' ? 'where' : 'which';
  const r = spawnSync(cmd, ['ffmpeg'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/)[0].trim() || null;
}

function readConfig(configPath) {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    throw new Error(`${configPath} is not valid JSON — fix or remove it, then re-run.`);
  }
}

export default {
  name: 'claude-desktop',

  detect() {
    const configPath = claudeDesktopConfigPath();
    const dir = dirname(configPath);
    if (!existsSync(dir)) return { found: false, path: null, installedVersion: null };
    let installedVersion = null;
    try {
      const cfg = JSON.parse(readFileSync(configPath, 'utf8'));
      installedVersion = cfg?.mcpServers?.[SERVER_KEY]?.env?.SOGNI_SKILL_VERSION ?? null;
    } catch {
      // fall through — treat as no version installed
    }
    return { found: true, path: dir, installedVersion };
  },

  install({ srcDir, version, dryRun = false }) {
    const configPath = claudeDesktopConfigPath();
    const serverPath = join(srcDir, 'desktop-extension', 'server', 'index.mjs');
    if (!existsSync(serverPath)) {
      throw new Error(
        `Desktop extension server not found at ${serverPath} — ` +
        'upgrade @sogni-ai/sogni-creative-agent-skill to a version that ships desktop-extension/ (>= 3.7.0).',
      );
    }
    if (dryRun) {
      return { status: 'would-install', written: [], notes: [`Would register ${SERVER_KEY} in ${configPath}`] };
    }

    const config = readConfig(configPath);
    const existing = config.mcpServers?.[SERVER_KEY];
    const previousVersion = existing?.env?.SOGNI_SKILL_VERSION ?? null;

    const entry = {
      command: process.execPath,
      args: [serverPath],
      env: {
        SOGNI_AGENT_PATH: join(srcDir, 'sogni-agent.mjs'),
        SOGNI_SKILL_VERSION: version,
      },
    };
    const ffmpeg = resolveFfmpeg();
    if (ffmpeg) entry.env.FFMPEG_PATH = ffmpeg;

    if (existing && JSON.stringify(existing) === JSON.stringify(entry)) {
      return { status: 'up-to-date', written: [], notes: [`Already at ${version}`] };
    }

    config.mcpServers = { ...(config.mcpServers ?? {}), [SERVER_KEY]: entry };
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    return {
      status: existing ? 'upgraded' : 'installed',
      previousVersion,
      written: [configPath],
      notes: ['Fully quit and reopen Claude Desktop to load the Sogni tools.'],
    };
  },

  uninstall() {
    const configPath = claudeDesktopConfigPath();
    if (!existsSync(configPath)) return { removed: [] };
    let config;
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch {
      return { removed: [] }; // don't touch a broken file on uninstall
    }
    if (!config.mcpServers?.[SERVER_KEY]) return { removed: [] };
    delete config.mcpServers[SERVER_KEY];
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    return { removed: [configPath] };
  },
};
