// test/helpers.mjs
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function withTempHome(t) {
  const home = mkdtempSync(join(tmpdir(), 'sogni-setup-test-'));
  const prevHome = process.env.HOME;
  const prevUserprofile = process.env.USERPROFILE;
  const prevAppdata = process.env.APPDATA;
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.APPDATA = join(home, 'AppData', 'Roaming');
  t.after(() => {
    process.env.HOME = prevHome;
    process.env.USERPROFILE = prevUserprofile;
    process.env.APPDATA = prevAppdata;
    rmSync(home, { recursive: true, force: true });
  });
  return home;
}

export const FIXTURE_SKILL_SRC = fileURLToPath(new URL('./fixtures/skill-src/', import.meta.url));
