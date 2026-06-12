// Trippy terminal FX (pure ANSI, zero dependencies), ported from
// sogni-project-downloader: plasma-shaded block-letter banner, twinkling
// starfield, rainbow text, spinner with interference-wave underline, and a
// starburst finale. Everything degrades to plain output when stdout is piped,
// NO_COLOR is set, or --no-ui / --boring is passed.

export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
const HIDE_CUR = '\x1b[?25l';
const SHOW_CUR = '\x1b[?25h';
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const WAVE_BLOCKS = '▁▂▃▄▅▆▇█';

// Block-letter S O G N I (5 rows, ~34 cols)
const BANNER = [
  ' ██████  █████   ██████ ██   ██ ██',
  '██      ██   ██ ██      ███  ██ ██',
  ' █████  ██   ██ ██  ███ ██ █ ██ ██',
  '     ██ ██   ██ ██   ██ ██  ███ ██',
  '██████   █████   █████  ██   ██ ██',
];
const BANNER_W = BANNER[0].length;

export function uiEnabled({ noUi = false, boring = false } = {}) {
  return Boolean(process.stdout.isTTY) && !noUi && !boring && !process.env.NO_COLOR;
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

export function tint(h, s, l) {
  const [r, g, b] = hslToRgb(h, s, l);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function rainbowText(text, hue, { spread = 8, s = 0.65, l = 0.62 } = {}) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    out += tint(hue + i * spread, s, l) + text[i];
  }
  return out + RESET;
}

// Deterministic pseudo-random in [0,1) — shader-style hash, no RNG state.
export function sparkleHash(x, seed) {
  const v = Math.sin(x * 127.1 + seed * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** Twinkling starfield. `burst` cranks star density during the finale. */
export function starfieldLine(width, t, hue, burst = 0) {
  const seed = Math.floor(t * 2.5);
  const thr = 0.985 - burst * 0.18;
  let out = '';
  for (let x = 0; x < width; x++) {
    const h = sparkleHash(x, seed);
    if (h > thr) out += tint(hue + x * 7, 0.7, 0.78) + '✦';
    else if (h > thr - 0.008) out += tint(hue + 180 + x * 5, 0.6, 0.66) + '✧';
    else if (h > thr - 0.02) out += tint(hue + x * 9, 0.45, 0.42) + '·';
    else if (h > thr - 0.028) out += tint(hue + 90 + x * 6, 0.4, 0.32) + '˚';
    else out += ' ';
  }
  return out + RESET;
}

/** Plasma-shaded block-letter banner. */
export function bannerLines(t, hue) {
  return BANNER.map((row, ry) => {
    let out = '  ';
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ') {
        out += ' ';
        continue;
      }
      const h = hue + x * 4 + 18 * Math.sin(t * 1.8 + x * 0.18 + ry * 0.9);
      const l = 0.55 + 0.14 * Math.sin(t * 2.4 + x * 0.12 - ry * 0.7);
      out += tint(h, 0.78, l) + ch;
    }
    return out + RESET;
  });
}

/** Interference wave — the pulse of the supernet. */
export function waveLine(width, t, hue, amp = 0.5) {
  let out = DIM + '∿ ' + RESET;
  for (let x = 0; x < width - 2; x++) {
    const s = Math.sin(x * 0.3 - t * 2.8) * Math.sin(x * 0.11 + t * 1.15);
    const v = (s * amp + 1) / 2; // 0..1
    const idx = Math.min(7, Math.floor(v * 8));
    out += tint(hue + x * 5 + v * 50, 0.65, 0.28 + 0.34 * v) + WAVE_BLOCKS[idx];
  }
  return out + RESET;
}

function eraseSeq(height) {
  if (!height) return '';
  let seq = '';
  for (let i = 0; i < height; i++) seq += '\x1b[1A\x1b[2K';
  return seq + '\r';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Never leave the terminal with a hidden cursor, even on crashes. The SIGINT
// handler is only attached while an animation is running so it cannot
// interfere with the `prompts` library's own Ctrl-C handling.
let cursorHidden = false;
function onSigint() {
  process.stdout.write(SHOW_CUR);
  process.exit(130);
}
function hideCursor() {
  if (cursorHidden) return;
  cursorHidden = true;
  process.stdout.write(HIDE_CUR);
  process.on('SIGINT', onSigint);
}
function showCursor() {
  if (!cursorHidden) return;
  cursorHidden = false;
  process.stdout.write(SHOW_CUR);
  process.removeListener('SIGINT', onSigint);
}
process.on('exit', () => {
  if (cursorHidden) process.stdout.write(SHOW_CUR);
});

/** Animated plasma banner + starfield splash. Leaves the last frame in place. */
export async function introSplash({
  enabled,
  subtitle = '·· s k i l l   i n s t a l l e r ··',
  frames = 16,
} = {}) {
  if (!enabled) return;
  hideCursor();
  const t0 = Date.now();
  let height = 0;
  for (let f = 0; f <= frames; f++) {
    const t = (Date.now() - t0) / 1000;
    const hue = 200 + t * 60;
    const cols = process.stdout.columns || 80;
    const fieldW = Math.min(cols - 4, 58);
    const compact = cols < BANNER_W + 6;
    const lines = [];
    if (compact) {
      const star = tint(hue + 180, 0.55, 0.7) + (f % 2 ? '✦' : '✧') + RESET;
      lines.push(
        `  ${star} ${rainbowText('S O G N I', hue, { spread: 10 })} ${star} ` +
          `${DIM}· skill installer ·${RESET}`
      );
    } else {
      lines.push('  ' + starfieldLine(fieldW, t, hue));
      lines.push(...bannerLines(t, hue));
      const pad = Math.max(0, Math.floor((BANNER_W - subtitle.length) / 2)) + 2;
      lines.push(' '.repeat(pad) + DIM + subtitle + RESET);
      lines.push('  ' + starfieldLine(fieldW, t + 47.3, hue + 120));
    }
    process.stdout.write(eraseSeq(height) + lines.join('\n') + '\n');
    height = lines.length;
    await sleep(80);
  }
  showCursor();
}

/**
 * Live two-line block: rainbow spinner + phase text over a breathing
 * interference wave. Erases itself completely on stop(). No-ops when disabled
 * — callers print their own plain fallback lines.
 */
export class LivePhase {
  constructor(enabled) {
    this.enabled = enabled;
    this.phase = '';
    this.t0 = Date.now();
    this.height = 0;
    this.timer = null;
  }

  start(phase) {
    this.phase = phase;
    if (!this.enabled || this.timer) return;
    hideCursor();
    this.timer = setInterval(() => this.render(), 80);
    this.render();
  }

  setPhase(phase) {
    this.phase = phase;
    if (this.enabled && this.timer) this.render();
  }

  stop() {
    if (!this.enabled || !this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    process.stdout.write(eraseSeq(this.height));
    this.height = 0;
    showCursor();
  }

  render() {
    const t = (Date.now() - this.t0) / 1000;
    const hue = t * 36;
    const cols = process.stdout.columns || 80;
    const fieldW = Math.min(cols - 4, 58);
    const spin = tint(hue, 0.7, 0.65) + SPINNER[Math.floor(t * 12) % SPINNER.length] + RESET;
    const amp = 0.45 + 0.25 * Math.sin(t * 1.4);
    const lines = [`  ${spin} ${this.phase}`, '  ' + waveLine(fieldW, t, hue + 60, amp)];
    process.stdout.write(eraseSeq(this.height) + lines.join('\n') + '\n');
    this.height = lines.length;
  }
}

/** Starburst send-off: the sky fills with stars, then they fade out. */
export async function finale({ enabled, text = '✦  a l l   s e t  ✦' } = {}) {
  if (!enabled) return;
  hideCursor();
  const t0 = Date.now();
  const frames = 16;
  let height = 0;
  for (let f = frames; f >= 0; f--) {
    const burst = f / frames;
    const t = (Date.now() - t0) / 1000;
    const hue = 120 + t * 50;
    const cols = process.stdout.columns || 80;
    const fieldW = Math.min(cols - 4, 58);
    const lines = [
      '  ' + starfieldLine(fieldW, t, hue, burst),
      '  ' + rainbowText(text, hue + 40, { spread: 12 }),
      '  ' + starfieldLine(fieldW, t + 9.7, hue + 150, burst),
    ];
    process.stdout.write(eraseSeq(height) + lines.join('\n') + '\n');
    height = lines.length;
    await sleep(70);
  }
  showCursor();
}
