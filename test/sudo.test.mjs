import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandHomeForUser,
  isSudoRoot,
  resolveSudoTargetHome,
  sudoIdentity,
} from '../src/sudo.mjs';

test('sudoIdentity reads the original sudo user ids', () => {
  assert.deepEqual(
    sudoIdentity({ SUDO_USER: 'alice', SUDO_UID: '501', SUDO_GID: '20' }),
    { user: 'alice', uid: 501, gid: 20 }
  );
});

test('sudoIdentity ignores root and malformed sudo identities', () => {
  assert.equal(sudoIdentity({ SUDO_USER: 'root', SUDO_UID: '0', SUDO_GID: '0' }), null);
  assert.equal(sudoIdentity({ SUDO_USER: 'alice', SUDO_UID: 'nope', SUDO_GID: '20' }), null);
  assert.equal(sudoIdentity({}), null);
});

test('isSudoRoot only matches root processes launched by sudo', () => {
  const env = { SUDO_USER: 'alice', SUDO_UID: '501', SUDO_GID: '20' };
  assert.equal(isSudoRoot({ env, getuid: () => 0 }), true);
  assert.equal(isSudoRoot({ env, getuid: () => 501 }), false);
  assert.equal(isSudoRoot({ env: {}, getuid: () => 0 }), false);
});

test('resolveSudoTargetHome keeps preserved non-root HOME', () => {
  const home = resolveSudoTargetHome({
    env: {
      SUDO_USER: 'alice',
      SUDO_UID: '501',
      SUDO_GID: '20',
      HOME: '/Users/alice',
    },
    rootHome: '/var/root',
  });
  assert.equal(home, '/Users/alice');
});

test('resolveSudoTargetHome expands sudo user when HOME points at root', () => {
  const home = resolveSudoTargetHome({
    env: {
      SUDO_USER: 'alice',
      SUDO_UID: '501',
      SUDO_GID: '20',
      HOME: '/var/root',
    },
    rootHome: '/var/root',
    spawnImpl: () => ({ status: 0, stdout: '/Users/alice' }),
  });
  assert.equal(home, '/Users/alice');
});

test('expandHomeForUser rejects unsafe usernames', () => {
  assert.equal(
    expandHomeForUser('alice;whoami', {
      spawnImpl: () => {
        throw new Error('must not spawn for unsafe usernames');
      },
    }),
    null
  );
});
