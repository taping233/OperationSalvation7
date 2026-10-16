import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = 'docs/PARALLEL-REGISTRY.md';
const before = readFileSync(file, 'utf8');
const newline = before.includes('\r\n') ? '\r\n' : '\n';
const start = before.indexOf('## 活跃登记');
const stop = before.indexOf('## 无主物品', start);
const released = before.indexOf('## 近期已释放', stop);
if (start < 0 || stop < 0 || released < 0) throw new Error('登记章节缺失，未写入');
if (before.includes('Friday（节点与背包规则 WF-expedition-renewal-1016）')) throw new Error('本轮已登记，勿重复执行');
const source = before.slice(start + '## 活跃登记'.length, stop);
const blocks = source.trim().split(/\r?\n\s*\r?\n/);
const kept = [], closed = [];
const note = '2026-10-16 老板确认现无其他任务，统一销去旧编辑占用并交本会话接管；原成果、未提交归属、待验收及服务记录保留，销账不表示工作完成或服务已停止。';
for (const block of blocks) {
  if (block.trim().startsWith('|')) {
    for (const line of block.split(/\r?\n/)) {
      if (!line.startsWith('|') || line.startsWith('| 会话') || /^\|\s*-/.test(line)) continue;
      const cells = line.trim().slice(1, -1).split('|').map(cell => cell.trim());
      const service = /网页版启动|拉起主线 Vite|本地网页版|拉起主线|云端实页baseline/.test(cells[0]);
      if (service) kept.push(line);
      else closed.push(line + newline + newline + note);
    }
  } else if (/Friday（本地网页版启动|Friday（网页版启动|Friday（首页图标预览服务/.test(block)) {
    kept.push(block);
  } else {
    closed.push(block + newline + newline + note);
  }
}
const newClaim = '| Friday（节点与背包规则 WF-expedition-renewal-1016） | game/src/run/；game/src/hub/game.bag.js；game/src/battle/ 背包入口；game/src/game.boot.js；相关tests；docs/rules.md、save-format.md；自有证据 | 老板批准首块：战斗禁背包、未完成节点往返/候选持久化、完成时机与商店离店边界；其他UI美术暂停；复用5200，本轮无新服务 | 2026-10-16 | 编辑中；根统筹与实页，node_rules实施，global_ui只读复核；不build、不提交 |';
const paragraphs = kept.filter(block => !block.startsWith('|'));
const rows = kept.filter(block => block.startsWith('|'));
const active = ['## 活跃登记', ...paragraphs, '| 会话/来源 | 属地（文件/端口/工作树） | 事项 | 登记时间 | 状态 |' + newline + '|---|---|---|---|---|' + newline + [newClaim, ...rows].join(newline)].join(newline + newline) + newline + newline;
const after = before.slice(0, start) + active + before.slice(stop);
const marker = '## 近期已释放';
const final = after.replace(marker, marker + newline + newline + '### 2026-10-16 旧任务占用销账' + newline + newline + closed.join(newline + newline) + newline);
if (readFileSync(file, 'utf8') !== before) throw new Error('登记已变化，未写入');
writeFileSync(file, final);
const digest = text => createHash('sha256').update(text).digest('hex');
const receipt = { date: '2026-10-16', authority: '老板：现在没有其他任务了，把其他任务销账，你负责全部', closedRecords: closed.length, retainedServiceRecords: kept.length, beforeSha256: digest(before), afterSha256: digest(final), meaning: note };
writeFileSync('docs/evidence/2026-10-16-WF-expedition-renewal/previous-claims-receipt.json', JSON.stringify(receipt, null, 2) + '\n');
process.stdout.write(JSON.stringify(receipt));
