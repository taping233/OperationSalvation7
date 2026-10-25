import { playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 6, battleHandMax: 8, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi, matchHandSelectKey } = await import('../game/src/battle/core/battle.core.js');
const { set$handSelecting } = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let activeGame = null;
let uidSequence = 0;
const paymentCard = ({ count = 2, type = '初始攻击' } = {}) => {
  const requirement = { kind: 'handCards', count };
  if (type) requirement.type = type;
  return {
    id: 'test-tt7-hand-payment', name: '结构化支付连击', cost: 1, type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成2点固定伤害，触发3次。',
    rules: { version: 1, battle: { target: { side: 'enemy', area: false }, requirements: [requirement] },
      triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hitCount: 3, retarget: 'livingFoes' }] } },
  };
};
const starter = () => ({ id: `test-starter-${uidSequence}`, name: '初始攻击', cost: 1, type: '武术', dmg: 1, dmgType: 'attack', desc: '攻。' });
function makeGame(cards) {
  const game = {
    ownedCards: cards.map(card => ({ uid: `payment-${uidSequence++}`, card, safe: false })),
    ...playerFields(30, 30, 5, 0, '侠客', null), lastBattleEnd: null,
    log(message) { (this.logs ||= []).push(String(message)); }, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd(opts, played, win, consumed) { this.lastBattleEnd = { opts, played, win, consumed }; },
  };
  return game;
}
const foe = () => ({ id: 'payment-foe', name: '支付测试靶子', hp: 50, atk: 1 });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle(timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) return state;
    await tick();
  }
  throw new Error('支付卡战斗动作未收敛');
}
function start(cards) {
  activeGame = makeGame(cards);
  BattleSession.start(activeGame, [foe()], { isBoss: false, name: 'TT7 手牌支付定向测试' });
  return activeGame;
}
async function finish() {
  if (activeGame?.battleActive) BattleSession.commands.flee();
  activeGame = null;
}

afterEach(finish);

describe('结构化 handCards 出牌支付', () => {
  it('兼容 matcher 出口保留通配、杀别名和类型匹配规则', () => {
    expect(matchHandSelectKey(null, null)).toBe(true);
    expect(viewApi.matchHandSelectKey({ name: '杀', type: '武术' }, '杀')).toBe(true);
    expect(matchHandSelectKey({ name: '初始攻击', type: '武术' }, '初始攻击')).toBe(true);
    expect(matchHandSelectKey({ name: '普通攻击', type: '武术' }, '杀')).toBe(false);
    expect(matchHandSelectKey({ name: '任意卡', type: '法术' }, '法术')).toBe(true);
    expect(matchHandSelectKey({ name: '任意卡', type: '法术' }, '武术')).toBe(false);
  });

  it('多张复制选择逐次递减，并在最后一次后清空瞬时状态', () => {
    const game = start([starter(), starter()]);
    const targetUid = game.ownedCards[0].uid;
    set$handSelecting({
      n: 2, type: null, act: 'copy', thenText: '', target: null, srcCard: null,
      mandatory: false, onDone: null,
    });
    const initialHandSize = BattleSession.getSnapshot().hand.length;

    BattleSession.commands.pickHandSelect(targetUid);
    expect(BattleSession.getSnapshot().handSelecting.n).toBe(1);
    expect(BattleSession.getSnapshot().hand).toHaveLength(initialHandSize + 1);

    BattleSession.commands.pickHandSelect(targetUid);
    expect(BattleSession.getSnapshot().handSelecting).toBeNull();
    expect(BattleSession.getSnapshot().hand).toHaveLength(initialHandSize + 2);
  });

  it('手牌不足时不进入支付、不扣能量也不移走原牌', () => {
    const game = start([paymentCard(), starter()]);
    const cardUid = game.ownedCards[0].uid;
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard(cardUid, 0);
    const after = BattleSession.getSnapshot();
    expect(after.energy).toBe(before.energy);
    expect(after.hand).toContain(cardUid);
    expect(game.logs.some(message => message.includes('作为出牌代价'))).toBe(false);
    expect(after.handSelecting).toBeNull();
  });

  it('通配支付期间 UID 仍在手牌但卡实例消失时，不消耗手牌或能量', () => {
    const game = start([paymentCard({ count: 1, type: null }), starter(), starter()]);
    const [cardUid, missingEntryUid] = game.ownedCards.map(entry => entry.uid);
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard(cardUid, 0);
    expect(BattleSession.getSnapshot().handSelecting).toMatchObject({ act: 'payment', type: null, n: 1 });

    game.ownedCards.splice(game.ownedCards.findIndex(entry => entry.uid === missingEntryUid), 1);
    BattleSession.commands.pickHandSelect(missingEntryUid);

    const after = BattleSession.getSnapshot();
    expect(after.handSelecting).toMatchObject({ act: 'payment', type: null, n: 1, selectedUids: [] });
    expect(after.hand).toEqual(before.hand);
    expect(after.energy).toBe(before.energy);
    expect(after.consumed).toEqual(before.consumed);
  });

  it('先完整选择两张支付牌，再一次性消耗并扣费结算三段伤害', async () => {
    const game = start([paymentCard(), starter(), starter()]);
    const [cardUid, firstPayUid, secondPayUid] = game.ownedCards.map(entry => entry.uid);
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard(cardUid, 0);
    let selecting = BattleSession.getSnapshot();
    expect(selecting.handSelecting).toMatchObject({ act: 'payment', mandatory: true, n: 2, selectedUids: [] });
    expect(selecting.energy).toBe(before.energy);
    expect(selecting.hand).toContain(cardUid);
    expect(game.logs.some(message => message.includes('作为出牌代价'))).toBe(false);

    BattleSession.commands.pickHandSelect(cardUid); // 原牌不能支付自己
    expect(BattleSession.getSnapshot().handSelecting.n).toBe(2);
    BattleSession.commands.pickHandSelect(firstPayUid);
    selecting = BattleSession.getSnapshot();
    expect(selecting.handSelecting).toMatchObject({ act: 'payment', n: 1, selectedUids: [firstPayUid] });
    expect(selecting.energy).toBe(before.energy);
    expect(selecting.hand).toContain(firstPayUid); // 选择阶段只暂存，尚未消费
    expect(game.logs.some(message => message.includes('作为出牌代价'))).toBe(false);

    BattleSession.commands.pickHandSelect(firstPayUid); // 同一 UID 不能重复支付
    expect(BattleSession.getSnapshot().handSelecting).toMatchObject({ act: 'payment', n: 1, selectedUids: [firstPayUid] });

    BattleSession.commands.pickHandSelect(secondPayUid);
    const after = await waitForIdle();
    expect(after.handSelecting).toBeNull();
    expect(after.energy).toBe(before.energy - 1);
    expect(after.hand).not.toContain(cardUid);
    expect(after.hand).not.toContain(firstPayUid);
    expect(after.hand).not.toContain(secondPayUid);
    expect(game.logs.filter(message => message.includes('作为出牌代价'))).toHaveLength(2);
    expect(after.foes[0].hp).toBe(44);
  });

  it('支付选择中撤出战斗不会提交部分支付、费用或出牌', () => {
    const game = start([paymentCard(), starter(), starter()]);
    const [cardUid, firstPayUid] = game.ownedCards.map(entry => entry.uid);
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard(cardUid, 0);
    BattleSession.commands.pickHandSelect(firstPayUid);
    expect(BattleSession.getSnapshot().hand).toContain(firstPayUid);
    expect(game.logs.some(message => message.includes('作为出牌代价'))).toBe(false);
    BattleSession.commands.flee();
    expect(game.lastBattleEnd).toMatchObject({ played: [], consumed: [], win: null });
    expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  });

  it('按稳定 ID 给缺少 rules 的旧战斗卡快照补齐 TT7 定义', () => {
    const legacy = { id: 'tt7-thundergrudge', name: '快意恩仇', cost: 1, type: '武术', dmg: 0, dmgType: 'attack', desc: '旧快照' };
    const legacyMeteor = { id: 'tt7-meteorrain', name: '流星箭雨', cost: 2, type: '武术', dmg: 1, dmgType: undefined, desc: '旧快照' };
    const game = makeGame([legacy, legacyMeteor, starter(), starter()]);
    activeGame = game;
    const uid = game.ownedCards[0].uid;
    expect(BattleSession.restore(game, {
      opts: { isBoss: false, name: '旧战斗快照 rules 回填' }, mode: 'normal', turn: 1, maxEnergy: 6, energy: 6,
      hand: game.ownedCards.map(entry => entry.uid), drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
      pdef: { shield: 0, armor: 0, guard: false }, pstat: { status: {} },
      foes: [{ id: 'legacy-snapshot-foe', name: '旧档靶子', hp: 20, maxHp: 20, atk: 1, dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } }],
      delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [],
    })).toBe(true);
    expect(viewApi.findCard(uid).card.rules).toMatchObject({
      battle: { requirements: [{ kind: 'handCards', count: 2, type: '初始攻击' }] },
      triggers: { onPlay: [{ hitCount: 3, retarget: 'livingFoes' }] },
    });
    expect(viewApi.findCard(game.ownedCards[1].uid).card).toMatchObject({
      dmg: -1, dmgType: 'attack',
      rules: { triggers: { onPlay: [{ hitCount: 2, retarget: 'livingFoes' }] } },
    });
  });
});
