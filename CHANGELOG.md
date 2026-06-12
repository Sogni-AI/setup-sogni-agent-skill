# Changelog

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
