# Changelog

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
