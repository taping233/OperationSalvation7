/* ============================================================
 * agent.recorder.js —— 逐局跑局记录（人机通用）
 *
 * 终局挂点（各一行，经 SDT 全局晚绑定，零 import 边）：
 *   死亡结算完成   game.session.death.js   → recordRun('death', { why, savedCards })
 *   撤离整理完成   game.run.altar.js       → recordRun('clear'|'extract', { receipt, carriedCards })
 *                                    （2026-10-03 SYS-02：结局/层/行动/净带回随撤离回执读，不再反推）
 *   放弃对局       ui/game.menu.js         → recordRun('abandon')
 *   战斗收尾       battle.lifecycle.js     → noteBattle(win)（注意：不可订阅 battle:end
 *                                            总线事件——served>0 会吞掉 onBattleEnd 回退）
 *
 * 存储：localStorage 'sdt-run-records' 环形缓冲 200 局；导出 JSON/CSV 字符串由
 * 数据页/批跑落盘。字段口径与 agent.stats 聚合一一对应。
 *
 * 2026-10-03 老板（SYS-11）新增两路随局事实，均「只加记录不改行为」：
 *   干预履历   各调试入口 → noteIntervention(source, action, detail?)
 *              （开发者控制台/调试命令/场景注入；recordRun 时随 entry.provenance 留痕）
 *   停止原因   agent.runner 收口 → noteStopReason({ code, phase, turn, waitingAction, steps })
 *              （entry.stopReason；classifyStop 纯函数给出 completed/stalled/aborted/error）
 * ============================================================ */

import { Random } from '../core/random.js';
import { BATTLE_LOG_CAP, createRunBattleStats } from './agent.battle-stats.js';

const KEY = 'sdt-run-records';
const CAP = 200;

let driverTag = 'human';
// 2026-10-03 老板（SYS-11）：本局「粘滞」自动驱动标签——结算确认（recordRun）晚于
// autoRun 收口还原 human，纯 driverTag 会把 agent 局记成 human（研究证据：辅助局标
// human）。非 human 驱动一经设置粘到本局记录落盘，resetRunCounters 才清。
let runDriver = null;
// 2026-10-03 老板（SYS-11）：干预履历（开发者控制台/调试命令/场景注入）——只记录
// 不改行为，recordRun 时随 provenance 留痕后随局清零。
let interventions = [];
// 2026-10-03 老板（SYS-11）：结构化停止原因（runner 收口时写入，recordRun 随局落盘）
let stopInfo = null;
const runBattleStats = createRunBattleStats();
const { battles, battleLog, snapshot: snapshotRunBattles } = runBattleStats;
function restoreRunBattles(data, runId) {
  bt = null; // 只替换战斗统计，不抹掉同一会话既有的驱动/干预来源事实。
  return runBattleStats.restore(data, runId);
}

function setDriver(name) {
  driverTag = name || 'human';
  if (driverTag !== 'human') runDriver = driverTag;   // SYS-11：粘滞本局，还原 human 不清
  return driverTag;
}
function getDriver() { return driverTag; }

// —— SYS-11 干预履历：来源固定三入口（开发者控制台 / 调试命令 / 场景注入），调用点只
// 加一行记录、不改任何行为；at 快照当时的回合与层，便于回答「被干预过什么、在何时」。
function noteIntervention(source, action, detail) {
/** @type {Partial<import('../hub/game.store.types').GameState>} */
  const G = window.SDT?.game || {};
  const item = {
    ts: Date.now(),
    source: String(source || 'dev-console'),
    action: String(action || ''),
    at: {
      turn: G.turn ?? null,
      layer: Number.isInteger(G.layerIdx) ? G.layerIdx + 1 : null,
    },
  };
  if (detail != null && !(typeof detail === 'object' && !Object.keys(detail).length)) item.detail = detail;
  interventions.push(item);
  return item;
}

// —— SYS-11 停止原因分类（纯函数）：completed=正常完成（终局结算/对局收尾/外部判定），
// stalled=卡死疑似（各类熔断与超时），aborted=中止（手动停止/驱动方主动停/重入拒绝），
// error=错误（单步异常风暴）。
const STOP_KINDS = {
  'terminal-pending': 'completed', 'run-end': 'completed', 'until': 'completed',
  'decide-null': 'aborted', 'cancelled': 'aborted', 'already-running': 'aborted',
  'max-steps': 'stalled', 'spin': 'stalled', 'stay': 'stalled', 'battle-stall': 'stalled',
  'no-progress': 'stalled', 'fail-spin': 'stalled', 'alt2-cycle': 'stalled',
  'wait-limit': 'stalled', 'command-timeout': 'stalled', 'context-changed': 'stalled',
  'run-timeout': 'stalled',
  'step-errors': 'error', 'step-exception': 'error',
};
function classifyStop(code) { return STOP_KINDS[code] || 'unknown'; }

// runner 收口调用：info 为结构化对象 { code, phase, turn, waitingAction, steps } 或纯码字符串。
// 只留非空字段，旧调用（纯字符串）也能得到 { code, kind } 最小结构。
function noteStopReason(info) {
  const code = typeof info === 'string' ? info : String(info?.code || '');
  if (!code) { stopInfo = null; return null; }
  stopInfo = { code, kind: (typeof info === 'object' && info.kind) || classifyStop(code) };
  if (typeof info === 'object') {
    for (const key of ['phase', 'turn', 'waitingAction', 'steps']) {
      if (info[key] != null) stopInfo[key] = info[key];
    }
  }
  return stopInfo;
}

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
  if (battleLog.length > BATTLE_LOG_CAP) battleLog.shift();
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
  runBattleStats.reset();
  bt = null;
  runDriver = null;        // SYS-11：驱动粘滞/干预履历/停止原因随局清零，不污染下一局
  interventions = [];
  stopInfo = null;
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

// 记录一局终局。detail: { why?, savedCards?, carriedCards?, receipt? }——卡牌数组元素为 { card, count }。
// 2026-10-03 老板（SYS-02）：detail.receipt（撤离结算回执）存在时，结局/层/行动/币/时长/
// 首探经验/净带回/关键损失一律以回执为准（与旧「从 G 现场/ownedCards 反推」口径冲突时回执赢），
// 原始回执整体随 entry.receipt 留档供 Agent 导出对账；无回执的结局（death/abandon/nest）保持原口径。
function recordRun(outcome, detail = {}) {
/** @type {Partial<import('../hub/game.store.types').GameState>} */
  const G = window.SDT?.game || {};
  const receipt = detail.receipt && typeof detail.receipt === 'object' ? detail.receipt : null;
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
    // 记录标识只用于统计，不能因记录次数改变下一次规则随机结果。
    id: `run-${Date.now().toString(36)}-${Random.random('recording').toString(36).slice(2, 7)}`,
    runId: snapshotRunBattles().runId,
    ts: Date.now(),
    driver: driverTag,
    // 2026-10-03 老板（SYS-11）：本局真实来源——driver 三态（human|agent|mixed）+ 干预履历
    // 逐条留痕（谁驱动、被干预过什么）。有干预即 mixed（控制台/调试命令改变了局面推进）；
    // 无干预时按粘滞 runDriver 判 agent（结算确认晚于 autoRun 还原，driverTag 不可信）。
    // 顶层 driver 字段是既有口径（记录时点标签），消费方不动。
    provenance: {
      driver: interventions.length ? 'mixed' : (runDriver ? 'agent' : 'human'),
      agentDriver: runDriver,
      interventions: interventions.slice(),
    },
    // 2026-10-03 老板（SYS-11）：结构化停止原因（为何停：completed/stalled/aborted/error
    // + code + 卡死疑似点 phase/等待动作）。无自动驱动或未收口即记录时为 null，旧记录无此字段。
    stopReason: stopInfo,
    outcome: receipt?.outcome || outcome,             // clear | extract | death | abandon（有回执以回执为准）
    why: detail.why || '',
    seed: G.mapSeed ?? null,
    mode: G.nestActive ? 'nest' : (G.mode || 'standard'),
    class: G.myClass || null,
    characterId: G.characterId || null,
    maxLayer: receipt ? (receipt.layersReached ?? null) : (G.layerIdx != null ? G.layerIdx + 1 : null),
    // 死因分桶定位键（09-26 方法论补强）：层×节点 → 配合 deathByLayer 定位高发死亡点
    node: G.trackPos ?? null,
    turns: receipt ? (receipt.actions ?? null) : (G.turn ?? null),
    coins: receipt ? (receipt.runCoins ?? null) : (G.coins ?? null),
    hpLeft: G.hp ?? null,
    durationSec: receipt ? Math.max(0, Math.floor(Number(receipt.durationSec) || 0)) : Math.floor(G.elapsed || 0),
    bossKilled: receipt ? !!receipt.bossKilled : (G.bossKilled != null ? !!G.bossKilled : null),
    firstExploreXp: receipt?.firstExplore?.xp ?? null,      // SYS-01 口径：首探经验（回执唯一真源）
    firstExploreMoves: receipt?.firstExplore?.moves ?? null,
    netTake: receipt?.netTake || null,                     // 本局真实入库（卡/口袋/木材/口粮）
    losses: receipt?.losses || null,                       // 散失（未入库卡/口袋散失/notable）
    battles: { ...battles },
    // 末 10 场战斗流水（对照组分析需要撤离局的同款数据，故所有结局都带）
    lastBattles: battleLog.slice(-10).map(b => ({ ...b, li: b.li != null ? b.li + 1 : null })),
    carried,
    carriedValue: carried.reduce((sum, c) => sum + c.value * c.count, 0),
    receipt,   // 原始回执整体留档（SYS-02：三方对账的锚点）
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
  // 2026-10-03 老板（SYS-02）：列在原表尾追加（既有列序与消费方不动），回执派生字段供对账
  const head = ['id', 'ts', 'driver', 'outcome', 'why', 'seed', 'mode', 'class', 'characterId',
    'maxLayer', 'turns', 'coins', 'hpLeft', 'durationSec', 'battlesFought', 'battlesWon', 'carriedValue', 'carriedNames',
    'bossKilled', 'firstExploreXp', 'stashedCards', 'pocketKept', 'pocketLost', 'wood', 'rations', 'lostCount',
    // 2026-10-03 老板（SYS-11）：来源/干预/停止三列随表尾追加，旧记录留空可对账
    'provenanceDriver', 'interventions', 'stopReason'];
  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = runs.map(r => [
    r.id, new Date(r.ts).toISOString(), r.driver, r.outcome, r.why, r.seed, r.mode, r.class, r.characterId,
    r.maxLayer, r.turns, r.coins, r.hpLeft, r.durationSec, r.battles?.fought ?? 0, r.battles?.won ?? 0,
    r.carriedValue, (r.carried || []).map(c => `${c.name}x${c.count}`).join(' '),
    r.bossKilled != null ? (r.bossKilled ? 1 : 0) : '', r.firstExploreXp ?? '',
    r.netTake?.cardsStashed ?? '', r.netTake?.pocketKept ?? '', r.losses?.pocketLost ?? '',
    r.netTake?.wood ?? '', r.netTake?.rations ?? '', r.losses?.lostCount ?? '',
    r.provenance?.driver ?? '', r.provenance?.interventions?.length ?? '', r.stopReason?.code ?? '',
  ].map(cell).join(','));
  return [head.join(','), ...rows].join('\n');
}

export { recordRun, noteBattle, battleTick, battleActionTick, battleEnd, getBattleCount, resetRunCounters, snapshotRunBattles, restoreRunBattles, listRuns, clearRuns, exportJSON, exportCSV, setDriver, getDriver, noteIntervention, noteStopReason, classifyStop };
