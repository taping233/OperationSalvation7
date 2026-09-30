import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve('docs/evidence/2026-09-30-full-repository-review');
const rows = JSON.parse(fs.readFileSync(path.join(out,'root/assigned.json'),'utf8')).filter(r => r.owner==='root' && r.category==='review-target');
const staticOnly = new Set(['game/src/hub/game.cardslib.designer.js','game/src/hub/battle-settlement.commands.types.d.ts','game/src/hub/game.store.types.d.ts','game/version.json']);
const systematic = new Set(['game/src/hub/game.cardslib.page.js','game/src/hub/game.cardslib.photo-fps.js','game/src/hub/game.hub.pages.js','game/src/hub/game.notes.js','game/src/run/game.session.board.js','game/src/run/game.session.map.js']);
const files = rows.map(r => {
  const depth = staticOnly.has(r.file) ? 'static-only' : systematic.has(r.file) || r.file.endsWith('.json') ? 'systematic' : 'deep';
  const review = r.file.endsWith('.json') ? '全文件JSON解析/结构索引；与现行消费者、数据门及引用核对，未逐条验证素材视觉或所有数值平衡。'
    : staticOnly.has(r.file) ? '类型/版本/冻结写入口静态核对；未宣称冻结制作坊运行或依赖语义全验。'
    : systematic.has(r.file) ? '全函数AST/风险入口索引与专项片段审阅，追页面生命周期、资源/字段消费者和副作用；呈现模板与全部交互组合未逐行全验。'
    : '模块逻辑阅读并追保存/状态/归属/容量/失败/幂等/装配消费者；上轮已完整读取且指纹未变的存档链复用有效源码与测试证据，新增容量/容器/预设疑点用实际模块复现。';
  return {file:r.file,owner:'root',depth,snapshotSha256:r.sha256,lines:r.lines,review,
    limitations:['审查不是所有分支实测；本轮未操作浏览器/玩家档，也未构建。'],evidence:['root/static-survey.json', 'root/repro.log','上一轮 mainline-review-fixes 完整门（仅基线参考）']};
});
const counts = Object.fromEntries(['deep','systematic','static-only','not-reviewed'].map(depth=>[depth,files.filter(r=>r.depth===depth).length]));
fs.writeFileSync(path.join(out,'root/coverage.json'),JSON.stringify({owner:'root',files,counts},null,2));
console.log(JSON.stringify(counts));
