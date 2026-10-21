import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readConsumedPile, takeConsumedCard } from '../game/src/battle/bag/battle.consumed-pile.js';
import { consumedPileUids } from '../game/src/battle/view/battle.piles.view.js';

window.SDT = { Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 30, battleHandMax: 200, bossDeckSize: 99, starterSha: 0,
    battleStartDraw: 99, battleTurnDraw: 1, diceSides: 6 }, items: {} } };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const settle = () => vi.advanceTimersByTimeAsync(3000);
let liveGame;
const strike = id => ({ id, name: `打出牌${id}`, type: '武术', cost: 0, dmg: 2, dmgType: 'fixed', desc: '',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } },
    triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } });
const recall = amount => ({ id: 'unified-recall', name: '统一取回复活', type: '法术', cost: 0,
  desc: `复活最多${amount}张卡牌。`, rules: { version: 1, battle: { target: { side: 'self', area: false } } } });

async function startLive(cards, mode = 'normal') {
  liveGame = { ownedCards: cards.map((card, index) => ({ uid: `live-${index}`, card: structuredClone(card), safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, turn: 1, myClass: '侠客', characterId: null,
    cardOrder: [], usedPocket: [], eventLog: [], inventory: [], state: 'idle', battleActive: false,
    log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd(opts, played, win, consumed) { this.ended = { opts, played, win, consumed }; } };
  BattleSession.start(liveGame, [{ id: 'unified-target', name: '统一牌堆靶', hp: 9999, atk: 0 }],
    { isBoss: mode === 'boss', directBossStart: mode === 'boss' });
  await settle();
  return liveGame;
}
async function playLive(uid, side = 0) {
  BattleSession.commands.playCard(uid, side); await settle();
  return BattleSession.getSnapshot();
}
function assertUiPool(snapshot) {
  expect(consumedPileUids(snapshot)).toEqual(snapshot.consumedPile);
  expect(new Set(snapshot.consumedPile).size).toBe(snapshot.consumedPile.length);
  expect(Object.isFrozen(snapshot.consumedPile)).toBe(true);
}
beforeEach(() => { vi.useFakeTimers(); runtime.set$lastDeckSel([]); });
afterEach(() => {
  if (runtime.G?.battleActive) engine.finish(null);
  liveGame = null;
  vi.clearAllTimers(); vi.useRealTimers();
});

const fixture = () => ({
  hand: ['held'], drawPile: ['queued'],
  played: ['used', 'both', 'held', 'used'],
  consumed: ['fuel', 'both', 'queued'],
  discard: ['discarded', 'used'], grave: ['grave-only', 'fuel'],
});

describe('统一消耗牌堆通过真实BattleSession取回', () => {
  it.each(['normal', 'boss'])('%s：真实出牌/手牌支付进入同源，复活取回原UID且不自取源牌', async mode => {
    const payer = strike('unified-payer');
    payer.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '武术' }];
    await startLive([payer, strike('unified-fuel'), recall(2)], mode);
    expect(runtime.hand).toEqual(expect.arrayContaining(['live-0', 'live-1', 'live-2']));
    BattleSession.commands.playCard('live-0', 0);
    expect(BattleSession.getSnapshot().handSelecting.act).toBe('payment');
    BattleSession.commands.pickHandSelect('live-1'); await settle();
    const before = BattleSession.getSnapshot();
    assertUiPool(before);
    expect(before.consumedPile).toEqual(['live-0', 'live-1']);
    expect(before.played).toContain('live-0');
    expect(before.consumed).toContain('live-1');
    const grantedUids = runtime.granted.map(entry => entry.uid);
    const after = await playLive('live-2', 'self');
    assertUiPool(after);
    expect(after.hand).toEqual(expect.arrayContaining(['live-0', 'live-1']));
    expect(after.hand).not.toContain('live-2');
    expect(after.consumedPile).toEqual(['live-2']);
    for (const name of ['played', 'consumed', 'discard', 'grave']) {
      expect(after[name]).not.toContain('live-0'); expect(after[name]).not.toContain('live-1');
    }
    expect(runtime.granted.map(entry => entry.uid)).toEqual(grantedUids);
    expect(liveGame.ownedCards.map(entry => entry.uid)).toEqual(['live-0', 'live-1', 'live-2']);
    BattleSession.commands.playCard('live-0', 0);
    BattleSession.commands.pickHandSelect('live-1'); await settle();
    const again = BattleSession.getSnapshot();
    expect(again.played).toContain('live-0');
    expect(again.consumed).toContain('live-1');
    expect(again.consumed).not.toContain('live-0');
    expect(again.consumedPile).toEqual(expect.arrayContaining(['live-0', 'live-1', 'live-2']));
  });

  it.each(['normal', 'boss'])('%s：没有已完成牌时复活源不进入自己的取回池', async mode => {
    await startLive([recall(3)], mode);
    const granted = runtime.granted.map(entry => entry.uid);
    const after = await playLive('live-0', 'self');
    assertUiPool(after);
    expect(after.hand).not.toContain('live-0');
    expect(after.consumedPile).toEqual(['live-0']);
    expect(runtime.granted.map(entry => entry.uid)).toEqual(granted);
  });

  it.each(['normal', 'boss'])('%s：旧档四源混合去重，取回清重影，未取回账本保留原类别', async mode => {
    await startLive([strike('left-played'), strike('left-consumed'), strike('from-discard'), strike('from-grave'), recall(2)], mode);
    const saved = { opts: { isBoss: mode === 'boss' }, mode, turn: 2, energy: 30, maxEnergy: 30,
      hand: ['live-4'], drawPile: [], played: ['live-0'], consumed: ['live-1'],
      discard: ['live-2', 'live-0'], grave: ['live-3', 'live-1'], granted: [],
      pdef: { shield: 0, armor: 0, guard: false }, pstat: { status: {} },
      foes: [{ id: 'restored-unified-target', name: '旧档统一靶', hp: 9999, maxHp: 9999, atk: 0,
        dead: false, status: {}, defense: {} }], delayed: [], growth: {}, growthNames: [],
      zeroFeeUntil: [], cardOverrides: [] };
    expect(BattleSession.restore(liveGame, JSON.parse(JSON.stringify(saved)))).toBe(true);
    await settle();
    const before = BattleSession.getSnapshot();
    assertUiPool(before);
    expect(before.consumedPile).toEqual(['live-0', 'live-1', 'live-2', 'live-3']);
    const after = await playLive('live-4', 'self');
    assertUiPool(after);
    expect(after.hand).toEqual(expect.arrayContaining(['live-2', 'live-3']));
    expect(after.played).toEqual(['live-0', 'live-4']);
    expect(after.consumed).toEqual(['live-1']);
    expect(after.grave).toEqual(['live-1']);
    expect(after.discard).toEqual(mode === 'boss' ? ['live-0', 'live-4'] : ['live-0']);
    expect(after.consumedPile).toEqual(['live-0', 'live-4', 'live-1']);
    expect(runtime.granted).toEqual([]);
    engine.finish(true); await settle();
    expect(liveGame.ended.played).toEqual(['live-0', 'live-4']);
    expect(liveGame.ended.consumed).toEqual(['live-1']);
  });

  it('普通99临时牌取回再打出仍用原UID，战后继续排除永久入库模板', async () => {
    await startLive([recall(1)]);
    expect(engine.drawCards(1)).toBe(1);
    const starter = runtime.hand.find(uid => uid.startsWith('normal-sha-'));
    expect(starter).toBeTruthy();
    await playLive(starter, 0);
    const granted = runtime.granted.map(entry => entry.uid);
    await playLive('live-0', 'self');
    expect(runtime.hand).toContain(starter);
    expect(runtime.played).not.toContain(starter);
    expect(runtime.granted.map(entry => entry.uid)).toEqual(granted);
    await playLive(starter, 0);
    expect(consumedPileUids(BattleSession.getSnapshot())).toContain(starter);
    engine.finish(true); await settle();
    expect(liveGame.ended.played).toContain(starter);
    expect(liveGame.ended.opts.spentCards.some(entry => entry.uid === starter)).toBe(false);
    expect(liveGame.ownedCards.every(entry => !entry.uid.startsWith('normal-sha-'))).toBe(true);
    expect(runtime.granted).toEqual([]);
  });
});

describe('统一消耗牌堆纯域边界', () => {
  it('按四个旧源顺序去重，排除可用区和当前结算UID；查询不改输入', () => {
    const state = fixture();
    const before = JSON.stringify(state);
    for (const value of Object.values(state)) Object.freeze(value);
    Object.freeze(state);
    expect(readConsumedPile(state)).toEqual(['used', 'both', 'fuel', 'discarded', 'grave-only']);
    expect(readConsumedPile(state, new Set(['used', 'grave-only'])))
      .toEqual(['both', 'fuel', 'discarded']);
    expect(JSON.stringify(state)).toBe(before);
  });

  it.each(['normal', 'boss'])('同样的UID状态在%s模式读出同一真实集合', mode => {
    expect(readConsumedPile({ ...fixture(), mode }))
      .toEqual(['used', 'both', 'fuel', 'discarded', 'grave-only']);
  });

  it('取回原UID到手牌，清所有旧重影而不重分其他牌的战后类别', () => {
    const state = fixture();
    state.discard.push('both'); state.grave.push('both', 'both');
    const sourceArrays = Object.fromEntries(Object.entries(state));
    expect(takeConsumedCard(state, 'both', 'hand')).toBe(true);
    expect(state).toEqual({
      hand: ['held', 'both'], drawPile: ['queued'],
      played: ['used', 'held', 'used'], consumed: ['fuel', 'queued'],
      discard: ['discarded', 'used'], grave: ['grave-only', 'fuel'],
    });
    for (const name of Object.keys(sourceArrays)) expect(state[name]).toBe(sourceArrays[name]);
    expect(readConsumedPile(state)).not.toContain('both');
    expect(takeConsumedCard(state, 'both', 'hand')).toBe(false);
    expect(state.hand.filter(uid => uid === 'both')).toHaveLength(1);
  });

  it('取回到库顶不复制实例、不洗牌，也不改其他UID顺序', () => {
    const state = fixture();
    expect(takeConsumedCard(state, 'fuel', 'draw')).toBe(true);
    expect(state.drawPile).toEqual(['queued', 'fuel']);
    expect(state.consumed).toEqual(['both', 'queued']);
    expect(state.grave).toEqual(['grave-only']);
    expect(readConsumedPile(state)).toEqual(['used', 'both', 'discarded', 'grave-only']);
    expect(takeConsumedCard(state, 'fuel', 'hand')).toBe(false);
    expect(state.drawPile.at(-1)).toBe('fuel');
  });

  it.each([
    ['held', 'hand', []],
    ['queued', 'hand', []],
    ['missing', 'hand', []],
    ['used', 'hand', ['used']],
    ['used', 'unsupported', []],
  ])('拒绝不可取回的UID或目标而保持现场：%s→%s', (uid, destination, excluded) => {
    const state = fixture();
    const before = JSON.stringify(state);
    expect(takeConsumedCard(state, uid, destination, excluded)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('保留开战装备的原有取回范围，不清装备登记或生成其他UID', () => {
    const equipment = { uid: 'gear', card: { id: 'equipment' } };
    const state = { hand: [], drawPile: [], played: [], consumed: ['gear'], discard: [],
      grave: ['gear'], equipped: [equipment] };
    expect(readConsumedPile(state)).toEqual(['gear']);
    expect(takeConsumedCard(state, 'gear', 'hand')).toBe(true);
    expect(state.hand).toEqual(['gear']);
    expect(state.equipped).toEqual([equipment]);
    expect(state.equipped[0]).toBe(equipment);
  });

  it('旧快照缺少部分源数组时只读已有UID，目标缺失时不做部分清理', () => {
    expect(readConsumedPile(null)).toEqual([]);
    expect(readConsumedPile({ grave: ['old'] })).toEqual(['old']);
    const state = { consumed: ['old'] };
    expect(takeConsumedCard(state, 'old', 'hand')).toBe(false);
    expect(state).toEqual({ consumed: ['old'] });
  });
});
