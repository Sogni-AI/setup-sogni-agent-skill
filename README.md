# setup-sogni-agent-skill

One-command installer for the [Sogni Creative Agent Skill](https://github.com/Sogni-AI/sogni-creative-agent-skill).

```bash
npx setup-sogni-agent-skill
```

Detects which agent runtimes you have installed, installs the `sogni-agent`
CLI globally, registers `SKILL.md` into each detected local runtime, and prompts
for your Sogni API key when local CLI use needs one.

Setup installs the Creative Agent Skill release that npm's `latest` dist-tag
names when you run it, and prints that version before installing. It asks npm
through your own npm configuration, so custom, scoped and proxied registries
apply. If npm cannot answer, or answers with something that is not a valid
version, setup stops with the npm error. It never falls back to a built-in
version. Use `--version=X.Y.Z` to install a specific release instead.

## Supports

- **Claude Code** — installs into `~/.claude/skills/sogni-creative-agent-skill/`
- **Claude Desktop** — registers a local MCP server entry in `claude_desktop_config.json` pointing at the globally installed CLI (requires a skill package version that ships `desktop-extension/` — install/upgrade with `npm i -g @sogni-ai/sogni-creative-agent-skill@latest`; the installer does this automatically). Fully quit and reopen Claude Desktop after install. Restrict with `--only=desktop`.
- **OpenAI Codex CLI** — installs into `~/.codex/skills/sogni-creative-agent-skill/` (upgrades preserve locally installed runtime dependencies)
- **Hermes Agent** — installs into `~/.hermes/skills/<category>/sogni-creative-agent-skill/`
- **ChatGPT (web)** — prints Custom GPT instructions on request: `--only=chatgpt` (or `--output-chatgpt-bundle=<file>` to save them)

It does **not** configure OpenClaw — use `openclaw plugins install npm:@sogni-ai/sogni-creative-agent-skill` for that.

## Usage

```bash
# Interactive (default)
npx setup-sogni-agent-skill

# Non-interactive (CI)
npx setup-sogni-agent-skill --yes --no-credentials

# Restrict to specific runtimes
npx setup-sogni-agent-skill --only=claude,desktop,codex

# Print ChatGPT Custom-GPT instructions (not printed by default; no local API-key file needed)
npx setup-sogni-agent-skill --only=chatgpt

# Dry run
npx setup-sogni-agent-skill --dry-run

# Install a specific skill release instead of npm's latest
npx setup-sogni-agent-skill --version=2.3.0

# Uninstall
npx setup-sogni-agent-skill --uninstall
npx setup-sogni-agent-skill --uninstall --remove-cli   # also remove the global CLI

# Plain output (no animated banner / spinner)
npx setup-sogni-agent-skill --no-ui
```

Run `npx setup-sogni-agent-skill --help` for the full flag list.

When using `--only`, start the target agent at least once first so its config
directory exists (`~/.claude`, `~/.codex`, or `~/.hermes`). If none of the
selected local runtimes are detected, setup exits before installing anything.

Interactive runs open with an animated SOGNI banner, show a spinner while npm
works, and end with a starburst. The animations are pure ANSI (no extra
dependencies) and switch themselves off when output is piped, when `NO_COLOR`
is set, or with `--no-ui` / `--boring`.

### If npm asks for admin access

Some Node.js installs require admin rights for global packages. If setup stops
with an `EACCES` or permission error, rerun the same setup command with admin
rights.

On macOS or Linux:

```bash
sudo npx setup-sogni-agent-skill
```

On Windows, open a new terminal as Administrator and run:

```bash
npx setup-sogni-agent-skill
```

Keep any flags you used on the first run. The elevated rerun uses admin rights
for the global npm install, then continues as your user so runtime detection and
API key setup still target your home directory on macOS and Linux.

### Complete uninstall (remove your data too)

`--uninstall` and `--remove-cli` remove the skill files and the global CLI but
leave your Sogni data in `~/.config/sogni/` (API key, personas, memories,
personality, last render). To remove that too, add `--purge`:

```bash
# Remove data only (skill files and CLI stay installed)
npx setup-sogni-agent-skill --purge

# Full teardown: skill files, then global CLI, then data
npx setup-sogni-agent-skill --uninstall --remove-cli --purge
```

`--purge` asks for confirmation (skip with `--yes`) and **always writes a backup
tarball first**: `~/.config/sogni.backup-<timestamp>.tar.gz`. If the backup
cannot be written, the purge aborts and your data is left untouched. Shared
paths used by other tools (`~/.openclaw/openclaw.json`, `~/.clawdbot/`) are never
touched.

To recover from a backup:

```bash
tar -xzf ~/.config/sogni.backup-<timestamp>.tar.gz -C ~/.config
```

The backup tarball is left in `~/.config/` and is not removed automatically — it
contains your API key, so delete it yourself once you're sure you no longer need
it.

## Requirements

- Node.js ≥ 22.11.0 (same floor as the `sogni-agent` CLI)
- `npm` on `$PATH`
- A [Sogni API key](https://dashboard.sogni.ai)
- Optional: **ffmpeg**, used by video/audio features (stitching clips,
  extracting frames, adding music). When it's missing, interactive setup offers
  to install it via your system package manager (Homebrew / winget / apt / dnf /
  pacman); otherwise it prints manual instructions. It is never installed
  automatically under `--yes`, `sudo`, or a non-interactive shell.

## How it works

1. For explicit local-only runs like `--only=codex`, first checks that at least one selected local runtime is detected.
2. Picks the skill version: runs `npm view @sogni-ai/sogni-creative-agent-skill dist-tags.latest` and prints the answer, or uses `--version=X.Y.Z` without asking npm. The lookup fails hard if npm errors, returns something other than a valid version, or has not answered after 90 seconds. `--dry-run` also does this read-only lookup, so its plan shows the version a real run would install.
3. Runs `npm install -g @sogni-ai/sogni-creative-agent-skill@<that version>`.
4. Resolves the global install path via `npm root -g` and checks that the package there is the chosen version.
5. If started with `sudo`, drops back to the original user before touching files in your home directory.
6. Detects `~/.claude/`, `~/.codex/`, `~/.hermes/`, and the Claude Desktop config file (`claude_desktop_config.json`); treats ChatGPT (web) as always available (manual setup).
7. For each detected local runtime, dispatches to a per-runtime adapter that knows that runtime's directory convention.
8. Records the installed version in a marker file (`.sogni-installed.json`; Claude Desktop keeps it in its MCP server entry). Re-runs upgrade older installs in place and leave installs already at that version untouched.
9. Prompts for your Sogni API key when local CLI use needs one (unless `SOGNI_API_KEY` is set or `~/.config/sogni/credentials` already exists). ChatGPT-only setup skips this local credentials step.

## License

MIT
