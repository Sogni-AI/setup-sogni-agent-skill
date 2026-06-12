const BOOL_FLAGS = new Set([
  '--yes', '-y',
  '--dry-run',
  '--uninstall',
  '--remove-cli',
  '--purge',
  '--symlink',
  '--no-credentials',
  '--no-ui',
  '--boring',
]);

const VALUE_FLAGS = new Set([
  '--only',
  '--exclude',
  '--version',
  '--hermes-category',
  '--output-chatgpt-bundle',
]);

export function parseFlags(argv) {
  const out = {
    yes: false,
    dryRun: false,
    uninstall: false,
    removeCli: false,
    purge: false,
    symlink: false,
    noCredentials: false,
    noUi: false,
    boring: false,
    version: 'latest',
    hermesCategory: 'media',
    only: null,
    exclude: null,
    outputChatgptBundle: null,
  };
  for (const arg of argv) {
    if (BOOL_FLAGS.has(arg)) {
      if (arg === '--yes' || arg === '-y') out.yes = true;
      else if (arg === '--dry-run') out.dryRun = true;
      else if (arg === '--uninstall') out.uninstall = true;
      else if (arg === '--remove-cli') out.removeCli = true;
      else if (arg === '--purge') out.purge = true;
      else if (arg === '--symlink') out.symlink = true;
      else if (arg === '--no-credentials') out.noCredentials = true;
      else if (arg === '--no-ui') out.noUi = true;
      else if (arg === '--boring') out.boring = true;
      continue;
    }
    const eq = arg.indexOf('=');
    if (eq > 0) {
      const key = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      if (!VALUE_FLAGS.has(key)) throw new Error(`Unknown flag: ${arg}`);
      if (key === '--only') out.only = value.split(',').map(s => s.trim()).filter(Boolean);
      else if (key === '--exclude') out.exclude = value.split(',').map(s => s.trim()).filter(Boolean);
      else if (key === '--version') out.version = value;
      else if (key === '--hermes-category') out.hermesCategory = value;
      else if (key === '--output-chatgpt-bundle') out.outputChatgptBundle = value;
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }
  return out;
}
