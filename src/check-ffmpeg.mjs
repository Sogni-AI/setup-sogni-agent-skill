import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import kleur from 'kleur';
import prompts from 'prompts';

export function isFfmpegInstalled() {
  if (process.env.SOGNI_TEST_SKIP_FFMPEG_CHECK === '1') return true;
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (r.error?.code === 'ENOENT') return false;
  return r.status === 0;
}

function platformInstructions() {
  const p = platform();
  if (p === 'darwin') {
    return [
      'macOS — install with Homebrew (https://brew.sh):',
      '  brew install ffmpeg',
    ];
  }
  if (p === 'linux') {
    return [
      'Linux — install with your package manager:',
      '  Debian / Ubuntu:  sudo apt update && sudo apt install -y ffmpeg',
      '  Fedora:           sudo dnf install -y ffmpeg',
      '  Arch:             sudo pacman -S ffmpeg',
    ];
  }
  if (p === 'win32') {
    return [
      'Windows — install with winget or a download:',
      '  winget install Gyan.FFmpeg',
      '  or download from: https://www.gyan.dev/ffmpeg/builds/',
    ];
  }
  return [
    'Install ffmpeg from your operating system\'s package manager or from',
    'https://ffmpeg.org/download.html',
  ];
}

export function recommendFfmpeg() {
  if (isFfmpegInstalled()) return { installed: true };

  console.log('');
  console.log(kleur.yellow().bold('Optional: ffmpeg was not found on your computer.'));
  console.log('');
  console.log("ffmpeg is a free, open-source tool that the Sogni agent uses to merge");
  console.log('and convert video, image, and audio clips. Some features (stitching');
  console.log('videos together, extracting frames, adding music to a clip) need it.');
  console.log('');
  console.log(kleur.bold('We strongly recommend installing it:'));
  for (const line of platformInstructions()) {
    console.log('  ' + line);
  }
  console.log('');
  console.log(kleur.gray('After installing, restart your terminal so ffmpeg is on your PATH.'));
  console.log('');
  return { installed: false };
}

export function detectInstaller({ platform: platformName = platform(), exec = spawnSync } = {}) {
  const has = (bin) => {
    const r = exec(bin, ['--version'], { stdio: 'ignore' });
    return !r.error && r.status === 0;
  };
  if (platformName === 'darwin' && has('brew')) {
    return { label: 'Homebrew', command: 'brew', args: ['install', 'ffmpeg'] };
  }
  if (platformName === 'win32' && has('winget')) {
    return { label: 'winget', command: 'winget', args: ['install', '--id', 'Gyan.FFmpeg', '-e', '--source', 'winget'] };
  }
  if (platformName === 'linux') {
    if (has('apt-get')) return { label: 'apt', command: 'sudo', args: ['apt-get', 'install', '-y', 'ffmpeg'] };
    if (has('dnf')) return { label: 'dnf', command: 'sudo', args: ['dnf', 'install', '-y', 'ffmpeg'] };
    if (has('pacman')) return { label: 'pacman', command: 'sudo', args: ['pacman', '-S', '--noconfirm', 'ffmpeg'] };
  }
  return null;
}

export async function offerFfmpegInstall({
  interactive = true,
  exec = spawnSync,
  check = isFfmpegInstalled,
  platformOverride = null,
  ttyOverride = null,
} = {}) {
  if (check()) return { installed: true };

  const isTty = ttyOverride ?? process.stdin.isTTY === true;
  const installer = interactive && isTty
    ? detectInstaller({ platform: platformOverride ?? platform(), exec })
    : null;

  if (installer) {
    console.log('');
    console.log(kleur.yellow().bold('ffmpeg was not found on your computer.'));
    console.log('Sogni uses it to stitch videos, extract frames, and add music to clips.');
    const { ok } = await prompts({
      type: 'confirm',
      name: 'ok',
      message: `Install ffmpeg now with ${installer.label}? (recommended)`,
      initial: true,
    });
    if (ok === true) {
      const r = exec(installer.command, installer.args, { stdio: 'inherit' });
      if (r.status === 0 && check()) {
        console.log(kleur.green('ffmpeg installed.'));
        return { installed: true, via: installer.label };
      }
      console.log(kleur.yellow('ffmpeg install did not complete — showing manual instructions instead.'));
    }
  }
  return recommendFfmpeg();
}
