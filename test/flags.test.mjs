import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../src/flags.mjs';

test('parses empty argv', () => {
  const flags = parseFlags([]);
  assert.equal(flags.yes, false);
  assert.equal(flags.dryRun, false);
  assert.equal(flags.uninstall, false);
  assert.equal(flags.removeCli, false);
  assert.equal(flags.symlink, false);
  assert.equal(flags.noCredentials, false);
  assert.equal(flags.version, 'latest');
  assert.equal(flags.hermesCategory, 'media');
  assert.deepEqual(flags.only, null);
  assert.deepEqual(flags.exclude, null);
  assert.equal(flags.outputChatgptBundle, null);
});

test('parses --yes and -y', () => {
  assert.equal(parseFlags(['--yes']).yes, true);
  assert.equal(parseFlags(['-y']).yes, true);
});

test('parses --only as comma list', () => {
  assert.deepEqual(parseFlags(['--only=claude,codex']).only, ['claude', 'codex']);
});

test('parses --exclude as comma list', () => {
  assert.deepEqual(parseFlags(['--exclude=chatgpt']).exclude, ['chatgpt']);
});

test('parses --version=X.Y.Z', () => {
  assert.equal(parseFlags(['--version=2.3.0']).version, '2.3.0');
});

test('parses --hermes-category=', () => {
  assert.equal(parseFlags(['--hermes-category=creative']).hermesCategory, 'creative');
});

test('parses --output-chatgpt-bundle=path', () => {
  assert.equal(parseFlags(['--output-chatgpt-bundle=/tmp/x.md']).outputChatgptBundle, '/tmp/x.md');
});

test('parses --dry-run, --uninstall, --remove-cli, --symlink, --no-credentials', () => {
  const f = parseFlags(['--dry-run', '--uninstall', '--remove-cli', '--symlink', '--no-credentials']);
  assert.equal(f.dryRun, true);
  assert.equal(f.uninstall, true);
  assert.equal(f.removeCli, true);
  assert.equal(f.symlink, true);
  assert.equal(f.noCredentials, true);
});

test('rejects unknown flags', () => {
  assert.throws(() => parseFlags(['--bogus']), /Unknown flag/);
});

test('parses --purge', () => {
  assert.equal(parseFlags(['--purge']).purge, true);
});

test('--purge defaults to false', () => {
  assert.equal(parseFlags([]).purge, false);
});

test('parses --uninstall --remove-cli --purge together', () => {
  const f = parseFlags(['--uninstall', '--remove-cli', '--purge']);
  assert.equal(f.uninstall, true);
  assert.equal(f.removeCli, true);
  assert.equal(f.purge, true);
});
