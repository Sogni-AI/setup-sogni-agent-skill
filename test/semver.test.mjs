import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExactSemver } from '../src/semver.mjs';

test('isExactSemver accepts exact release, prerelease and build versions', () => {
  for (const value of ['0.0.0', '3.43.0', '10.20.30', '3.1.0-alpha.1', '1.0.0-rc.1+build.5', '1.2.3+sha.abc']) {
    assert.equal(isExactSemver(value), true, value);
  }
});

test('isExactSemver rejects tags, ranges, prefixes and malformed values', () => {
  for (const value of [
    '', 'latest', '3', '3.43', '3.43.0.1', 'v3.43.0', '^3.43.0', '~3.43.0', '3.x',
    '03.43.0', '3.043.0', ' 3.43.0', '3.43.0\n', '<html>', '3.43.0-', '3.43.0+',
  ]) {
    assert.equal(isExactSemver(value), false, JSON.stringify(value));
  }
});

test('isExactSemver rejects non-strings', () => {
  for (const value of [undefined, null, 3, ['3.43.0'], { version: '3.43.0' }]) {
    assert.equal(isExactSemver(value), false, String(value));
  }
});
