import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS } from '../../../game/src/core/characters.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const hashFile = file => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
const before = JSON.parse(readFileSync(path.join(here, 'before.json'), 'utf8'));
const checks = [];
const check = (name, passed, detail) => checks.push({ name, passed, detail });
const ids = text => [...text.matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
const oldMatrix = readFileSync(path.join(here, 'originals/docs/M-BATCH-MATRIX.md'), 'utf8');
const currentMatrix = read('docs/M-BATCH-MATRIX.md');
check('原迁移集合与稳定 id 保持', ids(currentMatrix).length === 150 && new Set(ids(currentMatrix)).size === 150
  && JSON.stringify(ids(currentMatrix)) === JSON.stringify(ids(oldMatrix)), { targetCount: ids(currentMatrix).length });
const profileResults = CHARACTERS.map(character => {
  const profile = read(`docs/character-bible/${character.id}.md`);
  return { id: character.id, metadata: [`| id | \`${character.id}\` |`, `| 名字 | ${character.name} |`,
    `| 职业 | ${character.rulesetId} |`, `| 主题色 | \`${character.color}\` |`].every(text => profile.includes(text)),
    referenceMatchesRuntime: hashFile(`docs/character-bible/ref-images/${character.id}.webp`) === hashFile(`game/assets/portraits/full/${character.id}.webp`) };
});
check('五角色元数据与参考副本', profileResults.every(result => result.metadata && result.referenceMatchesRuntime), profileResults);
check('他会话美术简报原文保留', hashFile('docs/production/art/ART-DIRECTION-BRIEF.md')
  === before.records.find(item => item.file === 'docs/production/art/ART-DIRECTION-BRIEF.md').sha256, {});
check('当前方向与历史配方分层', read('docs/production/art/VISUAL-BIBLE.md').includes('完整轮廓')
  && read('docs/production/art/VISUAL-BIBLE.md').includes('本地 NAI 工具参考')
  && !read('docs/production/art/VISUAL-BIBLE.md').includes('本轮及后续沿用该指令'), {});
const portraitSizes = JSON.parse(readFileSync(path.join(here, 'portrait-sizes.json'), 'utf8').replace(/^\uFEFF/, ''));
check('立绘尺寸与文档对应', portraitSizes.find(p => p.id === 'wu').width === 1024
  && portraitSizes.find(p => p.id === 'wu').height === 1536
  && portraitSizes.filter(p => p.id !== 'wu').every(p => p.width === 2560 && p.height === 1440)
  && read('docs/production/art/VISUAL-BIBLE.md').includes('1024×1536'), portraitSizes);
const book = read('docs/game-compendium.md');
const preview = readFileSync(path.join(here, 'game-compendium-preview.md'), 'utf8');
check('正式图鉴与已核对预览一致', book === preview && !book.includes('骰子面数')
  && !book.includes('game/src/battle/combat.js'), { cards: book.match(/全书卡牌共 \*\*(\d+)/)?.[1] });
const sourcePaths = [...book.matchAll(/`(game\/src\/[^`]+\.js)`/g)].map(match => match[1]);
check('图鉴机制引用可定位', sourcePaths.every(file => existsSync(path.join(root, file))), { sourcePaths });
const docPaths = ['docs/README.md', 'docs/STATUS.md', 'docs/cards/README.md', 'docs/terminology.md', 'docs/M-BATCH-MATRIX.md',
  'docs/production/art/VISUAL-BIBLE.md', 'docs/character-bible/README.md', ...CHARACTERS.map(c => `docs/character-bible/${c.id}.md`)];
const missing = [];
let checkedLinks = 0;
for (const file of docPaths) {
  const text = read(file).replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1].trim().split('#')[0];
    if (!href || /^[a-z][a-z0-9+.-]*:/i.test(href) || (!href.includes('/') && !/\.[a-z0-9]+$/i.test(href))) continue;
    checkedLinks++;
    if (!existsSync(path.resolve(root, file, '..', decodeURI(href)))) missing.push({ file, href });
  }
}
check('本轮文档相对链接', missing.length === 0, { checkedLinks, missing });
const result = { recordedAt: new Date().toISOString(), ok: checks.every(item => item.passed), checks,
  limits: ['字段、来源、生成快照与文档职责核对；不证明全部卡牌行为或游戏实页', '没有图像生成、替换或新的审美认可'] };
writeFileSync(path.join(here, 'review-checks.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
