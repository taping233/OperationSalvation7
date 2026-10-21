import { discoverInfusionNote } from '../game/src/battle/view/battle.discover-infusion.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { battleEnergy: 99, battleHandMax: 20, bossDeckSize: 15, starterSha: 0, battleStartDraw: 20, battleTurnDraw: 0, diceSides: 6 }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, infuseOf } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$allSpellsInfused(false); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
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






it.each([false, true])('real raygun→dragon: waiver=%s, direct cast releases as infused', async waiver => {
 const gun=canonical('tt12-raygun'), dragon=canonical('tt12-raydragon');
 const game=makeGame([gun]); BattleSession.start(game,[{id:'foe',name:'靶',hp:40,atk:0}],{isBoss:false});
 R.set$energy(2); R.set$allSpellsInfused(waiver);
 BattleSession.commands.playCard('runtime-0','self'); await settle();
 vi.spyOn(C,'all').mockReturnValue([dragon]);
 BattleSession.commands.useEquipSkill('runtime-0'); await settle();
 expect(R.discovering.act).toBe('play'); expect(R.discovering.options[0].id).toBe(dragon.id);
 const note=discoverInfusionNote(R.discovering.act,infuseOf(dragon));
 expect(note).toBe(waiver?'':'未注能，直释视为已注能');
 const host=document.createElement('div');host.innerHTML=battleDiscoverBodyHTML({candidates:[{card:dragon,infusionNote:note}],cardHTML:()=>'',action:'选择1张免费施放',remaining:1});
 expect(host.querySelector('button').getAttribute('aria-label').includes('未注能')).toBe(!waiver);
 expect(host.textContent.includes('未注能')).toBe(!waiver);
 BattleSession.commands.pickDiscover(0); await settle();
 // 直释视为已注能：waiver 与否都按已注能结算（11 伤），生成牌均被释放、不留在手牌。
 expect(R.foes[0].hp).toBe(29); expect(R.energy).toBe(2);
 expect(R.infuseFuels).toBe(0);expect(R.equipped[0].used).toBe(true);
 expect(R.infusing).toBeFalsy();expect(R.interaction).toBeFalsy();
 const generated=R.granted.find(entry=>entry.card.id===dragon.id);
 expect(generated).toBeTruthy();
 expect(R.hand).not.toContain(generated.uid);
});

it('labels only direct free-cast candidates and uses effective waiver state without guessing effectiveness',()=>{
 const dragon=canonical('tt12-raydragon');
 expect(discoverInfusionNote('play',infuseOf({...dragon,_noInfuse:true}))).toBe('');
 for(const act of ['play','potion','playKeep','pouch'])expect(discoverInfusionNote(act,1)).toBe('未注能，直释视为已注能');
 for(const act of [undefined,'dup','keep'])expect(discoverInfusionNote(act,1)).toBe('');
 expect(discoverInfusionNote('play',0)).toBe('');
 const mixed=canonical('tt3sp-silverthorn');expect(discoverInfusionNote('play',infuseOf(mixed))).toBe('未注能，直释视为已注能');
 expect(discoverInfusionNote('play',1)).not.toContain('不生效');
});

it('explains direct-cast treating uninfused cards as infused in candidate copy', () => {
 const card=canonical('tt12-raydragon');
 expect(discoverInfusionNote('play',1,card)).toContain('直释视为已注能');
 expect(discoverInfusionNote('pouch',1,card)).toContain('直释视为已注能');
 expect(discoverInfusionNote('play',0,card)).toBe('');
});
