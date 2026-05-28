import { spawnSync } from 'node:child_process';
import { platform } from 'node:os';
import kleur from 'kleur';

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
