import { spawnSync } from 'node:child_process';

const PKG = '@sogni-ai/sogni-creative-agent-skill';

export function installCli({ version = 'latest' } = {}) {
  if (process.env.INSTALL_CLI === 'skip') {
    return { skipped: true, reason: 'INSTALL_CLI=skip' };
  }
  const spec = `${PKG}@${version}`;
  const r = spawnSync('npm', ['install', '-g', spec], {
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) {
    if (r.error?.code === 'ENOENT') {
      throw new Error('npm not found on PATH. Install Node.js from https://nodejs.org and re-run.');
    }
    throw new Error(`npm install -g ${spec} failed with exit code ${r.status}. If this is EACCES, see https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`);
  }
  return { skipped: false, spec };
}
