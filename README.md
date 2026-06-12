# setup-sogni-agent-skill

One-command installer for the [Sogni Creative Agent Skill](https://github.com/Sogni-AI/sogni-creative-agent-skill).

```bash
npx setup-sogni-agent-skill
```

Detects which agent runtimes you have installed, installs the `sogni-agent`
CLI globally, registers `SKILL.md` into each detected runtime, and prompts
for your Sogni API key.

## Supports

- **Claude Code** — installs into `~/.claude/skills/sogni-creative-agent-skill/`
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
npx setup-sogni-agent-skill --only=claude,codex

# Print ChatGPT Custom-GPT instructions (not printed by default)
npx setup-sogni-agent-skill --only=chatgpt

# Dry run
npx setup-sogni-agent-skill --dry-run

# Pin a specific skill version
npx setup-sogni-agent-skill --version=2.3.0

# Uninstall
npx setup-sogni-agent-skill --uninstall
npx setup-sogni-agent-skill --uninstall --remove-cli   # also remove the global CLI

# Plain output (no animated banner / spinner)
npx setup-sogni-agent-skill --no-ui
```

Run `npx setup-sogni-agent-skill --help` for the full flag list.

Interactive runs open with an animated SOGNI banner, show a spinner while npm
works, and end with a starburst. The animations are pure ANSI (no extra
dependencies) and switch themselves off when output is piped, when `NO_COLOR`
is set, or with `--no-ui` / `--boring`.

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

## How it works

1. Runs `npm install -g @sogni-ai/sogni-creative-agent-skill@latest`.
2. Resolves the global install path via `npm root -g`.
3. Detects `~/.claude/`, `~/.codex/`, `~/.hermes/`; treats ChatGPT (web) as always available (manual setup).
4. For each runtime, dispatches to a per-runtime adapter that knows that runtime's directory convention.
5. Writes a marker file (`.sogni-installed.json`) so re-runs upgrade in place.
6. Prompts for your Sogni API key (unless `SOGNI_API_KEY` is set or `~/.config/sogni/credentials` already exists).

## License

MIT
