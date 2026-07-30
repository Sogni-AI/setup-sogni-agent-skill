import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, writeFileSync as rawWrite } from 'node:fs';
import { join } from 'node:path';
import {
  HOST_LAUNCHER_NAME,
  MARKER_NAME,
  materializeSkillLauncher,
  readMarker,
  writeHostLauncher,
  writeMarker,
} from '../src/adapters/shared.mjs';
import { FIXTURE_SKILL_SRC, withTempHome } from './helpers.mjs';

test('writes and reads marker file', (t) => {
  const home = withTempHome(t);
  const dir = join(home, 'skill');
  mkdirSync(dir);
  writeMarker(dir, { version: '2.3.0', adapter: 'claude-code' });
  const m = readMarker(dir);
  assert.equal(m.version, '2.3.0');
  assert.equal(m.adapter, 'claude-code');
  assert.ok(m.installedAt);
});

test('readMarker returns null when missing', (t) => {
  const home = withTempHome(t);
  assert.equal(readMarker(home), null);
});

test('readMarker returns null on invalid JSON', (t) => {
  const home = withTempHome(t);
  const dir = join(home, 'skill');
  mkdirSync(dir);
  rawWrite(join(dir, MARKER_NAME), 'not json');
  assert.equal(readMarker(dir), null);
});

test('writes a fixed host launcher without embedding unrelated marker fields', (t) => {
  const home = withTempHome(t);
  const dir = join(home, 'skill');
  mkdirSync(dir);
  const launcherPath = writeHostLauncher(dir, {
    srcDir: FIXTURE_SKILL_SRC,
    version: '2.3.0',
    framework: 'codex',
  });
  const source = readFileSync(launcherPath, 'utf8');
  assert.equal(launcherPath, join(dir, HOST_LAUNCHER_NAME));
  assert.match(source, /SOGNI_AGENT_FRAMEWORK: "codex"/);
  assert.match(source, /SOGNI_AGENT_SURFACE: "personal_skill"/);
  assert.match(source, /SOGNI_AGENT_SURFACE_VERSION: "2\.3\.0"/);
  assert.doesNotMatch(source, /installedAt|OPENCLAW_PLUGIN_CONFIG/);
});

test('host launcher overrides spoofable parent markers and preserves CLI arguments', (t) => {
  const home = withTempHome(t);
  const srcDir = join(home, 'source');
  const skillDir = join(home, 'skill');
  mkdirSync(srcDir);
  mkdirSync(skillDir);
  rawWrite(
    join(srcDir, 'sogni-agent.mjs'),
    `process.stdout.write(JSON.stringify({
  argv: process.argv.slice(2),
  framework: process.env.SOGNI_AGENT_FRAMEWORK,
  surface: process.env.SOGNI_AGENT_SURFACE,
  version: process.env.SOGNI_AGENT_SURFACE_VERSION,
}));\n`,
  );
  const launcherPath = writeHostLauncher(skillDir, {
    srcDir,
    version: '2.3.0',
    framework: 'codex',
  });
  const result = spawnSync(process.execPath, [launcherPath, '--json', 'a red fox'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      SOGNI_AGENT_FRAMEWORK: 'spoofed-parent',
      SOGNI_AGENT_SURFACE: 'cli',
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    argv: ['--json', 'a red fox'],
    framework: 'codex',
    surface: 'personal_skill',
    version: '2.3.0',
  });
});

test('materializes launcher guidance after frontmatter without modifying it', (t) => {
  const home = withTempHome(t);
  const skillPath = join(home, 'SKILL.md');
  rawWrite(skillPath, '---\nname: test-skill\ndescription: test\n---\n\n# Test\n\nRun `sogni-agent`.\n');
  const beforeFrontmatter = '---\nname: test-skill\ndescription: test\n---';
  materializeSkillLauncher(skillPath, join(home, '.sogni-agent-launcher.mjs'));
  const materialized = readFileSync(skillPath, 'utf8');
  assert.ok(materialized.startsWith(beforeFrontmatter));
  assert.match(materialized, /Installed host command/);
  assert.match(materialized, /node ".*\.sogni-agent-launcher\.mjs"/);

  materializeSkillLauncher(skillPath, join(home, '.sogni-agent-launcher.mjs'));
  assert.equal(
    readFileSync(skillPath, 'utf8').match(/setup-sogni-agent-skill:host-launcher/g)?.length,
    1,
  );
});
