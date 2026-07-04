import { test } from 'node:test';
import assert from 'node:assert/strict';
import prompts from 'prompts';
import { isFfmpegInstalled, recommendFfmpeg, detectInstaller, offerFfmpegInstall } from '../src/check-ffmpeg.mjs';

function captureConsole() {
  const original = console.log;
  const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  return {
    output: () => lines.join('\n'),
    restore: () => { console.log = original; },
  };
}

test('isFfmpegInstalled returns true when SOGNI_TEST_SKIP_FFMPEG_CHECK=1', () => {
  const prev = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = '1';
  try {
    assert.equal(isFfmpegInstalled(), true);
  } finally {
    if (prev === undefined) delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
    else process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prev;
  }
});

test('isFfmpegInstalled detects missing ffmpeg by clearing PATH', (t) => {
  const prevPath = process.env.PATH;
  const prevSkip = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.PATH = '/nonexistent-dir-for-sogni-test';
  t.after(() => {
    process.env.PATH = prevPath;
    if (prevSkip !== undefined) process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prevSkip;
  });
  assert.equal(isFfmpegInstalled(), false);
});

test('recommendFfmpeg prints install help when ffmpeg is missing', (t) => {
  const prevPath = process.env.PATH;
  const prevSkip = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.PATH = '/nonexistent-dir-for-sogni-test';
  const cap = captureConsole();
  t.after(() => {
    cap.restore();
    process.env.PATH = prevPath;
    if (prevSkip !== undefined) process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prevSkip;
  });
  const r = recommendFfmpeg();
  const out = cap.output();
  assert.equal(r.installed, false);
  assert.match(out, /ffmpeg was not found/i);
  assert.match(out, /recommend installing it/i);
});

test('recommendFfmpeg is silent when ffmpeg is present', (t) => {
  const prevSkip = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = '1';
  const cap = captureConsole();
  t.after(() => {
    cap.restore();
    if (prevSkip === undefined) delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
    else process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prevSkip;
  });
  const r = recommendFfmpeg();
  assert.equal(r.installed, true);
  assert.equal(cap.output(), '');
});

test('detectInstaller picks brew on darwin when present', () => {
  const exec = (bin) => ({ status: bin === 'brew' ? 0 : 1 });
  const found = detectInstaller({ platform: 'darwin', exec });
  assert.deepEqual(found, { label: 'Homebrew', command: 'brew', args: ['install', 'ffmpeg'] });
});

test('detectInstaller returns null when no manager exists', () => {
  const exec = () => ({ status: 1 });
  assert.equal(detectInstaller({ platform: 'darwin', exec }), null);
});

test('detectInstaller uses sudo apt-get on linux', () => {
  const exec = (bin) => ({ status: bin === 'apt-get' ? 0 : 1 });
  const found = detectInstaller({ platform: 'linux', exec });
  assert.deepEqual(found, { label: 'apt', command: 'sudo', args: ['apt-get', 'install', '-y', 'ffmpeg'] });
});

test('offerFfmpegInstall runs the installer when the user confirms', async () => {
  const calls = [];
  let installed = false;
  const exec = (cmd, args = ['--version']) => {
    calls.push([cmd, ...args]);
    if (cmd === 'brew' && args[0] === 'install') installed = true;
    return { status: 0 };
  };
  prompts.inject([true]);
  const result = await offerFfmpegInstall({
    interactive: true,
    exec,
    check: () => installed,
    platformOverride: 'darwin',
    ttyOverride: true,
  });
  assert.equal(result.installed, true);
  assert.equal(result.via, 'Homebrew');
  assert.ok(calls.some((c) => c[0] === 'brew' && c[1] === 'install' && c[2] === 'ffmpeg'));
});

test('offerFfmpegInstall falls back to recommendations when declined', async (t) => {
  // The fallback path calls recommendFfmpeg(), which re-checks the real
  // ffmpeg on PATH. Neutralize it so the mock (check: () => false) and the
  // host agree; capture console so the recommendation text stays quiet.
  const prevPath = process.env.PATH;
  const prevSkip = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.PATH = '/nonexistent-dir-for-sogni-test';
  const cap = captureConsole();
  t.after(() => {
    cap.restore();
    process.env.PATH = prevPath;
    if (prevSkip !== undefined) process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prevSkip;
  });
  prompts.inject([false]);
  const result = await offerFfmpegInstall({
    interactive: true,
    exec: () => ({ status: 0 }),
    check: () => false,
    platformOverride: 'darwin',
    ttyOverride: true,
  });
  assert.equal(result.installed, false);
});

test('offerFfmpegInstall never prompts when non-interactive', async (t) => {
  const prevPath = process.env.PATH;
  const prevSkip = process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  delete process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK;
  process.env.PATH = '/nonexistent-dir-for-sogni-test';
  const cap = captureConsole();
  t.after(() => {
    cap.restore();
    process.env.PATH = prevPath;
    if (prevSkip !== undefined) process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK = prevSkip;
  });
  // prompts.inject is NOT set — an unexpected prompt would hang/throw.
  const result = await offerFfmpegInstall({
    interactive: false,
    exec: () => ({ status: 0 }),
    check: () => false,
  });
  assert.equal(result.installed, false);
});
