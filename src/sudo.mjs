import { spawnSync } from 'node:child_process';
import { userInfo } from 'node:os';

function parseId(value) {
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function sudoIdentity(env = process.env) {
  const user = env.SUDO_USER;
  const uid = parseId(env.SUDO_UID);
  const gid = parseId(env.SUDO_GID);
  if (!user || user === 'root' || uid === null || uid === 0 || gid === null) return null;
  return { user, uid, gid };
}

export function isSudoRoot({ env = process.env, getuid = process.getuid } = {}) {
  return typeof getuid === 'function' && getuid() === 0 && Boolean(sudoIdentity(env));
}

function currentRootHome() {
  try {
    return userInfo().homedir;
  } catch {
    return null;
  }
}

function normalizeHome(home) {
  if (!home) return null;
  const trimmed = String(home).trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '') || '/';
}

function isUsableUserHome(home, rootHome) {
  const normalized = normalizeHome(home);
  if (!normalized) return false;
  const rootHomes = new Set(['/root', '/var/root']);
  const normalizedRootHome = normalizeHome(rootHome);
  if (normalizedRootHome) rootHomes.add(normalizedRootHome);
  return !rootHomes.has(normalized);
}

function safeUserForShell(user) {
  return /^[A-Za-z0-9._-]+$/.test(user);
}

export function expandHomeForUser(user, { spawnImpl = spawnSync } = {}) {
  if (!safeUserForShell(user)) return null;
  const r = spawnImpl('sh', ['-c', `printf %s ~${user}`], { encoding: 'utf8' });
  if (r.error || r.status !== 0) return null;
  const home = String(r.stdout ?? '').trim();
  if (!home || home.startsWith('~')) return null;
  return home;
}

export function resolveSudoTargetHome({
  env = process.env,
  spawnImpl = spawnSync,
  rootHome = currentRootHome(),
} = {}) {
  const identity = sudoIdentity(env);
  if (!identity) return null;

  for (const candidate of [env.SUDO_HOME, env.HOME, env.USERPROFILE]) {
    if (isUsableUserHome(candidate, rootHome)) return candidate;
  }

  return expandHomeForUser(identity.user, { spawnImpl });
}

export function dropSudoPrivilegesForUser() {
  if (!isSudoRoot()) return { dropped: false };

  const identity = sudoIdentity();
  const home = resolveSudoTargetHome();
  if (!home) {
    throw new Error(
      'Running with sudo, but could not determine the original user home directory. ' +
      'Re-run without sudo after fixing npm permissions.'
    );
  }

  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.USER = identity.user;
  process.env.LOGNAME = identity.user;

  try {
    if (typeof process.initgroups === 'function') process.initgroups(identity.user, identity.gid);
    if (typeof process.setgid !== 'function' || typeof process.setuid !== 'function') {
      throw new Error('process.setgid/process.setuid are unavailable');
    }
    process.setgid(identity.gid);
    process.setuid(identity.uid);
  } catch (err) {
    throw new Error(
      `Installed the global CLI with sudo, but could not continue as ${identity.user}: ${err.message}. ` +
      'Re-run without sudo now that the CLI is installed.'
    );
  }

  return { dropped: true, ...identity, home };
}
