import {careerSkillButtonHTML} from '../game/src/battle/view/battle.skill-view.js';
import {slamSkillFor} from '../game/src/battle/bag/battle.slam-skill.js';
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







it.each([false,true])('scavenge mode=%s uses matching destination and pool',async boss=>{
 const potion=canonical('tt3-turnabout-potion'),spell=canonical('tt3sp-shadowbug');const game=makeGame([C.SHA]);game.myClass='法师';
 BattleSession.start(game,[{id:'foe',name:'靶',hp:100,atk:0}],{isBoss:boss,directBossStart:boss});
 vi.spyOn(C,'all').mockReturnValue(boss?[potion,spell]:[potion]);
 const before={hand:R.hand.length,deck:R.drawPile.length,energy:R.energy};
 const skill=BattleSession.commands.slamSkill();
 const host=document.createElement('div');host.innerHTML=careerSkillButtonHTML({skill,state:'ready',availability:'可用',effect:skill.hint,disabled:false});
 expect(host.querySelector('[data-ui-tip]').dataset.uiTipText).toContain(boss?'非道具卡洗入牌库':'卡牌入手牌');
 expect(host.querySelector('button').getAttribute('aria-label')).toContain(boss?'洗入牌库':'入手牌');
 BattleSession.commands.bagSlam();await settle();
 const generated=R.granted.find(o=>o.card.id===(boss?spell.id:potion.id));expect(generated).toBeTruthy();
 expect(R.hand.length).toBe(before.hand+(boss?0:1));expect(R.drawPile.length).toBe(before.deck+(boss?1:0));expect(R.energy).toBe(before.energy-1);
 expect(game.logs.some(log=>log.includes(boss?'洗入牌库':'置入手牌'))).toBe(true);
 expect(BattleSession.commands.slamSkill().used).toBe(true);
 BattleSession.commands.bagSlam();await settle();expect(R.energy).toBe(before.energy-1);
 expect(R.granted.filter(o=>o.card.id===(boss?spell.id:potion.id))).toHaveLength(1);
 BattleSession.commands.flee();await settle();
});
it('empty boss pool retains existing fee/use semantics and gives explicit feedback',async()=>{
 const potion=canonical('tt3-turnabout-potion'),game=makeGame([C.SHA]);game.myClass='法师';
 BattleSession.start(game,[{id:'foe',name:'靶',hp:100,atk:0}],{isBoss:true,directBossStart:true});
 vi.spyOn(C,'all').mockReturnValue([potion]);const before={energy:R.energy,hand:R.hand.length,deck:R.drawPile.length};
 BattleSession.commands.bagSlam();await settle();
 expect(R.energy).toBe(before.energy-1);expect(R.hand.length).toBe(before.hand);expect(R.drawPile.length).toBe(before.deck);
 expect(game.logs.some(log=>log.includes('搜刮：没有可获得的卡牌'))).toBe(true);expect(BattleSession.commands.slamSkill().used).toBe(true);
 BattleSession.commands.flee();await settle();
});
it('selection explains both destinations while unrelated skill descriptions stay unchanged',()=>{
 expect(slamSkillFor('法师').hint).toContain('普通战入手，首脑战排除道具并洗入牌库');
 expect(slamSkillFor('战士',false,'boss')).toEqual(slamSkillFor('战士',false,'normal'));
 expect(slamSkillFor('牧师',true,'boss').name).toBe('惩戒');
});
