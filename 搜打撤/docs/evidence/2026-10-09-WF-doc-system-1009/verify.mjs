import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(evidence, '../../..');
const before = JSON.parse(readFileSync(path.join(evidence, 'before.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFileSync(path.resolve(project, file), 'utf8');
const changed = before.documents.filter(item => sha256(readFileSync(path.resolve(project, item.file))) !== item.sha256);
const protectedFiles = before.documents.filter(item => item.kind === 'history-or-evidence'
  || ['docs/M-BATCH-MATRIX.md', 'docs/terminology.md', 'docs/game-compendium.md'].includes(item.file)
  || item.file.startsWith('docs/production/art/')
  || (item.file.startsWith('docs/character-bible/') && !item.file.endsWith('/README.md')));
const protectedChanges = protectedFiles.filter(item => sha256(readFileSync(path.resolve(project, item.file))) !== item.sha256).map(item => item.file);
const failures = [];
const checks = [];
function check(name, passed, detail) { checks.push({ name, passed, detail }); if (!passed) failures.push(name); }
check('历史原文与保护文档字节未变', protectedChanges.length === 0, { checked: protectedFiles.length, changed: protectedChanges });
const slug = heading => heading.toLowerCase().replace(/[`*_]/g, '').replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
let checkedLinks = 0, checkedAnchors = 0;
for (const item of changed.filter(item => /\.md$/.test(item.file))) {
  const content = read(item.file).replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const link = match[1].trim().replace(/^<|>$/g, '');
    if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
    if (!link.startsWith('#') && !link.includes('/') && !/\.[a-z0-9]+(?:#|$)/i.test(link)) continue;
    const [target, rawAnchor] = link.split('#');
    const absolute = target ? path.resolve(project, item.file, '..', decodeURI(target)) : path.resolve(project, item.file);
    checkedLinks++;
    if (!existsSync(absolute)) { failures.push(`${item.file}: missing ${link}`); continue; }
    if (rawAnchor && /\.md$/i.test(absolute)) {
      checkedAnchors++;
      const headings = [...readFileSync(absolute, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => slug(m[1].trim()));
      if (!headings.includes(decodeURI(rawAnchor))) failures.push(`${item.file}: missing anchor ${link}`);
    }
  }
}
check('修改文档的本地链接与标题锚点', !failures.some(f => f.includes(': missing')), { checkedLinks, checkedAnchors });
check('规则预算', statSync(path.resolve(project, '../AGENTS.md')).size <= 6144
  && ['docs/README.md', 'docs/QUICKSTART.md', 'docs/WORKFLOW-TOOLS.md', 'docs/quality-gates.md'].reduce((n, file) => n + statSync(path.resolve(project, file)).size, 0) <= 36864, {});
check('仓库上限与升级消费的源码依据', /stashMax: 100/.test(read('game/src/core/rule-config.js'))
  && /上限 100 张/.test(read('docs/rules.md')) && /stashRuneSlotFrom/.test(read('game/src/hub/base.js')), {});
check('音频曲目及播放器入口', [...read('game/src/audio/sound.music.catalog.js').matchAll(/new URL\(/g)].length === 14
  && read('docs/architecture.md').includes('sound.music.player.js'), {});
check('已删除的 Pixi 粒子入口不再写为当前模块', !read('docs/architecture.md').includes('pixi-effects.js')
  && existsSync(path.resolve(project, 'game/src/battle/view/battle.frames.js')), {});
check('空闲渲染与角色路径', !read('docs/performance.md').includes('idleFps=0')
  && read('docs/character-bible/README.md').includes('game/src/core/characters.js'), {});
const navigation = read('docs/README.md');
const routes = [
  { task: '调整仓库容量', entry: 'rules.md', source: 'game/src/core/rule-config.js' },
  { task: '替换场景配乐', entry: 'audio-system.md', source: 'game/src/audio/sound.music.catalog.js' },
  { task: '策略晋级', entry: 'agent-iteration-playbook.md', source: 'game/tools/agent-ledger.mjs' },
  { task: '存档恢复', entry: 'save-format.md', source: 'game/src/run/map-snapshot.js' },
  { task: '文档归档', entry: 'WORKFLOW-TOOLS.md', source: '../AGENTS.md' },
];
check('五项实际任务的导航与源码可定位', routes.every(r => navigation.includes(r.entry)
  && existsSync(path.resolve(project, 'docs', r.entry)) && existsSync(path.resolve(project, r.source))), routes);
const report = { recordedAt: new Date().toISOString(), ok: failures.length === 0, checks, failures,
  changedDocuments: changed.map(item => item.file),
  limits: ['人工选择的文档事实与任务路由检查，不证明全部玩法数值或游戏运行', '历史按字节保护，未逐篇重审历史结论', '其他会话占用文件只核对字节，未做正文修改'] };
writeFileSync(path.join(evidence, 'review-checks.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ ok: report.ok, checks: checks.length, changedDocuments: changed.length, failures }));
if (!report.ok) process.exitCode = 1;
