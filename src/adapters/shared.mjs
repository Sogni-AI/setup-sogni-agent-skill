import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER_NAME = '.sogni-installed.json';
export const HOST_LAUNCHER_NAME = '.sogni-agent-launcher.mjs';
const HOST_LAUNCHER_DOC_MARKER = '<!-- setup-sogni-agent-skill:host-launcher -->';

const FRAMEWORKS = new Set(['codex', 'claude-code', 'hermes-agent']);
const SURFACES = new Set(['personal_skill']);

export function writeMarker(skillDir, { version, adapter, srcDir = null }) {
  const payload = {
    version,
    adapter,
    srcDir,
    installedAt: new Date().toISOString(),
  };
  writeFileSync(join(skillDir, MARKER_NAME), JSON.stringify(payload, null, 2), { mode: 0o644 });
}

export function readMarker(skillDir) {
  const p = join(skillDir, MARKER_NAME);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function validateHostAttribution({ framework, surface, version }) {
  if (!FRAMEWORKS.has(framework)) {
    throw new Error(`Unsupported Sogni agent framework marker: ${framework}`);
  }
  if (!SURFACES.has(surface)) {
    throw new Error(`Unsupported Sogni agent surface marker: ${surface}`);
  }
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(String(version ?? ''))) {
    throw new Error(`Invalid Sogni skill version for host launcher: ${version}`);
  }
}

export function writeHostLauncher(skillDir, {
  srcDir,
  version,
  framework,
  surface = 'personal_skill',
}) {
  validateHostAttribution({ framework, surface, version });
  const launcherPath = join(skillDir, HOST_LAUNCHER_NAME);
  const agentPath = join(srcDir, 'sogni-agent.mjs');
  if (!existsSync(agentPath)) {
    throw new Error(`Sogni agent CLI not found at ${agentPath}`);
  }
  const source = `#!/usr/bin/env node
import { spawn } from 'node:child_process';

const child = spawn(process.execPath, [${JSON.stringify(agentPath)}, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    SOGNI_AGENT_FRAMEWORK: ${JSON.stringify(framework)},
    SOGNI_AGENT_SURFACE: ${JSON.stringify(surface)},
    SOGNI_AGENT_SURFACE_VERSION: ${JSON.stringify(version)},
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    try { child.kill(signal); } catch { /* child already exited */ }
  });
}
child.once('error', (error) => {
  console.error(\`Could not launch sogni-agent: \${error.message}\`);
  process.exitCode = 1;
});
child.once('exit', (code) => {
  process.exitCode = Number.isInteger(code) ? code : 1;
});
`;
  writeFileSync(launcherPath, source, { mode: 0o700 });
  return launcherPath;
}

export function materializeSkillLauncher(skillMdPath, launcherPath) {
  const content = readFileSync(skillMdPath, 'utf8');
  if (content.includes(HOST_LAUNCHER_DOC_MARKER)) return;
  const launcherCommand = `node "${launcherPath.replaceAll('\\', '/')}"`;
  const block = [
    '',
    HOST_LAUNCHER_DOC_MARKER,
    '## Installed host command',
    '',
    `For every Sogni CLI command in this skill, invoke \`${launcherCommand}\`.`,
    `Wherever the documentation says \`sogni-agent\`, substitute \`${launcherCommand}\`.`,
    'This installer-owned launcher preserves the normal CLI behavior and adds',
    'the fixed agent framework/surface attribution for this host.',
    '',
  ].join('\n');

  let insertAt = 0;
  if (content.startsWith('---')) {
    const closing = content.indexOf('\n---', 3);
    if (closing !== -1) {
      const afterClosingLine = content.indexOf('\n', closing + 1);
      insertAt = afterClosingLine === -1 ? content.length : afterClosingLine + 1;
    }
  }
  const materialized = `${content.slice(0, insertAt)}${block}${content.slice(insertAt)}`;
  writeFileSync(skillMdPath, materialized, { mode: 0o600 });
}
