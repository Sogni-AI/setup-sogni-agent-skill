# Changelog

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
