import { afterEach, beforeEach, expect, it, vi } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../../../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../../../game/src/battle/core/battle.core.js');
const { addTempCard, queueCardExecution, finish, processDelayed, resolveCard } = await import('../../../game/src/battle/core/battle.engine.js');
const { createBattleDraw } = await import('../../../game/src/battle/core/battle.draw.js');
const R = await import('../../../game/src/battle/runtime/battle.runtime.js');
let game;
const healItem = { id: 'temp-heal', name: '临时回复道具', type: '道具', cost: 0, desc: '回复3点生命' };
const bar = () => BattleSession.getSnapshot().potionBar;
beforeEach(() => {
  vi.useFakeTimers(); R.set$lastDeckSel([]);
  game = { ownedCards: [{ uid: 'permanent-last', card: { ...C.SHA }, safe: false }],
    hp: 30, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, log() {}, heal(n) { this.hp += n; }, addItem() {}, onBattleEnd: vi.fn() };
  BattleSession.start(game, [{ id: 'target', name: '靶子', hp: 10000, atk: 1, behavior: 'strike' }], { isBoss: false });
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
it('review: expiring temporary item is consumed at the next turn start', async () => {
  const uid = addTempCard(healItem);
  R.delayed.push({ special: 'consumeTemps', uids: [uid], cardName: '江湖救急' });
  await processDelayed();
  expect(R.consumed).toContain(uid);
  expect(bar().some(o => o.uid === uid)).toBe(false);
});
it('review: priest fills hand from a real mixed catalog without granting items', () => {
  const hero = C.all().find(c => c.id === 'tt8-hero-priest');
  const item = C.all().find(c => c.type === '道具' && C.isRandomObtainable(c) && !c.rules?.triggers?.onAcquire);
  const spell = C.all().find(c => c.type === '法术' && C.isRandomObtainable(c) && !c.rules?.triggers?.onAcquire);
  const spy = vi.spyOn(C, 'all').mockReturnValue([item, spell]);
  try {
    resolveCard(hero, null, false, 0);
    expect(R.hand).toHaveLength(6);
    expect(bar()).toHaveLength(0);
  } finally { spy.mockRestore(); }
});
it('review: legacy random fill terminates when only item candidates exist', async () => {
  const { killsSteps } = await import('../../../game/src/battle/effects/effect-steps.kills.js');
  const { buildDiscoverPool } = await import('../../../game/src/battle/effects/battle.discover-candidates.js');
  let grants = 0;
  const step = killsSteps({
    getHandSize: () => 1,
    randomDiscoverCard: pred => buildDiscoverPool([healItem], { pred, isRandomObtainable: () => true })[0] || null,
    addTempCard: () => { if (++grants > 10) throw new Error('Non-progress loop exceeded 10 grants'); },
    log: vi.fn(), esc: x => x,
  }).find(s => s.id === 'hand.fillRandom');
  const ctx = { desc: '置入随机卡牌直至手牌达到6张', card: { name: '旧文本验证' } };
  expect(() => step.run(ctx, step.when(ctx))).not.toThrow();
});
it('review: hosted priest terminates when only item candidates exist', () => {
  const hero = C.all().find(c => c.id === 'tt8-hero-priest');
  const item = C.all().find(c => c.type === '道具' && C.isRandomObtainable(c) && !c.rules?.triggers?.onAcquire);
  let calls = 0;
  const spy = vi.spyOn(C, 'all').mockImplementation(() => {
    if (++calls > 20) throw new Error('Non-progress loop exceeded 20 candidate calls');
    return [item];
  });
  try { expect(() => resolveCard(hero, null, false, 0)).not.toThrow(); }
  finally { spy.mockRestore(); }
});
