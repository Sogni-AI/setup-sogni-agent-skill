import kleur from 'kleur';
import prompts from 'prompts';
import claudeCode from './adapters/claude-code.mjs';
import codexCli from './adapters/codex-cli.mjs';
import hermes from './adapters/hermes.mjs';
import chatgptWeb from './adapters/chatgpt-web.mjs';
import { detectAll } from './detect.mjs';
import { installCli } from './install-cli.mjs';
import { resolveSkillSource } from './resolve-skill.mjs';
import { ensureCredentials } from './credentials.mjs';
import { runPurge } from './purge.mjs';
import { recommendFfmpeg } from './check-ffmpeg.mjs';
import { printSummary } from './summary.mjs';

const ADAPTERS = {
  'claude-code': { adapter: claudeCode, label: 'Claude Code', shortKey: 'claude' },
  'codex-cli': { adapter: codexCli, label: 'OpenAI Codex CLI', shortKey: 'codex' },
  'hermes': { adapter: hermes, label: 'Hermes Agent', shortKey: 'hermes' },
  'chatgpt-web': { adapter: chatgptWeb, label: 'ChatGPT (web)', shortKey: 'chatgpt' },
};

function filterByFlags(detections, { only, exclude }) {
  return detections.filter(d => {
    const key = ADAPTERS[d.runtime].shortKey;
    if (only && !only.includes(key)) return false;
    if (exclude && exclude.includes(key)) return false;
    return true;
  });
}

function printDetectionTable(filtered, version, { chatgptRequested = false } = {}) {
  console.log('');
  console.log(kleur.bold('Detected runtimes:'));
  for (const d of filtered) {
    const meta = ADAPTERS[d.runtime];
    const path = d.path ?? 'manual setup';
    const state = d.runtime === 'chatgpt-web'
      ? (chatgptRequested ? 'instructions will be printed' : 'instructions on request (--only=chatgpt)')
      : d.status === 'not-found'
        ? kleur.gray('not found')
        : d.installedVersion
          ? d.installedVersion === version
            ? kleur.gray(`v${d.installedVersion} — up-to-date, will re-verify`)
            : kleur.yellow(`v${d.installedVersion} → ${version}`)
          : kleur.green('(no skill installed)');
    const icon = d.runtime === 'chatgpt-web' ? 'ⓘ' : d.status === 'not-found' ? '✗' : '✓';
    console.log(`  ${icon} ${meta.label.padEnd(20)} ${path.padEnd(35)} ${state}`);
  }
  console.log('');
}

async function confirm(message, { defaultYes = true } = {}) {
  const { ok } = await prompts({
    type: 'confirm',
    name: 'ok',
    message,
    initial: defaultYes,
  });
  return ok === true;
}

export async function run(flags) {
  if (flags.uninstall) {
    return runUninstall(flags);
  }
  if (flags.purge) {
    return runPurgeOnly(flags);
  }

  // 1. Install the global CLI (writes nothing else yet). A dry run must not
  // mutate the system either, so the global install is skipped too.
  let cli;
  if (flags.dryRun) {
    console.log(kleur.cyan(`Dry run — skipping global CLI install (would run: npm install -g @sogni-ai/sogni-creative-agent-skill@${flags.version}).`));
    cli = { skipped: true, reason: 'dry-run' };
  } else {
    console.log(kleur.bold(`Installing @sogni-ai/sogni-creative-agent-skill@${flags.version} globally...`));
    cli = installCli({ version: flags.version });
  }

  // 1b. Recommend ffmpeg (non-blocking) — used by clip merging and frame extraction.
  recommendFfmpeg();

  // 2. Resolve skill source on disk. Under --dry-run the package may not be
  // installed globally yet — fall back to the requested version for display.
  let skill;
  try {
    skill = resolveSkillSource();
  } catch (err) {
    if (!flags.dryRun) throw err;
    skill = { srcDir: null, version: flags.version };
  }

  // 3. Detect runtimes and filter.
  const all = detectAll();
  const filtered = filterByFlags(all, flags);
  const installable = filtered.filter(d => d.status === 'available');

  // The full Custom-GPT instructions embed the entire SKILL.md — only dump
  // them to the terminal when the user explicitly asked for the ChatGPT path.
  const chatgptRequested = Boolean(
    (flags.only && flags.only.includes('chatgpt')) || flags.outputChatgptBundle
  );

  printDetectionTable(filtered, skill.version, { chatgptRequested });

  if (flags.dryRun) {
    console.log(kleur.cyan('Dry run — nothing will be written.'));
    return { cli, adapterResults: [], credentials: null, exitCode: 0 };
  }

  if (installable.length === 0) {
    console.log(kleur.yellow('No agent runtimes found. CLI still installed; run --only=chatgpt for ChatGPT Custom-GPT instructions.'));
  } else if (!flags.yes) {
    const targets = installable.map(d => ADAPTERS[d.runtime].label).join(', ');
    if (!(await confirm(`Install / upgrade Sogni Creative Agent Skill into ${targets}?`))) {
      console.log('Aborted.');
      return { cli, adapterResults: [], credentials: null, exitCode: 1 };
    }
  }

  // 4. Run adapters.
  const adapterResults = [];
  let failures = 0;
  for (const d of filtered) {
    const meta = ADAPTERS[d.runtime];
    try {
      const opts = {
        srcDir: skill.srcDir,
        version: skill.version,
        dryRun: false,
      };
      if (d.runtime === 'hermes') opts.category = flags.hermesCategory;
      if (d.runtime === 'chatgpt-web') opts.outputBundle = flags.outputChatgptBundle;
      const r = meta.adapter.install(opts);
      if (d.runtime === 'chatgpt-web') {
        console.log('');
        if (flags.outputChatgptBundle && r.written.length > 0) {
          console.log(kleur.green(`ChatGPT Custom-GPT instructions written to ${r.written[0]}`));
        } else if (chatgptRequested) {
          console.log(r.instructions);
        } else {
          console.log(kleur.gray(
            'ChatGPT (web): instructions not printed. Run `npx setup-sogni-agent-skill --only=chatgpt` to print the Custom-GPT setup, or --output-chatgpt-bundle=<file> to save it.'
          ));
        }
      }
      adapterResults.push({
        runtime: d.runtime,
        label: meta.label,
        status: r.status,
        version: skill.version,
        previousVersion: r.previousVersion ?? null,
        target: d.runtime === 'chatgpt-web' ? '' : (meta.adapter.detect().path ?? ''),
        notes: r.notes,
      });
    } catch (err) {
      failures += 1;
      adapterResults.push({
        runtime: d.runtime,
        label: meta.label,
        status: 'failed',
        target: '',
        notes: [err.message],
      });
    }
  }

  // 5. Credentials.
  const credentials = await ensureCredentials({ skipPrompt: flags.noCredentials });

  // 6. Summary.
  printSummary({ adapterResults, cli, credentials });

  return { cli, adapterResults, credentials, exitCode: failures > 0 ? failures : 0 };
}

async function runPurgeOnly(flags) {
  const purge = await runPurge({ yes: flags.yes, dryRun: flags.dryRun });
  printSummary({ adapterResults: [], cli: null, credentials: null, purge });
  return { exitCode: purge.status === 'failed' ? 1 : 0 };
}

async function runUninstall(flags) {
  const all = detectAll();
  const filtered = filterByFlags(all, flags);
  const results = [];
  for (const d of filtered) {
    const meta = ADAPTERS[d.runtime];
    const r = meta.adapter.uninstall();
    results.push({
      runtime: d.runtime,
      label: meta.label,
      status: r.removed.length > 0 ? 'removed' : 'skipped',
      target: r.removed[0] ?? '',
    });
  }
  if (flags.removeCli) {
    console.log('Removing global CLI...');
    const { spawnSync } = await import('node:child_process');
    spawnSync('npm', ['uninstall', '-g', '@sogni-ai/sogni-creative-agent-skill'], { stdio: 'inherit' });
  }
  let purge = null;
  if (flags.purge) {
    purge = await runPurge({ yes: flags.yes, dryRun: flags.dryRun });
  }
  printSummary({ adapterResults: results, cli: null, credentials: null, purge });
  return { exitCode: purge?.status === 'failed' ? 1 : 0 };
}
