import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function buildInstructions({ srcDir, version }) {
  const skillContent = readFileSync(join(srcDir, 'SKILL.md'), 'utf8');
  return `# Sogni Creative Agent — ChatGPT Custom GPT setup (v${version})

ChatGPT (web) has no local install path. To use the Sogni Creative Agent
with a Custom GPT, follow these steps:

1. Open the Custom GPT editor: https://chatgpt.com/gpts/editor
2. Click "Create" then "Configure".
3. Use these values:

   Name: Sogni Creative Agent
   Description: Image, video, and music generation via Sogni AI.
   Instructions:
${skillContent.split('\n').map(l => '   ' + l).join('\n')}

4. Under "Actions", add the Sogni API (see https://dashboard.sogni.ai for an API key
   and the latest OpenAPI schema). The sogni-agent CLI is not available in the web
   sandbox, so the GPT must call the API directly.

5. Save & publish.

(For local agents — Claude Code, Codex CLI, Hermes — \`npx setup-sogni-agent-skill\`
installs the skill automatically.)

(Skill repo: https://github.com/Sogni-AI/sogni-creative-agent-skill)
`;
}

export default {
  name: 'chatgpt-web',

  detect() {
    return { found: true, path: null, installedVersion: null };
  },

  install({ srcDir, version, outputBundle = null, dryRun = false }) {
    const instructions = buildInstructions({ srcDir, version });
    if (dryRun) return { status: 'would-print', written: [], instructions, notes: [] };
    const written = [];
    if (outputBundle) {
      writeFileSync(outputBundle, instructions);
      written.push(outputBundle);
    }
    return { status: 'instructions', written, instructions, notes: [] };
  },

  uninstall() {
    return { removed: [] };
  },
};
