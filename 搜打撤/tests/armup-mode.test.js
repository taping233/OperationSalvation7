// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Icons = { img: () => "", TYPE_ART: {} };
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








it.each([[false,false],[true,false],[false,true],[true,true]])('armup boss=%s text=%s',async(boss,text)=>{
 const arm={...canonical('tt7-armup')};if(text)delete arm.rules;
 const gear={id:'probe-gear',name:'测试装备',type:'装备',rarity:'古朴',cost:1,desc:'攻击力+1。'};
 const game=makeGame([arm,gear,gear]);
 BattleSession.start(game,[{id:'foe',name:'靶',hp:999,atk:0}],{isBoss:boss,directBossStart:boss});
 if(boss){for(const uid of ['runtime-1','runtime-2']){const i=R.hand.indexOf(uid);if(i>=0)R.hand.splice(i,1);if(!R.drawPile.includes(uid))R.drawPile.push(uid);}}
 const {unplayableReason}=await import('../game/src/battle/core/battle.core.js');
 const before={energy:R.energy,hand:[...R.hand],deck:[...R.drawPile]};
 const reason=unplayableReason(arm);const result=BattleSession.commands.playCard('runtime-0','self');await settle();
 expect(result?.ok).not.toBe(false);
 expect(reason).toBeFalsy();expect(R.energy).toBe(before.energy-1);
 if(boss){expect(R.hand).toContain('runtime-1');expect(R.hand).toContain('runtime-2');expect(R.drawPile).not.toContain('runtime-1');}
 else {
   expect(R.granted.filter(o=>o.card.id==='starter-attack')).toHaveLength(99);
   expect(R.drawPile).toEqual(before.deck);
   expect(R.hand).toEqual(before.hand.filter(uid=>uid!=='runtime-0'));
 }
 BattleSession.commands.flee();await settle();
});


it.each([['法术',0],['武术',2]])('旧文本定向抽%s只从本场99张初始攻击牌库筛选',async(type,drawn)=>{
 const custom={id:'custom-draw',name:'自定义定向抽牌',type:'法术',rarity:'古朴',cost:2,desc:`从牌库中抽取 2 张${type}牌。`};
 const game=makeGame([custom]);BattleSession.start(game,[{id:'foe',name:'靶',hp:999,atk:0}],{isBoss:false});
 const energy=R.energy;BattleSession.commands.playCard('runtime-0','self');await settle();
 expect(R.energy).toBe(energy-2);expect(R.granted).toHaveLength(99);
 expect(R.hand).toHaveLength(drawn);expect(R.drawPile).toHaveLength(99-drawn);
 expect(R.hand.every(uid=>R.granted.find(entry=>entry.uid===uid)?.card.id==='starter-attack')).toBe(true);
 BattleSession.commands.flee();await settle();
});
it('共享模式提示只解释当前定向抽牌，首脑及其它规则不追加普通战说明',async()=>{
 const {cardRuleHint}=await import('../game/src/battle/view/battle.preview.js');
 const card=canonical('tt7-armup');expect(cardRuleHint(card,'normal')).toBe('从本场牌库抽取符合类型的牌。');
 expect(cardRuleHint(card,'boss')).toBe('');expect(cardRuleHint({...card,rules:undefined},'normal')).toBe('从本场牌库抽取符合类型的牌。');
 expect(cardRuleHint(C.SHA,'normal')).toBe('');
 expect(cardRuleHint({...card,rules:{version:1,triggers:{onPlay:[{op:'heal',amount:2}]}}},'normal')).toBe('');
});
