import { existsSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import prompts from 'prompts';
import kleur from 'kleur';

export function sogniDataDir() {
  return join(homedir(), '.config', 'sogni');
}

function timestamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

export function summarizeDataDir(dir) {
  const lines = [];
  const personasDir = join(dir, 'personas');
  if (existsSync(personasDir)) {
    const count = readdirSync(personasDir).filter((n) => n !== 'index.json').length;
    lines.push(`${count} persona${count === 1 ? '' : 's'}`);
  }
  for (const f of ['memories.json', 'personality.txt', 'credentials', 'last-render.json']) {
    if (existsSync(join(dir, f))) {
      lines.push(f === 'credentials' ? 'credentials (API key)' : f);
    }
  }
  if (lines.length === 0) lines.push('(empty)');
  return lines;
}

// Default backup implementation. Injectable via runPurge({ backupFn }) for tests.
function tarBackup(dir, dest) {
  const res = spawnSync('tar', ['-czf', dest, '-C', dirname(dir), basename(dir)], {
    stdio: 'ignore',
  });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`tar exited with status ${res.status}`);
}

export async function runPurge({
  yes = false,
  dryRun = false,
  now = new Date(),
  backupFn = tarBackup,
} = {}) {
  const dir = sogniDataDir();
  const backup = join(dirname(dir), `sogni.backup-${timestamp(now)}.tar.gz`);

  if (!existsSync(dir)) {
    console.log('Nothing to purge — ~/.config/sogni/ not found.');
    return { status: 'skipped', removed: null, backup: null };
  }

  console.log(kleur.bold('Will remove ~/.config/sogni/:'));
  for (const it of summarizeDataDir(dir)) console.log(`  - ${it}`);

  if (dryRun) {
    console.log(kleur.cyan(`Dry run — would back up to ${backup} and remove the directory.`));
    return { status: 'would-purge', removed: dir, backup };
  }

  if (!yes) {
    const { ok } = await prompts({
      type: 'confirm',
      name: 'ok',
      message: 'Permanently remove your Sogni data? A backup tarball will be written first.',
      initial: false,
    });
    if (ok !== true) {
      console.log('Purge cancelled — data left untouched.');
      return { status: 'cancelled', removed: null, backup: null };
    }
  }

  try {
    backupFn(dir, backup);
  } catch (err) {
    console.error(
      kleur.red(`Backup failed (${err.message}); aborting purge. Your data was NOT removed.`),
    );
    console.error('Back up ~/.config/sogni/ manually before retrying.');
    return { status: 'failed', removed: null, backup: null, error: err.message };
  }

  rmSync(dir, { recursive: true, force: true });
  console.log(`Backed up to ${backup}`);
  console.log(`Removed ${dir}`);
  return { status: 'purged', removed: dir, backup };
}
