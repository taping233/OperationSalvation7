import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hash, table } from '../../../scripts/workflow-ledger.mjs';
import { classifyLedgerRow, parseActiveRegistry } from '../../../scripts/registry-paths.mjs';
import { summarizeTasks, readTask } from '../../../scripts/workflow-task.mjs';
import { generateLayeredMap, validateGeneratedMap } from '../../../game/src/run/map-generator.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const read = file => readFileSync(path.join(root, file), 'utf8');
const checks = [];
const add = (name, passed, detail) => checks.push({ name, passed, detail });
const samples = [0, 1, 77001].map(seed => {
  const map = generateLayeredMap(seed);
  return { seed, nodes: map.layers.map(layer => layer.nodes.length), valid: validateGeneratedMap(map.layers).ok };
});
add('基础四层节点与文档一致', samples.every(s => s.valid && String(s.nodes) === '7,12,17,17') && read('docs/rules.md').includes('7/12/17/17'), samples);
const pets = JSON.parse(read('game/data/pets.json'));
add('宠物等级、升级费用与安全格例外', pets.levelMax === 5 && String(pets.upCosts) === '2,3,4,5'
  && pets.list.find(p => p.id === 'penguin').effect.safeBonus === 2
  && read('docs/rules.md').includes('2/3/4/5 口粮'), {});
add('祭坛兑换使用能力卡池', read('game/src/run/game.run.altar.js').includes("filter(c => c.type === '能力卡')")
  && read('docs/rules.md').includes('本职业随机能力卡'), {});
const state = parseActiveRegistry(read('docs/PARALLEL-REGISTRY.md'), { includeSettled: true });
const snapshotState = parseActiveRegistry(read('docs/archive/WF-ledger-context-1009/originals/docs/PARALLEL-REGISTRY.md'), { includeSettled: true });
const others = rows => rows.filter(row => !row.session.includes('WF-doc-system-followup-1009'));
const oldSessions = new Set(others(snapshotState).map(row => row.session));
const remainingUnchanged = others(state).filter(row => oldSessions.has(row.session)).every(row => JSON.stringify(row) === JSON.stringify(others(snapshotState).find(old => old.session === row.session)));
const addedAfterSnapshot = others(state).filter(row => !oldSessions.has(row.session));
const releasedAfterSnapshot = others(snapshotState).filter(old => !others(state).some(row => row.session === old.session));
const releasedBody = read('docs/PARALLEL-REGISTRY.md').split('## 近期已释放')[1] || '';
add('仍活跃的其他占用保持不变，后续释放记录可定位', remainingUnchanged
  && releasedAfterSnapshot.every(row => releasedBody.split('\n').some(line => line.includes(row.session) && line.includes('编辑占用释放'))),
  { checked: others(state).length, releasedAfterSnapshot: releasedAfterSnapshot.map(row => row.session),
    addedAfterSnapshot: addedAfterSnapshot.map(row => row.session), applicationPreservedActive: true });
const open = text => table(text, '活账').rows.filter(row => classifyLedgerRow(row, 'pending').state === 'open').map(row => row.line);
add('未决事项原始行保持不变', JSON.stringify(open(read('docs/PENDING.md')))
  === JSON.stringify(open(read('docs/archive/WF-ledger-context-1009/originals/docs/PENDING.md'))), { checked: open(read('docs/PENDING.md')).length });
const manifest = JSON.parse(read('docs/archive/WF-ledger-context-1009/manifest.json'));
add('台账历史副本字节与原校验值一致', manifest.items.every(item => hash(readFileSync(path.join(root, item.target))) === item.sha256), {});
const summary = summarizeTasks(root);
add('旧格式记录报告为不完整，不补造任务状态', summary.incomplete
  && summary.skipped.some(item => item.id === 'WF-card-ally-redesign'), { skipped: summary.skipped.length });
const task = readTask(root, { id: 'WF-doc-system-followup-1009', date: '2026-10-09' });
add('标准任务创建与读取成功', task.task.owner === 'Friday' && task.task.schemaVersion === 1, {});
const result = { recordedAt: new Date().toISOString(), ok: checks.every(check => check.passed), checks,
  limits: ['只证明所列事实、状态保护与工具入口', '未验证全部卡牌效果或游戏实页', '历史原文保持时点身份'] };
writeFileSync(path.join(here, 'fact-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
