/* ============================================================
 * agent.recorder.js —— 逐局跑局记录（人机通用）
 *
 * 终局挂点（各一行，经 SDT 全局晚绑定，零 import 边）：
 *   死亡结算完成   game.session.death.js   → recordRun('death', { why, savedCards })
 *   撤离整理完成   game.run.altar.js       → recordRun('clear'|'extract', { carriedCards })
 *   放弃对局       ui/game.menu.js         → recordRun('abandon')
 *   战斗收尾       battle.lifecycle.js     → noteBattle(win)（注意：不可订阅 battle:end
 *                                            总线事件——served>0 会吞掉 onBattleEnd 回退）
 *
 * 存储：localStorage 'sdt-run-records' 环形缓冲 200 局；导出 JSON/CSV 字符串由
 * 数据页/批跑落盘。字段口径与 agent.stats 聚合一一对应。
 * ============================================================ */

import { Random } from '../core/random.js';

const KEY = 'sdt-run-records';
const CAP = 200;

let driverTag = 'human';
const battles = { fought: 0, won: 0 };

function setDriver(name) { driverTag = name || 'human'; return driverTag; }
function getDriver() { return driverTag; }

function noteBattle(win) {
  battles.fought += 1;
  if (win) battles.won += 1;
}

function cardValue(card) {
  try { return window.SDT?.Cards?.sellPrice?.(card) ?? 0; } catch { return 0; }
}

function listRuns() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveRuns(runs) {
  try { localStorage.setItem(KEY, JSON.stringify(runs.slice(-CAP))); } catch { /* 存储满/不可用 */ }
}

function clearRuns() {
  try { localStorage.removeItem(KEY); } catch { /* 同上 */ }
}

// 记录一局终局。detail: { why?, savedCards?, carriedCards? }——卡牌数组元素为 { card, count }
function recordRun(outcome, detail = {}) {
  const G = window.SDT?.game || {};
  const cards = detail.carriedCards || detail.savedCards || [];
  const carried = cards
    .filter(e => e && e.card)
    .map(e => ({
      name: e.card.name || '',
      rarity: e.card.rarity || '',
      type: e.card.type || '',
      count: e.count || 1,
      value: cardValue(e.card),
    }));
  const entry = {
    id: `run-${Date.now().toString(36)}-${Random.random('gameplay').toString(36).slice(2, 7)}`,
    ts: Date.now(),
    driver: driverTag,
    outcome,                                   // clear | extract | death | abandon
    why: detail.why || '',
    seed: G.mapSeed ?? null,
    mode: G.nestActive ? 'nest' : (G.mode || 'standard'),
    class: G.myClass || null,
    characterId: G.characterId || null,
    maxLayer: G.layerIdx != null ? G.layerIdx + 1 : null,
    turns: G.turn ?? null,
    coins: G.coins ?? null,
    hpLeft: G.hp ?? null,
    durationSec: Math.floor(G.elapsed || 0),
    battles: { ...battles },
    carried,
    carriedValue: carried.reduce((sum, c) => sum + c.value * c.count, 0),
  };
  const runs = listRuns();
  runs.push(entry);
  saveRuns(runs);
  battles.fought = 0;
  battles.won = 0;
  return entry;
}

function exportJSON() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), runs: listRuns() }, null, 2);
}

function exportCSV() {
  const runs = listRuns();
  const head = ['id', 'ts', 'driver', 'outcome', 'why', 'seed', 'mode', 'class', 'characterId',
    'maxLayer', 'turns', 'coins', 'hpLeft', 'durationSec', 'battlesFought', 'battlesWon', 'carriedValue', 'carriedNames'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = runs.map(r => [
    r.id, new Date(r.ts).toISOString(), r.driver, r.outcome, r.why, r.seed, r.mode, r.class, r.characterId,
    r.maxLayer, r.turns, r.coins, r.hpLeft, r.durationSec, r.battles?.fought ?? 0, r.battles?.won ?? 0,
    r.carriedValue, (r.carried || []).map(c => `${c.name}x${c.count}`).join(' '),
  ].map(cell).join(','));
  return [head.join(','), ...rows].join('\n');
}

export { recordRun, noteBattle, listRuns, clearRuns, exportJSON, exportCSV, setDriver, getDriver };
