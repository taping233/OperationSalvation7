// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }





async function start(boss = true, double = false) {
 const game = makeGame([canonical('tt8-hero-mage'), canonical('tt3-fate-wheel'), ...(double ? [canonical('tt8-hero-mage')] : [])]);
 game.hp = 100;
 BattleSession.start(game, [{id:'foe',name:'回合靶',hp:999,atk:2,behavior:'strike'}], {isBoss:boss});
 if (boss) {
   for (const card of BattleSession.getSnapshot().deckSelection.cards) BattleSession.commands.selectDeckCard(card.uid);
   BattleSession.commands.confirmDeck();
   await settle();
 }
 BattleSession.commands.playCard('runtime-0', null, true);
 await settle();
 if (double) { BattleSession.commands.playCard('runtime-2', null, true); await settle(); }
 return game;
}
async function nextTurn(clock = false) {
 if (clock) {
   BattleSession.commands.playCard('runtime-1', 'self', true); await settle();
   BattleSession.commands.useEquipSkill('runtime-1'); await settle();
   expect(BattleSession.getSnapshot().endTurnContext.extraTurn).toBe(true);
 }
 BattleSession.commands.endTurn();
 await settle();
 return BattleSession.getSnapshot();
}
it.each([false,true])('首脑回合开始真实发现并获得候选，钟表=%s', async clock => {
 await start();
 const state = await nextTurn(clock);
 expect(state).toMatchObject({turn:2,phase:'player',busy:false});
 expect(state.discovering).toBeTruthy();
 const picked = state.discovering.options[0];
 const before = state.hand.length;
 BattleSession.commands.endTurn(); // 选择未结束时不能跳回合。
 expect(BattleSession.getSnapshot().turn).toBe(2);
 BattleSession.commands.pickDiscover(0); await settle();
 const after = BattleSession.getSnapshot();
 expect(after.discovering).toBeNull();
 expect(after.hand.length).toBe(before + 1);
 expect(R.granted.some(o => o.card.id === picked.id && after.hand.includes(o.uid))).toBe(true);
 expect(after.busy).toBe(false);
});
it.each([false,true])('普通战能力卡不在初手，不制造发现，钟表=%s', async clock => {
 await start(false);
 expect(R.hand).not.toContain('runtime-0');
 expect(BattleSession.getSnapshot().pstat.status.spellUp || 0).toBe(0);
 const state = await nextTurn(clock);
 expect(state.turn).toBe(2); expect(state.discovering).toBeNull();
});
it('两个持续发现依次领取，下回合重新触发且没有重复打开', async () => {
 await start(true, true);
 let state = await nextTurn();
 const before = state.hand.length;
 expect(state.discovering).toBeTruthy();
 BattleSession.commands.pickDiscover(0); await settle();
 state = BattleSession.getSnapshot(); expect(state.discovering).toBeTruthy();
 BattleSession.commands.pickDiscover(0); await settle();
 state = BattleSession.getSnapshot(); expect(state.discovering).toBeNull();
 expect(state.hand.length).toBe(before + 2);
 BattleSession.commands.pickDiscover(0); await settle();
 expect(BattleSession.getSnapshot().hand.length).toBe(before + 2);
 state = await nextTurn(); expect(state.turn).toBe(3); expect(state.discovering).toBeTruthy();
});
it('敌方回合死亡不弹出回合开始发现', async () => {
 const game = await start(); game.hp = 1;
 const state = await nextTurn();
 expect(game.battleActive).toBe(false); expect(state.discovering).toBeNull();
});
it('待发现时离开战斗后旧领取命令不把奖励带入新战斗', async () => {
 await start(); const state = await nextTurn(); expect(state.discovering).toBeTruthy();
 BattleSession.commands.flee(); await settle();
 await start(false);
 const before = BattleSession.getSnapshot().hand.slice();
 BattleSession.commands.pickDiscover(0); await settle();
 expect(BattleSession.getSnapshot().hand).toEqual(before);
 expect(BattleSession.getSnapshot().discovering).toBeNull();
});

it('回合过渡中末敌死亡后不弹出发现', async () => {
 const game = await start();
 R.foes[0].hp = 1; R.foes[0].status.poison = 1;
 const state = await nextTurn();
 expect(game.battleActive).toBe(false);
 expect(state.discovering).toBeNull();
});
it('回合过渡未完成时换会话，旧异步收尾不会在新战斗弹发现', async () => {
 await start();
 BattleSession.commands.endTurn();
 await start(false);
 await settle();
 const state = BattleSession.getSnapshot();
 expect(state.turn).toBe(1);
 expect(state.discovering).toBeNull();
 expect(state.busy).toBe(false);
});
