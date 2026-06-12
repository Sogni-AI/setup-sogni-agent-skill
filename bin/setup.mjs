#!/usr/bin/env node
import { parseFlags } from '../src/flags.mjs';
import { run } from '../src/run.mjs';

const HELP = `setup-sogni-agent-skill — install Sogni Creative Agent Skill into your agent runtimes

Usage:
  npx setup-sogni-agent-skill [options]

Options:
  --yes, -y                       Skip confirmation prompts
  --dry-run                       Detect + print plan, do not write
  --only=claude,codex,hermes,chatgpt
                                  Restrict to listed runtimes
  --exclude=chatgpt               Exclude listed runtimes
  --version=X.Y.Z                 Pin the skill package version (default: latest)
  --hermes-category=NAME          Hermes category directory (default: media)
  --symlink                       (Unix) Symlink rather than copy where supported
  --no-credentials                Skip the API key prompt
  --output-chatgpt-bundle=PATH    Also write Custom-GPT instructions to a file
  --uninstall                     Remove previously installed skill files
  --remove-cli                    With --uninstall, also npm uninstall -g
  --purge                         Remove ~/.config/sogni/ (data) after a tar backup
  --no-ui                         Plain output — no banner/spinner animations
                                  (also auto-disabled when piped or NO_COLOR is set)
  --boring                        Alias for --no-ui
  --help, -h                      Show this help

Docs: https://github.com/Sogni-AI/sogni-creative-agent-skill
`;

const argv = process.argv.slice(2);

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(HELP);
  process.exit(0);
}

let flags;
try {
  flags = parseFlags(argv);
} catch (err) {
  console.error(err.message);
  console.error('Run with --help for usage.');
  process.exit(2);
}

try {
  const { exitCode } = await run(flags);
  process.exit(exitCode);
} catch (err) {
  if (err.kind === 'permission') {
    // installCli already printed a friendly, formatted explanation.
    process.exit(1);
  }
  console.error('setup-sogni-agent-skill failed:', err.message);
  process.exit(1);
}
