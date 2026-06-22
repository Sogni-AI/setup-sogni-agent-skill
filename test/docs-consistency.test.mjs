import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (relativePath) => readFileSync(join(repoRoot, relativePath), 'utf8');

test('public package metadata does not imply ChatGPT instructions print by default', () => {
  const description = JSON.parse(read('package.json')).description;

  assert.match(description, /on request/i);
  assert.doesNotMatch(description, /and prints ChatGPT Custom-GPT instructions/i);
});

test('ChatGPT setup docs point users at the explicit setup mode', () => {
  const readme = read('README.md');

  assert.match(readme, /npx setup-sogni-agent-skill --only=chatgpt/);
  assert.match(readme, /not printed by default/i);
});
