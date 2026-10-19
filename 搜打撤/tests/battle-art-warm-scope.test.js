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
  const item = {id:'warm-item',name:'道具',type:'道具',desc:''};
  const ability = {id:'warm-ability',name:'能力',type:'能力卡',desc:''};
  const nonCombat = ['资源','事件','生物'].map((type,i)=>({uid:`other-${i}`,card:{id:`other-${i}`,name:type,type,desc:''}}));
  const game = { ownedCards: [{ uid: 'one', card }, {uid:'item',card:item}, {uid:'ability',card:ability}, ...nonCombat], inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 5,
    spellPower: 0, coins: 0, myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
    log() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'infantry', name: '靶子', hp: 20, atk: 1, behavior: 'strike' }], { isBoss: false });
  expect(collectCardAssets).toHaveBeenLastCalledWith([card,item,ability], { includePortraits: false });
  expect(warm).toHaveBeenLastCalledWith(['same-card.webp'], { retain: false });
  const saved = BattleSession.serialize();
  expect(BattleSession.restore(game, saved)).toBe(true);
  expect(collectCardAssets).toHaveBeenCalledTimes(2);
  expect(collectCardAssets.mock.calls[1][0]).toEqual([card,item,ability]);
  expect(game.ownedCards).toHaveLength(6);
  expect(collectCardAssets.mock.calls[1][1]).toEqual({ includePortraits: false });
  expect(warm).toHaveBeenLastCalledWith(['same-card.webp'], { retain: false });
});
