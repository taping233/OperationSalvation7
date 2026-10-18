import { afterEach, expect, it, vi } from 'vitest';
window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
afterEach(() => { delete window.SDT.Art; vi.clearAllTimers(); vi.useRealTimers(); });
it('battle entry and checkpoint restore only request card art, using existing warm', () => {
  vi.useFakeTimers();
  const card = { id: 'warm-test-card', name: '测试攻击', type: '武术', cost: 1, desc: '攻击。', dmg: 1, dmgType: 'attack' };
  const warm = vi.fn(), collectCardAssets = vi.fn(() => ['same-card.webp']);
  window.SDT.Art = { warm, collectCardAssets };
  const game = { ownedCards: [{ uid: 'one', card }], inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 5,
    spellPower: 0, coins: 0, myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
    log() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'infantry', name: '靶子', hp: 20, atk: 1, behavior: 'strike' }], { isBoss: false });
  expect(collectCardAssets).toHaveBeenLastCalledWith([card], { includePortraits: false });
  expect(warm).toHaveBeenLastCalledWith(['same-card.webp'], { retain: false });
  const saved = BattleSession.serialize();
  expect(BattleSession.restore(game, saved)).toBe(true);
  expect(collectCardAssets).toHaveBeenCalledTimes(2);
  expect(collectCardAssets.mock.calls[1][1]).toEqual({ includePortraits: false });
  expect(warm).toHaveBeenLastCalledWith(['same-card.webp'], { retain: false });
});
