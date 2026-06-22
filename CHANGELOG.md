# Changelog

## 0.5.1

### Fixed

- Permission-denied global npm installs now tell users to rerun the same
  `npx setup-sogni-agent-skill` command with elevation, preserving flags,
  instead of sending them through a standalone `sudo npm install -g` step.
  macOS/Linux users see a `sudo npx ...` command; Windows users are told to
  rerun from an Administrator terminal. Sudo reruns resolve the elevated global
  install path, then drop back to the original user before runtime detection,
  skill writes, purge checks, or API-key setup.
- `--uninstall --remove-cli` now checks whether `npm uninstall -g` succeeded.
  If npm needs admin rights, setup stops before removing user skill files or
  data and prints the elevated rerun command instead of reporting a misleading
  success.
- Removed the advertised `--symlink` flag because no adapter implemented it.
  Passing it now fails clearly instead of silently doing a copy-based install.
- Runtime filters and value flags are now validated before setup starts, so
  typos like `--only=codez` or blanks like `--version=` fail immediately instead
  of installing the CLI and then producing a confusing no-target run.
- Filter combinations that select no runtimes, such as
  `--only=codex --exclude=codex`, now fail during argument parsing with a direct
  explanation.
- Setup now installs skill files only into detected local runtimes. Missing
  `~/.claude`, `~/.codex`, or `~/.hermes` directories are no longer created just
  because those runtimes appeared in the detection table.
- `--only=chatgpt` now skips the local credentials prompt because ChatGPT Custom
  GPT setup uses API credentials inside ChatGPT Actions, not
  `~/.config/sogni/credentials`.
- Flagless setup no longer reports ChatGPT instructions as "printed" in the
  summary when it only showed the `--only=chatgpt` pointer.
- The npm package description now says ChatGPT Custom-GPT instructions are
  available on request instead of implying the default run prints them.
- Summary next steps now match the operation: uninstall and purge runs no longer
  tell users to try `sogni-agent`, and ChatGPT-only runs point users back to the
  Custom-GPT editor instead of local CLI usage.
- Explicit local-only runs such as `--only=codex` now preflight target detection
  before `npm install -g`. If the selected local runtime has not created its
  config directory yet, setup exits without installing anything.

## 0.5.0

### Features

- **Animated terminal UI**, ported from `sogni-project-downloader`: a
  plasma-shaded block-letter SOGNI banner with twinkling starfields on launch,
  a rainbow spinner over an interference wave while `npm install -g` runs
  (npm output is captured and replayed only on failure), a rainbow detection
  header, and a starburst finale. Pure ANSI, zero new dependencies. Disabled
  automatically when stdout is not a TTY or `NO_COLOR` is set, and manually
  with the new `--no-ui` / `--boring` flags.

### Changed

- `installCli()` is now async (`spawn` instead of `spawnSync`) so the spinner
  can animate during the global install. Plain-output behavior is unchanged:
  npm's stdout is still inherited when the UI is off.

## 0.4.1

### Fixed

- **`--dry-run` no longer installs the global CLI.** The step-1 `npm install -g`
  ran before the dry-run gate, so a "preview" mutated the system. Dry runs now
  skip the install (printing what would run) and fall back to the requested
  version for the detection table when the package is not installed yet.

## 0.4.0

### Fixed

- **Codex upgrades no longer destroy runtime dependencies.** The Codex adapter
  wipes the skill directory on upgrade (so removed files don't linger); when
  the previous install had bootstrapped `node_modules`, the adapter now
  reinstalls them after the wipe (bootstrapping `package.json` from
  `skill-package.json` when needed). Failures degrade to a warning — the
  globally installed `sogni-agent` on `PATH` is unaffected either way.
- **`engines.node` relaxed from the exact pin `22.22.0` to `>=22.11.0`**, the
  same floor the `sogni-agent` CLI enforces. The exact pin broke installs on
  any other Node 22+ under engine-strict configurations.

### Changed

- **ChatGPT Custom-GPT instructions are no longer dumped on every run.** The
  full instructions (which embed the entire SKILL.md) print only with
  `--only=chatgpt`, or are written to a file with
  `--output-chatgpt-bundle=<file>`; flagless runs print a one-line pointer
  instead.


## 0.3.0

### Features

- **`--purge` complete uninstall.** Opt-in flag that removes the user's Sogni
  data directory (`~/.config/sogni/` — API key, personas, memories, personality,
  last render) after writing a timestamped tar backup to
  `~/.config/sogni.backup-<timestamp>.tar.gz`. If the backup cannot be written,
  the purge aborts and data is left untouched.
  - Runs standalone (`--purge` removes data, keeps skill files) and composes with
    `--uninstall` / `--remove-cli`, where purge runs last (after adapter removal
    and CLI removal).
  - Confirms before deleting (skip with `--yes`).
  - Shared paths used by other tools (`~/.openclaw/openclaw.json`, `~/.clawdbot/`)
    are never touched.
  - Documented in `--help` and the README, including the `tar -xzf` recovery
    command and a note that the backup persists and holds the API key.

## 0.2.0

- Friendlier install errors and optional ffmpeg recommendation.
- Pin Node to 22.22.0.
- Initial installer: detect runtimes, install CLI + skill, prompt for API key,
  `--uninstall` / `--remove-cli`.
