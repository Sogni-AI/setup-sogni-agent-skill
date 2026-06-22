import kleur from 'kleur';

const STATUS_ICONS = {
  installed: kleur.green('→ installed'),
  upgraded: kleur.green('→ upgraded'),
  'up-to-date': kleur.gray('→ up-to-date'),
  'would-install': kleur.cyan('→ would install (dry-run)'),
  'would-print': kleur.cyan('→ would print (dry-run)'),
  instructions: kleur.cyan('→ instructions printed'),
  skipped: kleur.gray('→ skipped'),
  failed: kleur.red('→ failed'),
  removed: kleur.yellow('→ removed'),
};

function nextSteps({ adapterResults, cli, credentials, purge }) {
  if (purge?.status === 'purged') {
    return [
      `Backup saved at ${purge.backup}`,
      'The backup contains your API key; delete it when you no longer need it.',
    ];
  }
  if (purge?.status === 'failed') {
    return [
      'Data was not removed. Back up ~/.config/sogni/ manually before retrying.',
    ];
  }

  const installed = adapterResults.some((r) => ['installed', 'upgraded', 'up-to-date'].includes(r.status));
  const instructions = adapterResults.some((r) => r.status === 'instructions');
  const removed = adapterResults.some((r) => r.status === 'removed');
  const cliInstalled = cli && !cli.skipped;

  if (instructions && !installed) {
    return [
      'Use the printed Custom-GPT instructions in https://chatgpt.com/gpts/editor',
      'Add your Sogni API key inside the ChatGPT Action configuration.',
    ];
  }

  if (installed || cliInstalled) {
    const steps = ['Try it: sogni-agent --version'];
    if (credentials?.action === 'skipped-user' || credentials?.action === 'skipped-flag') {
      steps.push('Add your API key later at ~/.config/sogni/credentials');
    }
    steps.push('Ask your agent: "Generate an image of a sunset over mountains"');
    steps.push('Docs: https://github.com/Sogni-AI/sogni-creative-agent-skill');
    return steps;
  }

  if (removed) {
    return [
      'Restart any open agent sessions so they stop listing the removed skill.',
      'To reinstall later, run: npx setup-sogni-agent-skill',
    ];
  }

  return ['Docs: https://github.com/Sogni-AI/sogni-creative-agent-skill'];
}

export function printSummary({ adapterResults, cli, credentials, purge = null }) {
  console.log('');
  console.log(kleur.bold('Done.'));
  for (const r of adapterResults) {
    const status = STATUS_ICONS[r.status] ?? r.status;
    const ver = r.previousVersion
      ? `${r.previousVersion} → ${r.version}`
      : r.version
        ? ` ${r.version}`
        : '';
    const path = r.target ?? '';
    console.log(`  ${r.label.padEnd(16)} ${path.padEnd(60)} ${status}${ver ? ' ' + ver : ''}`);
  }
  if (cli) {
    const status = cli.skipped ? STATUS_ICONS.skipped : STATUS_ICONS.installed;
    console.log(`  ${'CLI'.padEnd(16)} ${(cli.spec ?? '(skipped)').padEnd(60)} ${status}`);
  }
  if (credentials) {
    const map = {
      written: kleur.green('saved to ' + credentials.path),
      'skipped-env': kleur.gray('using SOGNI_API_KEY env'),
      'skipped-file': kleur.gray('already configured'),
      'skipped-user': kleur.yellow('skipped — set later via ~/.config/sogni/credentials'),
      'skipped-flag': kleur.gray('skipped (--no-credentials)'),
      'skipped-chatgpt': kleur.gray('not needed for ChatGPT Custom-GPT instructions'),
    };
    console.log(`  ${'API key'.padEnd(16)} ${''.padEnd(60)} ${map[credentials.action] ?? credentials.action}`);
  }
  if (purge) {
    const map = {
      purged: kleur.yellow(`backed up to ${purge.backup}, removed`),
      'would-purge': kleur.cyan(`would back up to ${purge.backup} and remove (dry-run)`),
      cancelled: kleur.gray('cancelled — data kept'),
      skipped: kleur.gray('not found — nothing to remove'),
      failed: kleur.red('backup failed — data NOT removed'),
    };
    const target = purge.removed ?? '~/.config/sogni/';
    console.log(`  ${'Data'.padEnd(16)} ${target.padEnd(60)} ${map[purge.status] ?? purge.status}`);
  }
  console.log('');
  console.log('Next steps:');
  for (const step of nextSteps({ adapterResults, cli, credentials, purge })) {
    console.log(`  - ${step}`);
  }
}
