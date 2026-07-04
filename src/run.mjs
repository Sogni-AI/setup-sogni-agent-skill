import kleur from 'kleur';
import prompts from 'prompts';
import claudeCode from './adapters/claude-code.mjs';
import claudeDesktop from './adapters/claude-desktop.mjs';
import codexCli from './adapters/codex-cli.mjs';
import hermes from './adapters/hermes.mjs';
import chatgptWeb from './adapters/chatgpt-web.mjs';
import { detectAll } from './detect.mjs';
import { formatElevatedSetupCommand, installCli, isPermissionError } from './install-cli.mjs';
import { resolveSkillSource } from './resolve-skill.mjs';
import { ensureCredentials } from './credentials.mjs';
import { runPurge } from './purge.mjs';
import { offerFfmpegInstall } from './check-ffmpeg.mjs';
import { printSummary } from './summary.mjs';
import { uiEnabled, introSplash, LivePhase, finale, rainbowText } from './ui.mjs';
import { dropSudoPrivilegesForUser, isSudoRoot } from './sudo.mjs';

const ADAPTERS = {
  'claude-code': { adapter: claudeCode, label: 'Claude Code', shortKey: 'claude' },
  'claude-desktop': { adapter: claudeDesktop, label: 'Claude Desktop', shortKey: 'desktop' },
  'codex-cli': { adapter: codexCli, label: 'OpenAI Codex CLI', shortKey: 'codex' },
  'hermes': { adapter: hermes, label: 'Hermes Agent', shortKey: 'hermes' },
  'chatgpt-web': { adapter: chatgptWeb, label: 'ChatGPT (web)', shortKey: 'chatgpt' },
};

function filterByFlags(detections, { only, exclude }) {
  return detections.filter(d => {
    const meta = ADAPTERS[d.runtime];
    // Runtimes can be detected before their adapter is registered (e.g. new
    // runtimes land detection-first); skip them rather than crash.
    if (!meta) return false;
    const key = meta.shortKey;
    if (only && !only.includes(key)) return false;
    if (exclude && exclude.includes(key)) return false;
    return true;
  });
}

function printDetectionTable(filtered, version, { chatgptRequested = false, fx = false } = {}) {
  console.log('');
  console.log(fx ? rainbowText('Detected runtimes:', 160, { spread: 6 }) : kleur.bold('Detected runtimes:'));
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

function dropSudoForUserFiles() {
  const sudoDrop = dropSudoPrivilegesForUser();
  if (sudoDrop.dropped) {
    console.log(kleur.gray(`Continuing setup as ${sudoDrop.user} in ${sudoDrop.home}.`));
  }
  return sudoDrop;
}

function selectedLocalRuntimes(filtered) {
  return filtered.filter(d => d.runtime !== 'chatgpt-web' && d.status === 'available');
}

function isChatgptRequested(flags) {
  return Boolean(
    (flags.only && flags.only.includes('chatgpt')) || flags.outputChatgptBundle
  );
}

export async function run(flags) {
  if (flags.uninstall) {
    return runUninstall(flags);
  }
  if (flags.purge) {
    return runPurgeOnly(flags);
  }

  const fx = uiEnabled(flags);
  await introSplash({ enabled: fx });

  const preflightChatgptRequested = isChatgptRequested(flags);
  if (!flags.dryRun && !isSudoRoot() && flags.only && !preflightChatgptRequested) {
    const preflightFiltered = filterByFlags(detectAll(), flags);
    if (selectedLocalRuntimes(preflightFiltered).length === 0) {
      printDetectionTable(preflightFiltered, flags.version, { chatgptRequested: false, fx });
      console.log(kleur.yellow('No selected local agent runtimes found. Nothing was installed.'));
      console.log('Run the target agent once so it creates its config directory, then re-run this command.');
      console.log('For ChatGPT Custom-GPT instructions instead, run `npx setup-sogni-agent-skill --only=chatgpt`.');
      return { cli: null, adapterResults: [], credentials: null, exitCode: 1 };
    }
  }

  // 1. Install the global CLI (writes nothing else yet). A dry run must not
  // mutate the system either, so the global install is skipped too.
  let cli;
  let elevatedSkill = null;
  if (flags.dryRun) {
    console.log(kleur.cyan(`Dry run — skipping global CLI install (would run: npm install -g @sogni-ai/sogni-creative-agent-skill@${flags.version}).`));
    cli = { skipped: true, reason: 'dry-run' };
  } else {
    console.log(kleur.bold(`Installing @sogni-ai/sogni-creative-agent-skill@${flags.version} globally...`));
    const live = new LivePhase(fx);
    live.start('npm is fetching the skill package…');
    try {
      cli = await installCli({ version: flags.version, quiet: fx });
    } finally {
      live.stop();
    }
    if (fx && !cli.skipped) {
      console.log(`  ${kleur.green('✓')} installed ${cli.spec}`);
    }
    if (!cli.skipped && isSudoRoot()) {
      elevatedSkill = resolveSkillSource();
    }
  }

  dropSudoForUserFiles();

  // 1b. Offer ffmpeg (interactive installs only) — used by clip merging and frame extraction.
  await offerFfmpegInstall({ interactive: !flags.yes && !isSudoRoot() });

  // 2. Resolve skill source on disk. Under --dry-run the package may not be
  // installed globally yet — fall back to the requested version for display.
  let skill;
  if (elevatedSkill) {
    skill = elevatedSkill;
  } else {
    try {
      skill = resolveSkillSource();
    } catch (err) {
      if (!flags.dryRun) throw err;
      skill = { srcDir: null, version: flags.version };
    }
  }

  // 3. Detect runtimes and filter.
  const all = detectAll();
  const filtered = filterByFlags(all, flags);

  // The full Custom-GPT instructions embed the entire SKILL.md — only dump
  // them to the terminal when the user explicitly asked for the ChatGPT path.
  const chatgptRequested = isChatgptRequested(flags);
  const localInstallable = selectedLocalRuntimes(filtered);
  const chatgptTarget = filtered.find(d => d.runtime === 'chatgpt-web');
  const adapterTargets = [
    ...localInstallable,
    ...(chatgptTarget && chatgptRequested ? [chatgptTarget] : []),
  ];

  printDetectionTable(filtered, skill.version, { chatgptRequested, fx });

  if (flags.dryRun) {
    console.log(kleur.cyan('Dry run — nothing will be written.'));
    return { cli, adapterResults: [], credentials: null, exitCode: 0 };
  }

  if (localInstallable.length === 0 && !chatgptRequested) {
    const scoped = flags.only ? 'No selected local agent runtimes found.' : 'No local agent runtimes found.';
    console.log(kleur.yellow(`${scoped} CLI still installed; run --only=chatgpt for ChatGPT Custom-GPT instructions.`));
  } else if (localInstallable.length > 0 && !flags.yes) {
    const targets = localInstallable.map(d => ADAPTERS[d.runtime].label).join(', ');
    if (!(await confirm(`Install / upgrade Sogni Creative Agent Skill into ${targets}?`))) {
      console.log('Aborted.');
      return { cli, adapterResults: [], credentials: null, exitCode: 1 };
    }
  }

  // 4. Run adapters.
  const adapterResults = [];
  let failures = 0;
  for (const d of adapterTargets) {
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
  const credentials = localInstallable.length === 0 && chatgptRequested
    ? { action: 'skipped-chatgpt' }
    : await ensureCredentials({ skipPrompt: flags.noCredentials });

  // 6. Summary.
  printSummary({ adapterResults, cli, credentials });
  if (failures === 0) await finale({ enabled: fx });

  return { cli, adapterResults, credentials, exitCode: failures > 0 ? failures : 0 };
}

async function runPurgeOnly(flags) {
  dropSudoForUserFiles();
  const purge = await runPurge({ yes: flags.yes, dryRun: flags.dryRun });
  printSummary({ adapterResults: [], cli: null, credentials: null, purge });
  return { exitCode: purge.status === 'failed' ? 1 : 0 };
}

async function removeGlobalCli() {
  console.log('Removing global CLI...');
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('npm', ['uninstall', '-g', '@sogni-ai/sogni-creative-agent-skill'], {
    encoding: 'utf8',
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  if (r.error?.code === 'ENOENT') {
    throw new Error('npm not found on PATH. Install Node.js from https://nodejs.org and re-run.');
  }
  if (r.status !== 0) {
    const stderr = r.stderr ?? '';
    if (stderr) process.stderr.write(stderr);
    if (isPermissionError(stderr)) {
      console.error('');
      console.error(kleur.red().bold('Could not remove the global CLI — npm needs admin rights.'));
      console.error('');
      console.error('Re-run the same uninstall command with admin rights:');
      console.error(`  ${kleur.gray('$')} ${formatElevatedSetupCommand(process.argv.slice(2))}`);
      console.error('');
      const err = new Error('npm uninstall -g @sogni-ai/sogni-creative-agent-skill failed: permission denied. See instructions above.');
      err.kind = 'permission';
      throw err;
    }
    throw new Error(`npm uninstall -g @sogni-ai/sogni-creative-agent-skill failed with exit code ${r.status}.`);
  }
}

async function runUninstall(flags) {
  if (flags.removeCli) {
    await removeGlobalCli();
  }

  dropSudoForUserFiles();

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
  let purge = null;
  if (flags.purge) {
    purge = await runPurge({ yes: flags.yes, dryRun: flags.dryRun });
  }
  printSummary({ adapterResults: results, cli: null, credentials: null, purge });
  return { exitCode: purge?.status === 'failed' ? 1 : 0 };
}
