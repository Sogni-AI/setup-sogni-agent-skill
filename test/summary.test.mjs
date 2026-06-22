import { test } from 'node:test';
import assert from 'node:assert/strict';
import { printSummary } from '../src/summary.mjs';

function captureSummary(args) {
  const lines = [];
  const original = console.log;
  console.log = (line = '') => { lines.push(String(line)); };
  try {
    printSummary(args);
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

test('install summary suggests trying the CLI', () => {
  const out = captureSummary({
    adapterResults: [],
    cli: { skipped: false, spec: '@sogni-ai/sogni-creative-agent-skill@latest' },
    credentials: { action: 'skipped-env' },
  });
  assert.match(out, /Try it: sogni-agent --version/);
  assert.match(out, /Generate an image/);
});

test('ChatGPT-only summary points to Custom-GPT setup, not local CLI use', () => {
  const out = captureSummary({
    adapterResults: [{ label: 'ChatGPT (web)', status: 'instructions' }],
    cli: { skipped: false, spec: '@sogni-ai/sogni-creative-agent-skill@latest' },
    credentials: { action: 'skipped-chatgpt' },
  });
  assert.match(out, /Use the printed Custom-GPT instructions/);
  assert.doesNotMatch(out, /Try it: sogni-agent --version/);
});

test('uninstall summary suggests restarting agent sessions, not trying CLI', () => {
  const out = captureSummary({
    adapterResults: [{ label: 'OpenAI Codex CLI', status: 'removed', target: '/tmp/skill' }],
    cli: null,
    credentials: null,
  });
  assert.match(out, /Restart any open agent sessions/);
  assert.doesNotMatch(out, /Try it: sogni-agent --version/);
});

test('purge summary highlights backup path and API-key sensitivity', () => {
  const out = captureSummary({
    adapterResults: [],
    cli: null,
    credentials: null,
    purge: {
      status: 'purged',
      backup: '/tmp/sogni.backup.tar.gz',
      removed: '/tmp/sogni',
    },
  });
  assert.match(out, /Backup saved at \/tmp\/sogni\.backup\.tar\.gz/);
  assert.match(out, /contains your API key/);
  assert.doesNotMatch(out, /Try it: sogni-agent --version/);
});
