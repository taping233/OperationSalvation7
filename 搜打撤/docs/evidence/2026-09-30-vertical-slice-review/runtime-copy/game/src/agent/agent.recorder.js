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
// 本局战斗流水（09-26 死因解剖）：死亡 50 局全是战斗中倒下，但 runs.jsonl 只有
// 胜负计数——看不到"最后一战打的谁、几回合、还剩多少血"。环形存末 40 场进记录
const battleLog = [];

function setDriver(name) { driverTag = name || 'human'; return driverTag; }
function getDriver() { return driverTag; }

function noteBattle(win, ctx = {}) {
  battles.fought += 1;
  if (win) battles.won += 1;
  battleLog.push({
    w: win ? 1 : 0,
    li: ctx.li ?? null,          // 0-based 层（记录时转 1-based）
    node: ctx.node ?? null,      // 层内节点索引（死因分桶同款定位键）
    foe: ctx.foe || '',          // 敌人名（+分隔）
    hp: ctx.hp ?? null,          // 战后血量（磨损曲线用）
    turn: ctx.turn ?? null,      // 战斗结束时局内回合
    // ①战斗内观测（09-26）：轮数/三态结果/出牌与道具数/boss编组快照
    round: ctx.round ?? null,
    mode: ctx.mode || null,      // win | lose | flee（w 二值区分不了逃与败）
    nPlayed: ctx.nPlayed ?? null,
    nUsed: ctx.nUsed ?? null,
    deck: ctx.deck || null,
    // ②战斗内埋点（09-26 老板批准）：行为观测四件套——受击/掉血/能量浪费/喝药/逃逸时机。
    // 数据源是 agent 侧逐步观察累积（battleTick/battleActionTick，零战斗引擎侵入），
    // 死亡局 vs 撤离局的行为差异解剖直接消费这几个字段
    hits: bt ? bt.hitEvents : null,      // 受击事件数（hp 下降次数）
    dmg: bt ? bt.dmgTaken : null,        // 掉血总量
    waste: bt ? bt.waste : null,         // 能量浪费（回合切换时剩余能量累加）
    potions: bt ? bt.potions : null,     // 战斗内喝药次数
    fleeT: bt && bt.fleeTurn != null ? bt.fleeTurn : null,   // 逃逸发生时回合数（未逃为 null）
    startHp: bt && bt.startHp != null ? bt.startHp : null,   // 开战血量（残血滚动因果链关键观测）
    startCards: bt && bt.startCards != null ? bt.startCards : null, // 开战卡数（L4/紧急撤离献祭观测）
  });
  if (battleLog.length > 40) battleLog.shift();
}

// —— 战斗内逐步观测累积器（09-26 埋点）——
// agent.runner 的 autoRun 每步喂入战斗视图（battleTick）与动作名（battleActionTick）；
// 战斗结束（battleActive 下降沿）由 runner 调 battleEnd() 重置，noteBattle 落盘后由
// resetRunCounters 清理。不能拿 turn/battleToken 当重置信号——turn 每回合变会把
// 跨回合的受击观测全部冲掉（首版实测 hits 恒 0）
let bt = null;
function battleTick(bv) {
  if (!bv) return;
  if (!bt) bt = { lastTurn: -1, hitEvents: 0, dmgTaken: 0, lastHp: null, lastEnergy: null, waste: 0, potions: 0, fleeTurn: null, startHp: null };
  // 开战血量（09-27 埋点补充）：首步采样——败场「进场即被秒」的进场血分布是
  // 残血滚动因果链的关键缺口（首轮埋点只有战后 hp）
  if (bt.startHp == null && bv.player?.hp != null) bt.startHp = bv.player.hp;
  // 开战卡数（09-27 L4 观测）：紧急撤离需献 3 卡——到撤离点/深进门时的卡数决定
  // 「能撤 vs 被迫深入」，R18 假设的关键观测
  if (bt.startCards == null) {
    try { bt.startCards = window.SDT?.game?.ownedCards?.length ?? null; } catch { /* 忽略 */ }
  }
  const turn = bv.turn ?? 0;
  if (turn !== bt.lastTurn) {
    // 回合切换：上一回合的 lastEnergy 即浪费掉的能量（第一回合无前值不罚）
    if (bt.lastTurn >= 0 && bt.lastEnergy != null) bt.waste += bt.lastEnergy;
    bt.lastTurn = turn;
  }
  const hp = bv.player?.hp ?? null;
  if (bt.lastHp != null && hp != null && hp < bt.lastHp) {
    bt.hitEvents += 1;
    bt.dmgTaken += bt.lastHp - hp;
  }
  bt.lastHp = hp;
  bt.lastEnergy = bv.energy ?? bt.lastEnergy;
}
function battleActionTick(name, bv) {
  if (!bt) battleTick(bv);
  if (!bt) return;
  if (name === 'usePotion') bt.potions += 1;
  if (name === 'flee' && bt.fleeTurn == null) bt.fleeTurn = bv?.turn ?? null;
}
function battleEnd() { bt = null; }
function getBattleCount() { return battles.fought; }

// 计数+流水一并清零。批跑每局开跑前也调（弃局走兜底路径不经 recordRun，
// 不清会把上一局的流水带进下一局的记录）
function resetRunCounters() {
  battles.fought = 0;
  battles.won = 0;
  battleLog.length = 0;
  bt = null;
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
    // 死因分桶定位键（09-26 方法论补强）：层×节点 → 配合 deathByLayer 定位高发死亡点
    node: G.trackPos ?? null,
    turns: G.turn ?? null,
    coins: G.coins ?? null,
    hpLeft: G.hp ?? null,
    durationSec: Math.floor(G.elapsed || 0),
    battles: { ...battles },
    // 末 10 场战斗流水（对照组分析需要撤离局的同款数据，故所有结局都带）
    lastBattles: battleLog.slice(-10).map(b => ({ ...b, li: b.li != null ? b.li + 1 : null })),
    carried,
    carriedValue: carried.reduce((sum, c) => sum + c.value * c.count, 0),
  };
  const runs = listRuns();
  runs.push(entry);
  saveRuns(runs);
  resetRunCounters();
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

export { recordRun, noteBattle, battleTick, battleActionTick, battleEnd, getBattleCount, resetRunCounters, listRuns, clearRuns, exportJSON, exportCSV, setDriver, getDriver };
