import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFfmpegInstalled, recommendFfmpeg } from '../src/check-ffmpeg.mjs';

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
