import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform as osPlatform } from 'node:os';
import { dirname, join } from 'node:path';
import kleur from 'kleur';
import { isExactSemver } from './semver.mjs';

const PKG = '@sogni-ai/sogni-creative-agent-skill';
export const SKILL_PACKAGE = PKG;

// npm's default retry policy (fetch-retries=2, backing off 10 s then 60 s)
// takes about 70 s to give up on an unreachable registry. Waiting longer lets
// npm report the real cause (ECONNREFUSED, ENOTFOUND, a proxy or auth error);
// the timeout only ends lookups that hang outright.
export const LATEST_LOOKUP_TIMEOUT_MS = 90_000;

const LOOKUP_ADVICE =
  'Setup installs the release npm tags as `latest` and has no built-in fallback version. ' +
  'Check your network connection and npm registry settings (`npm config get registry`), then re-run. ' +
  'To install a specific release instead, re-run with --version=X.Y.Z.';

export function isPermissionError(stderr) {
  if (!stderr) return false;
  return /\bEACCES\b|\bEPERM\b|permission denied|Permission denied|operation not permitted/i.test(stderr);
}

function shellQuote(value) {
  const s = String(value);
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

export function formatSetupCommand(argv = process.argv.slice(2), { sudo = false } = {}) {
  const args = argv.map(shellQuote).join(' ');
  return `${sudo ? 'sudo ' : ''}npx setup-sogni-agent-skill${args ? ` ${args}` : ''}`;
}

export function formatElevatedSetupCommand(argv = process.argv.slice(2), { platform = osPlatform() } = {}) {
  return formatSetupCommand(argv, { sudo: platform !== 'win32' });
}

function envValue(env, name) {
  if (env[name] !== undefined) return env[name];
  const entry = Object.entries(env)
    .find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}

export function npmInvocation(
  args,
  {
    platform = osPlatform(),
    env = process.env,
    execPath = process.execPath,
    pathExists = existsSync,
  } = {}
) {
  if (platform !== 'win32') {
    return { command: 'npm', args };
  }

  // npm is exposed as npm.cmd on Windows, which cannot be launched directly
  // by child_process without a shell. Run npm's JS entry point with Node
  // instead so arguments remain an array and do not pass through cmd.exe.
  const npmExecPath = envValue(env, 'npm_execpath');
  const bundledNpmExecPath = join(dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const cliPath = [npmExecPath, bundledNpmExecPath].find(
    candidate => candidate && pathExists(candidate)
  );

  if (!cliPath) {
    // Preserve the existing ENOENT handling for incomplete Node/npm installs.
    return { command: 'npm', args };
  }

  const npmNodeExecPath = envValue(env, 'npm_node_execpath');
  const nodeExecPath = npmNodeExecPath && pathExists(npmNodeExecPath)
    ? npmNodeExecPath
    : execPath;
  return { command: nodeExecPath, args: [cliPath, ...args] };
}

function printPermissionHelp({ argv = process.argv.slice(2), platform = osPlatform() } = {}) {
  const isWindows = platform === 'win32';
  console.error('');
  console.error(kleur.red().bold('Could not install — your computer blocked the install.'));
  console.error('');
  console.error("Your `npm` tool was installed in a place that requires admin access to add new packages, so the regular install can't write the files it needs.");
  console.error('');
  console.error(kleur.bold('You have two ways to fix this:'));
  console.error('');
  console.error(kleur.cyan('  1) Quick fix — rerun this setup with admin rights'));
  if (isWindows) {
    console.error('     Open a new terminal as Administrator, then run:');
  }
  console.error(`     ${kleur.gray('$')} ${formatElevatedSetupCommand(argv, { platform })}`);
  console.error(`     You will be asked for ${isWindows ? 'admin approval' : 'your computer password'}. The installer will still`);
  console.error('     detect your agents and prompt for your Sogni API key in this same flow.');
  console.error('');
  console.error(kleur.cyan('  2) Permanent fix — let npm install to your own folder'));
  console.error('     (recommended if you install npm packages often)');
  console.error('     Follow the official Node.js guide:');
  console.error('     https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally');
  console.error('     After that, re-run:');
  console.error(`     ${kleur.gray('$')} ${formatSetupCommand(argv)}`);
  console.error('');
}

function indentedNpmOutput(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return `\n${trimmed.split(/\r?\n/).map((line) => `  ${line}`).join('\n')}`;
}

// Asks npm which version the skill's `latest` dist-tag names. This goes
// through the npm CLI, like the install that follows, so the user's registry,
// scoped-registry, proxy, certificate and auth settings apply to both and the
// version looked up is one the install can fetch. Any failure throws; there is
// no fallback version.
export async function resolveLatestSkillVersion({
  timeoutMs = LATEST_LOOKUP_TIMEOUT_MS,
  invocation = npmInvocation,
} = {}) {
  const args = ['view', PKG, 'dist-tags.latest', '--json'];
  const command = `npm ${args.join(' ')}`;
  const r = await runNpm(args, { quiet: true, timeoutMs, invocation });
  if (r.error?.code === 'ENOENT') {
    throw new Error('npm not found on PATH. Install Node.js from https://nodejs.org and re-run.');
  }
  if (r.error) {
    throw new Error(`Could not run \`${command}\`: ${r.error.message}. ${LOOKUP_ADVICE}`);
  }
  if (r.timedOut) {
    throw new Error(
      `Could not look up the latest ${PKG} release: \`${command}\` did not finish within ` +
      `${timeoutMs / 1000} s and was stopped.${indentedNpmOutput(r.stderr)}\n${LOOKUP_ADVICE}`
    );
  }
  if (r.status !== 0) {
    throw new Error(
      `Could not look up the latest ${PKG} release: \`${command}\` exited with code ${r.status}.` +
      `${indentedNpmOutput(r.stderr)}\n${LOOKUP_ADVICE}`
    );
  }
  const raw = r.stdout.trim();
  if (!raw) {
    throw new Error(`npm returned no \`latest\` dist-tag for ${PKG} (\`${command}\` printed nothing). ${LOOKUP_ADVICE}`);
  }
  let version;
  try {
    version = JSON.parse(raw);
  } catch {
    throw new Error(`\`${command}\` printed output that is not JSON: ${JSON.stringify(raw.slice(0, 200))}. ${LOOKUP_ADVICE}`);
  }
  if (!isExactSemver(version)) {
    throw new Error(
      `npm's \`latest\` dist-tag for ${PKG} is ${JSON.stringify(version)}, which is not a valid semantic version. ${LOOKUP_ADVICE}`
    );
  }
  return version;
}

// `quiet` pipes npm's stdout instead of inheriting it, so an animated spinner
// can own the terminal while npm works; the captured output is replayed only
// on failure. Async (spawn, not spawnSync) so the spinner's timer keeps firing.
export async function installCli({ version, quiet = false } = {}) {
  if (!isExactSemver(version)) {
    throw new Error(`installCli needs an exact skill version, got ${JSON.stringify(version)}.`);
  }
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
      printPermissionHelp();
      const err = new Error(`npm install -g ${spec} failed: permission denied. See instructions above.`);
      err.kind = 'permission';
      throw err;
    }
    throw new Error(`npm install -g ${spec} failed with exit code ${r.status}.`);
  }
  return { skipped: false, spec };
}

function runNpm(args, { quiet, timeoutMs = null, invocation = npmInvocation }) {
  return new Promise((resolve) => {
    const npm = invocation(args);
    const child = spawn(npm.command, npm.args, {
      stdio: ['inherit', quiet ? 'pipe' : 'inherit', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = timeoutMs === null
      ? null
      : setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeoutMs);
    const finish = (result) => {
      if (timer) clearTimeout(timer);
      resolve({ ...result, stdout, stderr, timedOut });
    };
    child.stdout?.on('data', (d) => { stdout += d; });
    child.stderr?.on('data', (d) => { stderr += d; });
    child.on('error', (error) => finish({ status: null, error }));
    child.on('close', (status) => finish({ status }));
  });
}
