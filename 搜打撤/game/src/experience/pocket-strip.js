/* pocket-strip.js —— 章节风险徽标。
 * 10-04 老板指定移除背包/消耗袋/随身币/带出预估常驻条。
 * 保留章节风险装饰与原 startPocketStrip 装配接口，不再创建或更新汇总条。 */
import '../../css/pocket-strip.css';
import { layerEncounterMeta } from '../run/encounter-meta.js';

const POLL_MS = 600;

/* 切片3（2026-09-28）：章节面板层级风险徽标——「深入下一层的代价」过门前可见。
 * CODE-003（encounter-meta.js）是层级池元数据（同层战斗节点共享一个池，
 * 节点间无法互相区分），故装饰落点选章节导航：每层一行风险/精英概率，
 * 只标当前层之后的层（正在经历的层不需要预告）。渲染器重画会抹掉装饰，
 * tick 里每轮补挂（li 无 .eps-lyr 子元素才写，避免每帧动 DOM）。 */
const RISK_LABEL = { '低': '低危', '中': '常规', '高': '高危', '极高': '极高危' };

// 层元数据按 MAP 对象记忆化（09-30 性能审计 F12）：layerEncounterMeta 是纯函数，
// 同一局地图同层结果恒定；600ms 轮询每轮重算纯属浪费。WeakMap 随换局地图 GC 自动清。
const metaCacheByMap = new WeakMap();
function layerMetaCached(map, idx) {
  let arr = metaCacheByMap.get(map);
  if (!arr) { arr = []; metaCacheByMap.set(map, arr); }
  if (arr[idx] === undefined) arr[idx] = layerEncounterMeta(map, idx) || null;
  return arr[idx] || null;
}

function decorateChapters() {
  const nav = document.getElementById('expeditionChapter');
  const SDT = window.SDT;
  const game = SDT && SDT.game;
  if (!nav || !game || !game.runActive || !SDT || !SDT.MAP) return;
  const cur = typeof game.layerIdx === 'number' ? game.layerIdx : 0;
  const rows = nav.querySelectorAll('ol > li');
  rows.forEach((li, idx) => {
    if (idx <= cur) {   // 当前与已过的层不预告
      const old = li.querySelector('.eps-lyr');
      if (old) old.remove();
      return;
    }
    if (li.querySelector('.eps-lyr')) return;
    const meta = layerMetaCached(SDT.MAP, idx);
    if (!meta) return;
    const tag = document.createElement('i');
    tag.className = 'eps-lyr';
    tag.dataset.tier = meta.risk || '中';
    const elite = meta.eliteChance > 0 ? ` · 精英 ${Math.round(meta.eliteChance * 100)}%` : '';
    tag.textContent = `${RISK_LABEL[meta.risk] || meta.risk}${elite}`;
    // 样式全部由 experience-loot.css 的 #expeditionChapter li .eps-lyr 段接管（美术线 02:4x 正式化，内联已撤）
    li.appendChild(tag);
  });
}

function tick() {
  if (typeof window === "undefined") return;
  try { decorateChapters(); } catch { /* 不阻塞对局 */ }
}

let started = false;
let pollTimer = 0;
function startPolling() {
  if (pollTimer || !started) return;
  pollTimer = setInterval(tick, POLL_MS);
}
function stopPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = 0;
}
export function startPocketStrip() {
  if (started) return;
  started = true;
  document.getElementById('expPocketStrip')?.remove();
  // 页面不可见时停表（09-30 性能审计 F10，铁律①精神）：600ms 轮询此前无清理通道，
  // 后台标签页不再补挂章节徽标
  document.addEventListener('visibilitychange', () => { document.hidden ? stopPolling() : startPolling(); });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { if (!document.hidden) startPolling(); });
  } else if (!document.hidden) {
    startPolling();
  }
}

if (!window.__expPocketStrip) {
  window.__expPocketStrip = true;
  startPocketStrip();
}
