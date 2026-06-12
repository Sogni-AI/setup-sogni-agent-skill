import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RESET,
  tint,
  rainbowText,
  sparkleHash,
  starfieldLine,
  bannerLines,
  waveLine,
  uiEnabled,
  introSplash,
  finale,
  LivePhase,
} from '../src/ui.mjs';

const strip = (s) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

test('tint emits a truecolor escape sequence', () => {
  assert.match(tint(0, 1, 0.5), /^\x1b\[38;2;\d{1,3};\d{1,3};\d{1,3}m$/);
});

test('rainbowText preserves visible text and ends with a reset', () => {
  const out = rainbowText('SOGNI', 120);
  assert.equal(strip(out), 'SOGNI');
  assert.ok(out.endsWith(RESET));
});

test('sparkleHash is deterministic and in [0,1)', () => {
  for (let x = 0; x < 50; x++) {
    const v = sparkleHash(x, 7);
    assert.equal(v, sparkleHash(x, 7));
    assert.ok(v >= 0 && v < 1, `sparkleHash(${x}, 7) = ${v}`);
  }
});

test('starfieldLine renders exactly the requested width', () => {
  assert.equal(strip(starfieldLine(40, 1.25, 90)).length, 40);
  assert.equal(strip(starfieldLine(40, 1.25, 90, 1)).length, 40);
});

test('bannerLines renders five equal-width rows', () => {
  const rows = bannerLines(0.4, 200);
  assert.equal(rows.length, 5);
  const widths = rows.map((r) => strip(r).length);
  assert.ok(widths.every((w) => w === widths[0]), `widths: ${widths}`);
  assert.match(strip(rows[0]), /█/);
});

test('waveLine renders exactly the requested width', () => {
  assert.equal(strip(waveLine(30, 2.2, 45)).length, 30);
});

test('uiEnabled is false with --no-ui, --boring, or NO_COLOR', () => {
  assert.equal(uiEnabled({ noUi: true }), false);
  assert.equal(uiEnabled({ boring: true }), false);
  const prev = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  try {
    assert.equal(uiEnabled({}), false);
  } finally {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  }
});

test('introSplash and finale resolve immediately when disabled', async () => {
  await introSplash({ enabled: false });
  await finale({ enabled: false });
});

test('LivePhase no-ops when disabled', () => {
  const live = new LivePhase(false);
  live.start('working…');
  live.setPhase('still working…');
  live.stop();
  assert.equal(live.timer, null);
});
