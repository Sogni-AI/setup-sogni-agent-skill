import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../src/flags.mjs';

test('parses empty argv', () => {
  const flags = parseFlags([]);
  assert.equal(flags.yes, false);
  assert.equal(flags.dryRun, false);
  assert.equal(flags.uninstall, false);
  assert.equal(flags.removeCli, false);
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

test('rejects invalid --only runtime names', () => {
  assert.throws(() => parseFlags(['--only=codez']), /Invalid runtime for --only: codez/);
});

test('rejects empty --only runtime list', () => {
  assert.throws(() => parseFlags(['--only=']), /--only must list at least one runtime/);
});

test('parses --exclude as comma list', () => {
  assert.deepEqual(parseFlags(['--exclude=chatgpt']).exclude, ['chatgpt']);
});

test('rejects invalid --exclude runtime names', () => {
  assert.throws(() => parseFlags(['--exclude=claude,openclaw']), /Invalid runtime for --exclude: openclaw/);
});

test('rejects filter combinations that select no runtimes', () => {
  assert.throws(
    () => parseFlags(['--only=codex', '--exclude=codex']),
    /No runtimes selected/
  );
  assert.throws(
    () => parseFlags(['--exclude=claude,desktop,codex,hermes,chatgpt']),
    /No runtimes selected/
  );
});

test('parses --version=X.Y.Z', () => {
  assert.equal(parseFlags(['--version=2.3.0']).version, '2.3.0');
});

test('rejects blank value flags', () => {
  assert.throws(() => parseFlags(['--version=']), /--version requires a value/);
  assert.throws(() => parseFlags(['--hermes-category=']), /--hermes-category requires a value/);
  assert.throws(() => parseFlags(['--output-chatgpt-bundle=']), /--output-chatgpt-bundle requires a value/);
});

test('parses --hermes-category=', () => {
  assert.equal(parseFlags(['--hermes-category=creative']).hermesCategory, 'creative');
});

test('parses --output-chatgpt-bundle=path', () => {
  assert.equal(parseFlags(['--output-chatgpt-bundle=/tmp/x.md']).outputChatgptBundle, '/tmp/x.md');
});

test('parses --dry-run, --uninstall, --remove-cli, --no-credentials', () => {
  const f = parseFlags(['--dry-run', '--uninstall', '--remove-cli', '--no-credentials']);
  assert.equal(f.dryRun, true);
  assert.equal(f.uninstall, true);
  assert.equal(f.removeCli, true);
  assert.equal(f.noCredentials, true);
});

test('rejects unknown flags', () => {
  assert.throws(() => parseFlags(['--bogus']), /Unknown flag/);
});

test('rejects removed --symlink flag instead of silently copying', () => {
  assert.throws(() => parseFlags(['--symlink']), /Unknown flag: --symlink/);
});

test('parses --no-ui and --boring, defaulting to false', () => {
  assert.equal(parseFlags([]).noUi, false);
  assert.equal(parseFlags([]).boring, false);
  assert.equal(parseFlags(['--no-ui']).noUi, true);
  assert.equal(parseFlags(['--boring']).boring, true);
});

test('--only=desktop is accepted', () => {
  const flags = parseFlags(['--only=desktop']);
  assert.deepEqual(flags.only, ['desktop']);
});

test('--exclude=desktop is accepted alongside others', () => {
  const flags = parseFlags(['--exclude=desktop,chatgpt']);
  assert.deepEqual(flags.exclude, ['desktop', 'chatgpt']);
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
