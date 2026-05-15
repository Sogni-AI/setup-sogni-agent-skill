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
- **OpenAI Codex CLI** — installs into `~/.codex/skills/sogni-creative-agent-skill/`
- **Hermes Agent** — installs into `~/.hermes/skills/<category>/sogni-creative-agent-skill/`
- **ChatGPT (web)** — prints Custom GPT instructions for copy-paste

## Usage

```bash
# Interactive (default)
npx setup-sogni-agent-skill

# Non-interactive (CI)
npx setup-sogni-agent-skill --yes --no-credentials

# Restrict to specific runtimes
npx setup-sogni-agent-skill --only=claude,codex

# Dry run
npx setup-sogni-agent-skill --dry-run

# Pin a specific skill version
npx setup-sogni-agent-skill --version=2.3.0

# Uninstall
npx setup-sogni-agent-skill --uninstall
npx setup-sogni-agent-skill --uninstall --remove-cli   # also remove the global CLI
```

Run `npx setup-sogni-agent-skill --help` for the full flag list.

## Requirements

- Node.js ≥ 22
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
