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

export function printSummary({ adapterResults, cli, credentials }) {
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
    };
    console.log(`  ${'API key'.padEnd(16)} ${''.padEnd(60)} ${map[credentials.action] ?? credentials.action}`);
  }
  console.log('');
  console.log('Next steps:');
  console.log('  - Try it: sogni-agent --version');
  console.log('  - Ask your agent: "Generate an image of a sunset over mountains"');
  console.log('  - Docs: https://github.com/Sogni-AI/sogni-creative-agent-skill');
}
