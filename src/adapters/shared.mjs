import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER_NAME = '.sogni-installed.json';

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
