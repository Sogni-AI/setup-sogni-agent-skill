import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import prompts from 'prompts';

function credentialsPath() {
  return join(homedir(), '.config', 'sogni', 'credentials');
}

function existingKeyInFile() {
  const p = credentialsPath();
  if (!existsSync(p)) return false;
  return /^SOGNI_API_KEY=/m.test(readFileSync(p, 'utf8'));
}

export async function ensureCredentials({ skipPrompt = false } = {}) {
  if (skipPrompt) return { action: 'skipped-flag' };
  if (process.env.SOGNI_API_KEY) return { action: 'skipped-env' };
  if (existingKeyInFile()) return { action: 'skipped-file', path: credentialsPath() };

  const { key } = await prompts({
    type: 'password',
    name: 'key',
    message: 'Sogni API key (get one at https://dashboard.sogni.ai). Leave blank to skip.',
  });

  if (!key) return { action: 'skipped-user' };

  const path = credentialsPath();
  mkdirSync(join(homedir(), '.config', 'sogni'), { recursive: true });
  writeFileSync(path, `SOGNI_API_KEY=${key}\n`, { mode: 0o600 });
  return { action: 'written', path };
}
