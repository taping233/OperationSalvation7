// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 1, diceSides: 6 }, items: {} };
await import('../../../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../../../game/src/battle/core/battle.core.js');
const R = await import('../../../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { R.bindBattleRenderer(() => {}); vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
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






function begin(cards, hp = [100]) {
  const game = makeGame(cards);
  BattleSession.start(game, hp.map((value, i) => ({ id: `foe-${i}`, name: `靶${i}`, hp: value, atk: 0 })), { isBoss: false });
  R.takeBattleCardAnims();
  return game;
}
const {queueCardExecution, addPlayerCurse} = await import('../../../game/src/battle/core/battle.engine.js');
it('同回合两次真实邪能护体，下回合必须失去临时诅咒免疫', async () => {
  const card = canonical('tt12-felguard');
  const fuel = canonical('tt7-elementstorm');
  begin([card,card,fuel,fuel,fuel,fuel]);
  expect(R.playerCurseImmune).toBe(false);
  expect(queueCardExecution('runtime-0',card,['runtime-2','runtime-3'],null,false)).not.toBe(false);
  await settle();
  expect(R.playerCurseImmune).toBe(true);
  expect(queueCardExecution('runtime-1',card,['runtime-4','runtime-5'],null,false)).not.toBe(false);
  await settle();
  expect(R.delayed.filter(q=>q.special==='curseImmuneOff').map(q=>q.restore)).toEqual([false]);
  BattleSession.commands.endTurn();
  await settle();
  expect(R.turn).toBe(2);
  expect(R.delayed.filter(q=>q.special==='curseImmuneOff')).toHaveLength(0);
  addPlayerCurse('poison',1);
  expect.soft(R.playerCurseImmune, '本回合效果不能永久化').toBe(false);
  expect(R.pstat.status.poison).toBe(1);
});
