// Godot 批次 4a：从编译产物提取 10 个事件结点的「网页版实跑预期值」
//（intro + 每选项 label/effect/detail/tone），逻辑与 搜打撤/game/src/narrative.js
// eventNarrative/parseChoice 完全一致，供 tests/Narrative 硬编码期望表对齐与比对。
// events.ink 变更后：先跑 compile-narrative.mjs，再跑本脚本刷新预期值。
// 用法：node SoudacheGodot/tools/ink/extract-expected.mjs
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsInkDir = path.dirname(fileURLToPath(import.meta.url));
const godotRoot = path.resolve(toolsInkDir, '..', '..');
const repoRoot = path.resolve(godotRoot, '..');
const storyJsonPath = path.join(godotRoot, 'data', 'narrative-events.ink.json');
const outputPath = path.join(toolsInkDir, 'expected-events.tmp.json');

const webRequire = createRequire(path.join(repoRoot, '搜打撤', 'package.json'));
const { Story } = webRequire('inkjs'); // 消费端与网页版同为 inkjs 2.4.0

// 与 搜打撤/game/src/narrative.js 逐行同构
function parseChoice(text) {
  const [label, ...parts] = String(text || '').split('@@');
  const metadata = Object.fromEntries(parts.map(part => {
    const at = part.indexOf('=');
    return at < 0 ? [part.trim(), ''] : [part.slice(0, at).trim(), part.slice(at + 1).trim()];
  }));
  return { label: label.trim(), effect: metadata.effect || '', detail: metadata.detail || '', tone: metadata.tone || '' };
}

const KNOTS = Object.entries({
  'tt6-timeskip': 'tt6_timeskip',
  'tt6-demondeal': 'tt6_demondeal',
  'tt6-bandits': 'tt6_bandits',
  'tt6-goldmine': 'tt6_goldmine',
  'tt6-mystery': 'tt6_mystery',
  'tt6-goldhammer': 'tt6_goldhammer',
  'tt6-relief': 'tt6_relief',
  'tt6-airdrop': 'tt6_airdrop',
  'tt6-chestdraw': 'tt6_chestdraw',
  'tt6-systemsupply': 'tt6_systemsupply',
});

const storyContent = JSON.parse(await readFile(storyJsonPath, 'utf8'));
const out = {};
for (const [cardId, knot] of KNOTS) {
  const story = new Story(storyContent);
  story.ChoosePathString(knot);
  const intro = story.ContinueMaximally().trim();
  out[cardId] = { knot, intro, choices: story.currentChoices.map(c => parseChoice(c.text)) };
}
await writeFile(outputPath, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
console.log(`Extracted expected values for ${KNOTS.length} events -> ${path.relative(repoRoot, outputPath)}`);
