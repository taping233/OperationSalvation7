import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { clearCardFeedback } from '../game/src/battle/view/battle.card-feedback.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 0) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { clearCardFeedback(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };
function makeGame(cards) {
  return { ownedCards: cards.map((card, i) => ({ uid: `runtime-${i}`, card: { ...card }, safe: false })),
    ...playerFields(100, 100, 5, 0, '战士', null), logs: [],
    log(message) { this.logs.push(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {}, };
}
async function settle() {
  await vi.advanceTimersByTimeAsync(1000);
  const preview = R.discovering?.sourceCommit === 'preview';
  expect(R.busy).toBe(preview);
  if (preview) {
    expect(R.discovering.cancelLabel).toBe('取消使用');
    expect(R.played).not.toContain('runtime-0');
  }
}






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
 const acquired=R.cardAnims.find(event=>event.kind==='draw'&&event.acquired&&event.uid===generated.uid);
 expect(acquired.card.id).toBe(option.id); expect(acquired.source).toBe(cast?'discover-cast':undefined);
 const stage=document.createElement('div'),overlay=document.createElement('div');overlay.id='overlay';overlay.append(stage);document.body.append(overlay);
 stage._battleToken=BattleSession.getSnapshot().battleToken;showBattleCardResults(stage,R.cardAnims);
 const effects=overlay.querySelectorAll('.fx-art-draw').length;expect(effects).toBeGreaterThan(0);
 showBattleCardResults(stage,R.cardAnims);expect(overlay.querySelectorAll('.fx-art-draw')).toHaveLength(effects);
 expect(overlay.querySelector('.bt-card-reveal')).toBeNull();expect(stage.textContent).toBe('');
});

it.each(['structured','legacy'])('灵能召唤%s路径先候选后授予，只有所选实例免注能',async path=>{
 const source={...canonical('cmtn1epgt20j')};if(path==='legacy')delete source.rules;
 const options=[1,2,3].map(i=>({id:`choice-${i}`,name:`注能候选${i}`,type:'法术',rarity:'稀有',cost:1,infuse:1,desc:'注能(1)：回复2点生命。'}));
 const game=makeGame([source]);BattleSession.start(game,[{id:'foe',name:'靶',hp:50,atk:0}],{isBoss:false});
 const before=R.granted.length;expect(before).toBe(5);
 vi.spyOn(C,'all').mockReturnValue(options);BattleSession.commands.playCard('runtime-0','self');await settle();
 expect(R.discovering.act).toBe('noInfuse');expect(R.discovering.options.length).toBe(3);expect(R.granted).toHaveLength(before);
 const chosen=R.discovering.options[1].id;BattleSession.commands.pickDiscover(1);await settle();
 expect(R.granted).toHaveLength(before+1);expect(R.granted[before].card).toMatchObject({id:chosen,_noInfuse:true});
 expect(options.every(option=>!Object.hasOwn(option,'_noInfuse'))).toBe(true);
 BattleSession.commands.pickDiscover(1);await settle();expect(R.granted).toHaveLength(before+1);
});

it('连续免注能发现每轮独立实例，退出后不授予旧候选',async()=>{
 const source={...canonical('cmtn1epgt20j'),rules:structuredClone(canonical('cmtn1epgt20j').rules)};source.rules.triggers.onPlay[0].n=2;
 const option={id:'repeat-infuse',name:'连续候选',type:'法术',rarity:'稀有',cost:1,infuse:1,desc:'注能(1)：回复2点生命。'};
 const game=makeGame([source]);BattleSession.start(game,[{id:'foe',name:'靶',hp:50,atk:0}],{isBoss:false});
 const before=R.granted.length;expect(before).toBe(5);
 vi.spyOn(C,'all').mockReturnValue([option]);BattleSession.commands.playCard('runtime-0','self');await settle();
 BattleSession.commands.pickDiscover(0);await settle();expect(R.discovering.act).toBe('noInfuse');expect(R.granted).toHaveLength(before+1);
 BattleSession.commands.pickDiscover(0);await settle();expect(R.granted).toHaveLength(before+2);expect(R.granted[before].uid).not.toBe(R.granted[before+1].uid);expect(R.granted[before].card).not.toBe(R.granted[before+1].card);expect(option._noInfuse).toBeUndefined();
 BattleSession.commands.flee();await settle();BattleSession.commands.pickDiscover(0);await settle();expect(R.discovering).toBeNull();
});
