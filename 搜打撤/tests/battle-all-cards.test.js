/* 全卡库真实战斗实打审计（2026-09-09 老板任务）：
 * 在真实 BattleSession（battle.core，无视图层）里逐张开战、逐张打出/使用，
 * 验证每张卡「能打出、不崩、战斗能正常收尾」。
 * 分层：
 *   A 手牌战斗卡（武术/法术/装备/能力卡）→ play 管线（含注能/发现/抉择/手选面板）
 *   B 牌库类卡（描述含洗入/置入牌库等，普通战打不出）→ BOSS 编组流程实打
 *   C 道具卡 → 战斗背包 usePotion 管线（普通战）
 *   D 开战被动装备（「对战开始时」）→ 开战自动生效不崩
 *   E 资源/事件/生物 → 断言正确地不进手牌（不可打出是设计行为）
 * 判定口径：
 *   崩溃（异常抛出）/ 卡死（busy 或队列悬挂）/ 意外败北 = 硬失败；
 *   打出后零可观测变化 = 分级（迭代评审 09-20）：手牌代价卡在「审计空手牌」环境下
 *   条件必不满足 → 警告清单（人工复核，句式引自 hand-cost-patterns.js 单一登记点）；
 *   无前置条件的卡零效果 → 硬失败（堵死「描述改成解析不出动词的死卡静默入库」的入口）。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { targetSideFor, unplayableReasonFor } from '../game/src/battle.rules.js';
import { HAND_COST_PATTERNS } from '../game/src/hand-cost-patterns.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

// ---------- 假对局环境 ----------
let uidSeq = 0;
function makeGame(cards, myClass = '侠客') {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
    myClass, characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd(opts, played, win) { this.lastBattleEnd = { win, names: opts && opts.foeNames }; },
  };
  return g;
}
const foeDef = () => ({ id: 'infantry', name: '审计靶子', hp: 99999, atk: 1 });

const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();

// 抽干动作队列并顺手关掉发现/抉择/手选面板（都选第 0 项），返回最终快照
async function drain(maxLoops = 200) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) return s;
  }
  return snap();
}

// 出牌前后各拍一次状态指纹（含飘字消费），指纹不变 = 零可观测效果
function observe(game, s) {
  return JSON.stringify([
    s.foes.map(f => [f.name, f.hp, f.dead, f.status]),
    s.energy, s.hand.slice().sort(), s.drawPile.length, s.discard.length, s.grave.length,
    s.allies.map(a => [a.name, a.hp]),
    s.pdef && [s.pdef.shield, s.pdef.armor, s.pdef.guard],
    s.pstat && [s.pstat.hp, s.pstat.status],
    game.ownedCards.length,
    viewApi.takeFloats().length,
  ]);
}

const EXCLUDED = ['资源', '事件', '生物'];
function classify(card) {
  const desc = String(card.desc || '');
  if (EXCLUDED.includes(card.type)) return 'excluded';
  if (card.type === '道具') return 'item';
  if (card.type === '装备' && /对战开始时/.test(desc)) return 'passive';
  if (unplayableReasonFor(card, 'normal') && !unplayableReasonFor(card, 'boss')) return 'bossOnly';
  return 'hand';
}

// 条件卡判定：手牌代价句（与预检/结算同一登记点）在审计环境（无手牌燃料）下必不满足
const isConditionalCard = (card) => HAND_COST_PATTERNS.some(re => re.test(String(card.desc || '')));
const ZERO_CONDITIONAL = '零可观测效果（手牌代价卡：审计环境条件必不满足，人工复核）';
const ZERO_UNCONDITIONAL = '零可观测效果（无前置条件）';

function sideFor(card) {
  const side = targetSideFor(card, C.DMG_TYPES);
  if (side === 'enemy') return 0;
  if (side === 'self') return 'self';
  return undefined;
}

// 注能燃料：同名一叠只能选一张（toggle 语义），燃料必须互相不同名
const FILLER_NAMES = ['初始攻击', '毒药', '坚冰结界', '禁言术'];

// 注能卡：从手牌补选燃料到满，再确认注能
async function settleInfusion() {
  for (let i = 0; i < 30 && snap().infusing; i++) {
    const s = snap();
    if (s.infusing.picked.length >= s.infusing.need) break;
    const target = s.hand.find(u => u !== s.infusing.uid && !s.infusing.picked.includes(u));
    if (!target) break;
    const before = s.infusing.picked.length;
    BattleSession.commands.selectInfusion(target);
    await tick();
    if (!snap().infusing) return;
    if (snap().infusing.picked.length === before) {   // toggle 被撤销时同一点位再补一次
      BattleSession.commands.selectInfusion(target);
      await tick();
    }
  }
  const s = snap();
  if (s.infusing && s.infusing.picked.length >= s.infusing.need) BattleSession.commands.confirmInfusion();
  await drain();
}

// 在已开打的战斗里把一张手牌真正打出（含注能、面板自动点选）
async function playInBattle(game, uid, card) {
  const before = observe(game, snap());
  BattleSession.commands.playCard(uid, sideFor(card));
  if (snap().infusing) await settleInfusion();
  const end = await drain();
  return { before, after: observe(game, end), end };
}

// ---------- 汇总审计 ----------
const results = [];
const record = (card, path, problem) => results.push({ id: card.id, name: card.name, type: card.type, path, problem });
const hardFails = () => results.filter(r => !r.problem.startsWith('零可观测') || r.problem.includes('无前置条件'));
const softWarns = () => results.filter(r => r.problem.startsWith('零可观测'));
const endBattle = (game) => { if (game.battleActive && !snap().busy) BattleSession.commands.flee(); };

// 出牌结算跑在异步动作队列里，异常会变成 unhandledRejection：
// 监听全局，每张卡审完后取走挂起的异常，让崩溃以硬失败形式归因到该卡
let asyncError = null;
process.on('unhandledRejection', (e) => { asyncError = e; });
function takeAsyncError() { const e = asyncError; asyncError = null; return e; }

async function auditOne(card) {
  const kind = classify(card);
  const need = viewApi.infuseOf(card) || 0;
  const fill = need > 0 ? FILLER_NAMES
    .map(n => C.all().find(c => c.name === n && c.name !== card.name))
    .filter(Boolean)
    .slice(0, need + 1)
    : [];

  if (kind === 'excluded') {
    const game = makeGame([card]);
    try {
      BattleSession.start(game, [foeDef()], { isBoss: false, name: '审计' });
      // 背包砸击初始牌（2026-09-13 留言）合法常驻手牌，不计入排除类违规
      const nonSlam = snap().hand.filter(u => { const o = viewApi.findCard(u); return o && o.card.name !== '背包砸击'; });
      if (nonSlam.length !== 0) record(card, 'E-排除', `不应进手牌却进了（hand=${nonSlam.length}）`);
    } catch (e) { record(card, 'E-排除', '崩溃:' + e.message); }
    endBattle(game);
    return;
  }
  if (kind === 'passive') {
    const game = makeGame([card]);
    try {
      BattleSession.start(game, [foeDef()], { isBoss: false, name: '审计' });
      // 被动本身不进手牌；但它可能发放临时卡（如灵符抽牌在普通战转为获得初始攻击）
      if (snap().hand.includes(game.ownedCards[0].uid)) record(card, 'D-被动', '开战被动装备不应进手牌');
      // 2026-09-10 定版：对战开始时的装备只在 BOSS 战生效——普通战斗不触发即正确，触发了反而是错
      else if (game.logs.some(l => l.includes('开战被动'))) record(card, 'D-被动', '普通战斗不应触发展开战被动（现仅 BOSS 战生效）');
    } catch (e) { record(card, 'D-被动', '崩溃:' + e.message); }
    endBattle(game);
    return;
  }
  if (kind === 'item') {
    const game = makeGame([card]);
    try {
      BattleSession.start(game, [foeDef()], { isBoss: false, name: '审计' });
      const uid = game.ownedCards[0].uid;
      const before = observe(game, snap());
      BattleSession.commands.usePotion(uid);
      const s = await drain();
      const consumed = game.ownedCards.length === 0;
      if (!consumed && observe(game, s) === before) record(card, 'C-道具', '零可观测效果（也未消耗）');
      if (s.busy || s.actionQueueLength > 0) record(card, 'C-道具', '结算悬挂（busy/队列未清）');
    } catch (e) { record(card, 'C-道具', '崩溃:' + e.message); }
    endBattle(game);
    return;
  }
  if (kind === 'bossOnly') {
    const game = makeGame([card]);
    try {
      BattleSession.start(game, [foeDef()], { isBoss: true, name: 'BOSS审计' });
      let s = snap();
      if (!s.deckSelection) { record(card, 'B-BOSS', '未进入编组牌库阶段'); endBattle(game); return; }
      const cap = Math.min(s.deckSelection.need, s.deckSelection.cards.length);
      while (snap().deckSelection && snap().deckSelection.selected.length < cap) {
        const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
        if (!next) break;
        BattleSession.commands.selectDeckCard(next.uid);
      }
      BattleSession.commands.confirmDeck();
      await tick();
      s = snap();
      const uid = game.ownedCards[0].uid;
      if (!s.hand.includes(uid)) {
        // 「抽到时施放」类衍生牌抽到即结算：超过开场两条日志即视为已触发
        if (game.logs.length <= 2) record(card, 'B-BOSS', '编组后未进手牌也未结算');
      } else {
        const r = await playInBattle(game, uid, card);
        if (r.after === r.before) record(card, 'B-BOSS', isConditionalCard(card) ? ZERO_CONDITIONAL : ZERO_UNCONDITIONAL);
      }
      if (snap().busy || snap().actionQueueLength > 0) record(card, 'B-BOSS', '结算悬挂（busy/队列未清）');
      if (game.lastBattleEnd && game.lastBattleEnd.win === false) record(card, 'B-BOSS', '打出后意外败北');
    } catch (e) { record(card, 'B-BOSS', '崩溃:' + e.message); }
    endBattle(game);
    return;
  }
  // kind === 'hand'
  const game = makeGame([card, ...fill]);
  try {
    BattleSession.start(game, [foeDef()], { isBoss: false, name: '审计' });
    const uid = game.ownedCards[0].uid;
    // 受缚之残影（2026-09-16 定版重做）：开局即破封化形，原卡按设计离场（abyss-sovereign.test.js 实打覆盖）
    if (card.id === 'tt8-hero-sealer') { endBattle(game); return; }
    if (!snap().hand.includes(uid)) { record(card, 'A-手牌', '战斗卡未进手牌'); endBattle(game); return; }
    const r = await playInBattle(game, uid, card);
    if (r.after === r.before) record(card, 'A-手牌', isConditionalCard(card) ? ZERO_CONDITIONAL : ZERO_UNCONDITIONAL);
    if (r.end.busy || r.end.actionQueueLength > 0) record(card, 'A-手牌', '结算悬挂（busy/队列未清）');
    if (game.lastBattleEnd && game.lastBattleEnd.win === false) record(card, 'A-手牌', '打出后意外败北');
  } catch (e) { record(card, 'A-手牌', '崩溃:' + e.message); }
  endBattle(game);
}

describe('全卡库真实战斗实打审计', () => {
  it('每张卡都能在真实战斗中打出/使用且不崩不卡死', { timeout: 300_000 }, async () => {
    for (const card of C.all()) {
      await auditOne(card);
      const e = takeAsyncError();
      if (e) record(card, '异步结算', '崩溃:' + ((e && e.message) || e));
    }
    const hard = hardFails();
    const soft = softWarns();
    console.log(`\n===== 实打结果：共 ${C.all().length} 张，硬失败 ${hard.length}，零效果警告 ${soft.length} =====`);
    if (hard.length) {
      console.log('—— 硬失败清单 ——\n' + hard.map(r => `【${r.name}】(${r.type}) ${r.path}: ${r.problem}`).join('\n'));
    }
    if (soft.length) {
      console.log('—— 零效果警告（人工复核，不判失败）——\n' + soft.map(r => `【${r.name}】(${r.type}) ${r.path}`).join('\n'));
    }
    expect(hard).toEqual([]);
  });
});
