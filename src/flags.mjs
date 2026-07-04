const BOOL_FLAGS = new Set([
  '--yes', '-y',
  '--dry-run',
  '--uninstall',
  '--remove-cli',
  '--purge',
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

const RUNTIME_FILTERS = new Set(['claude', 'desktop', 'codex', 'hermes', 'chatgpt']);
const ALL_RUNTIME_FILTERS = [...RUNTIME_FILTERS];

function parseRuntimeFilterFlag(key, value) {
  const values = value.split(',').map(s => s.trim()).filter(Boolean);
  if (values.length === 0) {
    throw new Error(`${key} must list at least one runtime: claude, desktop, codex, hermes, chatgpt`);
  }
  const invalid = values.filter(v => !RUNTIME_FILTERS.has(v));
  if (invalid.length > 0) {
    throw new Error(`Invalid runtime for ${key}: ${invalid.join(', ')}. Use claude, desktop, codex, hermes, or chatgpt.`);
  }
  return values;
}

function requireValue(key, value) {
  if (!value.trim()) throw new Error(`${key} requires a value.`);
  return value;
}

function validateSelectedRuntimes({ only, exclude }) {
  if (!only && !exclude) return;
  const selected = (only ?? ALL_RUNTIME_FILTERS).filter((runtime) => !exclude?.includes(runtime));
  if (selected.length === 0) {
    throw new Error('No runtimes selected after applying --only/--exclude. Use at least one of claude, desktop, codex, hermes, or chatgpt.');
  }
}

export function parseFlags(argv) {
  const out = {
    yes: false,
    dryRun: false,
    uninstall: false,
    removeCli: false,
    purge: false,
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
      if (key === '--only') out.only = parseRuntimeFilterFlag(key, value);
      else if (key === '--exclude') out.exclude = parseRuntimeFilterFlag(key, value);
      else if (key === '--version') out.version = requireValue(key, value);
      else if (key === '--hermes-category') out.hermesCategory = requireValue(key, value);
      else if (key === '--output-chatgpt-bundle') out.outputChatgptBundle = requireValue(key, value);
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }
  validateSelectedRuntimes(out);
  return out;
}
