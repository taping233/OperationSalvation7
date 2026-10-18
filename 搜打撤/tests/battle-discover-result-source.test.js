import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }






it.each([['tt3sp-magicoil',true],['tt12-magicfind',false]])('canonical %s projects actual source and execution',async(id,cast)=>{
 const card=canonical(id),potion=canonical('tt3-mixed-potion');const game=makeGame([card]);
 BattleSession.start(game,[{id:'foe',name:'靶',hp:20,atk:0}],{isBoss:false});
 const option=cast?potion:canonical('tt3sp-shadowbug');
 vi.spyOn(C,'all').mockReturnValue([option]);const energy=R.energy;
 BattleSession.commands.playCard('runtime-0','self');await settle();
 expect(R.discovering.options[0].id).toBe(option.id);
 BattleSession.commands.pickDiscover(0);await settle();
 const generated=R.granted.find(o=>o.card.id===option.id);
 expect(R.hand.includes(generated.uid)).toBe(!cast);
 expect(R.foes[0].hp).toBe(cast?18:20);
 if(cast)expect(R.foes[0].status.bleed).toBe(1);
 expect(R.energy).toBe(energy-card.cost);
 const stage=document.createElement('div'),overlay=document.createElement('div');overlay.append(stage);showBattleCardResults(stage,R.cardAnims);
 expect(stage.textContent).toContain(cast?'发现卡牌 · 排队施放':'获得卡牌 · 置入手牌');
 expect(stage.textContent).not.toContain(cast?'获得卡牌 · 置入手牌':'发现卡牌 · 排队施放');
});
