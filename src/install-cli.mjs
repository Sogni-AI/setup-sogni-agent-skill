import { spawn } from 'node:child_process';
import kleur from 'kleur';

const PKG = '@sogni-ai/sogni-creative-agent-skill';

export function isPermissionError(stderr) {
  if (!stderr) return false;
  return /\bEACCES\b|\bEPERM\b|permission denied|Permission denied|operation not permitted/i.test(stderr);
}

function printPermissionHelp(spec) {
  console.error('');
  console.error(kleur.red().bold('Could not install — your computer blocked the install.'));
  console.error('');
  console.error("Your `npm` tool was installed in a place that requires admin access to add new packages, so the regular install can't write the files it needs.");
  console.error('');
  console.error(kleur.bold('You have two ways to fix this:'));
  console.error('');
  console.error(kleur.cyan('  1) Quick fix — install once with admin rights'));
  console.error(`     ${kleur.gray('$')} sudo npm install -g ${spec}`);
  console.error('     You will be asked for your computer password. This is the simplest option.');
  console.error('');
  console.error(kleur.cyan('  2) Permanent fix — let npm install to your own folder'));
  console.error('     (recommended if you install npm packages often)');
  console.error('     Follow the official Node.js guide:');
  console.error('     https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally');
  console.error('     After that, re-run:');
  console.error(`     ${kleur.gray('$')} npx setup-sogni-agent-skill`);
  console.error('');
}

// `quiet` pipes npm's stdout instead of inheriting it, so an animated spinner
// can own the terminal while npm works; the captured output is replayed only
// on failure. Async (spawn, not spawnSync) so the spinner's timer keeps firing.
export async function installCli({ version = 'latest', quiet = false } = {}) {
  if (process.env.INSTALL_CLI === 'skip') {
    return { skipped: true, reason: 'INSTALL_CLI=skip' };
  }
  const spec = `${PKG}@${version}`;
  const r = await runNpm(['install', '-g', spec], { quiet });
  if (r.status !== 0) {
    if (r.error?.code === 'ENOENT') {
      throw new Error('npm not found on PATH. Install Node.js from https://nodejs.org and re-run.');
    }
    if (quiet && r.stdout) process.stdout.write(r.stdout);
    const stderr = r.stderr ?? '';
    if (stderr) process.stderr.write(stderr);
    if (isPermissionError(stderr)) {
      printPermissionHelp(spec);
      const err = new Error(`npm install -g ${spec} failed: permission denied. See instructions above.`);
      err.kind = 'permission';
      throw err;
    }
    throw new Error(`npm install -g ${spec} failed with exit code ${r.status}.`);
  }
  return { skipped: false, spec };
}

function runNpm(args, { quiet }) {
  return new Promise((resolve) => {
    const child = spawn('npm', args, {
      stdio: ['inherit', quiet ? 'pipe' : 'inherit', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('error', (error) => resolve({ status: null, error, stdout, stderr }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}
