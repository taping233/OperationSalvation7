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
const { cardResultRows } = await import('../game/src/battle/view/battle.card-results.js');

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










it.each([[1,false],[2,false],[1,true]])('铸甲支付剑触发一次标准攻击 foes%s existingSha%s',async(n,sha)=>{
 const game=makeGame([canonical('tt2-turtlearmor'),canonical('tt3-azure-sword'),...(sha?[C.SHA]:[])]);
 BattleSession.start(game,Array.from({length:n},(_,i)=>({id:'foe'+i,name:'靶'+i,hp:12,atk:0})),{isBoss:false});
 BattleSession.commands.playCard('runtime-0','self');await settle();
 BattleSession.commands.pickHandSelect('runtime-1');await settle();
 expect(R.foes.map(f=>f.hp)).toEqual(n===1?[7]:[7,12]);expect(R.pdef.armor).toBe(10);
 expect(R.energy).toBe(98);expect(R.consumed.filter(u=>u==='runtime-1')).toHaveLength(1);
 expect(R.granted.filter(o=>o.card.id==='starter-attack')).toHaveLength(1);
 const generated=R.granted.find(o=>o.card.id==='starter-attack');expect(R.played).toContain(generated.uid);expect(R.hand).not.toContain(generated.uid);
 expect(R.cardAnims.find(e=>e.kind==='draw' && e.uid===generated.uid)?.source).toBe('effect-cast');
 expect(cardResultRows(R.cardAnims).some(row=>row.kind==='effectCast' && row.cards.has(C.SHA.name))).toBe(true);
 if(sha)expect(R.hand).toContain('runtime-2');
 BattleSession.commands.pickHandSelect('runtime-1');await settle();expect(R.foes[0].hp).toBe(7);
 BattleSession.commands.flee();await settle();
});
it.each([false,true])('沉船宝盒支付基础两张且获取派生独立结算 gift%s',async giftFirst=>{
 const game=makeGame([canonical('tt2-turtlearmor'),canonical('tt2-wreck')]);
 const gift=canonical('tt2-apollo'),plain=canonical('tt3-ice-spike');
 expect([gift,plain].every(card=>C.isRandomObtainable(card))).toBe(true);
 BattleSession.start(game,[{id:'foe',name:'靶',hp:12,atk:0}],{isBoss:false});
 // 仅固定随机候选池；支付、获取被动与入手仍走真实生产管线。
 vi.spyOn(C,'all').mockImplementation(()=>giftFirst&&!R.granted.some(entry=>entry.card.id===gift.id)?[gift]:[plain]);
 BattleSession.commands.playCard('runtime-0','self');await settle();BattleSession.commands.pickHandSelect('runtime-1');await settle();
 const expected=giftFirst?[gift.id,plain.id,plain.id]:[plain.id,plain.id];
 expect(R.granted.map(entry=>entry.card.id)).toEqual(expected);
 expect(R.granted.every(entry=>R.hand.includes(entry.uid))).toBe(true);
 expect(R.foes[0].hp).toBe(12);expect(R.energy).toBe(giftFirst?99:98);expect(R.pdef.armor).toBe(10);
 expect(R.consumed.filter(uid=>uid==='runtime-1')).toHaveLength(1);
 const granted=R.granted.map(entry=>entry.uid);
 BattleSession.commands.pickHandSelect('runtime-1');await settle();
 expect(R.granted.map(entry=>entry.uid)).toEqual(granted);
 expect(R.energy).toBe(giftFirst?99:98);expect(R.pdef.armor).toBe(10);expect(R.foes[0].hp).toBe(12);
 BattleSession.commands.flee();await settle();
});
it('注能消耗剑使用同一触发且不另收费',async()=>{
 const source={id:'infuse',name:'注能护盾',type:'法术',cost:1,infuse:1,desc:'注能(1)：获得 6 点护盾。'};
 const game=makeGame([source,canonical('tt3-azure-sword')]);BattleSession.start(game,[{id:'foe',name:'靶',hp:12,atk:0}],{isBoss:false});
 BattleSession.commands.playCard('runtime-0',null);BattleSession.commands.selectInfusion('runtime-1');BattleSession.commands.confirmInfusion();await settle();
 expect(R.foes[0].hp).toBe(7);expect(R.energy).toBe(98);expect(R.granted).toHaveLength(1);BattleSession.commands.flee();await settle();
});
it('指定第二敌人沿上下文攻击，终局或无活敌不生成残留攻击',async()=>{
 const game=makeGame([canonical('tt3-azure-sword')]);BattleSession.start(game,[{id:'a',name:'甲',hp:12,atk:0},{id:'b',name:'乙',hp:12,atk:0}],{isBoss:false});
 const {fireConsumeTriggers}=await import('../game/src/battle/core/battle.engine.js');fireConsumeTriggers(canonical('tt3-azure-sword'),R.foes[1]);await settle();
 expect(R.foes.map(f=>f.hp)).toEqual([12,7]);const n=R.granted.length;
 R.foes.forEach(f=>{f.dead=true;f.hp=0;});fireConsumeTriggers(canonical('tt3-azure-sword'),null);await settle();expect(R.granted).toHaveLength(n);
 BattleSession.commands.flee();await settle();fireConsumeTriggers(canonical('tt3-azure-sword'),null);await settle();expect(R.granted).toHaveLength(0);
});
it('支付攻击击杀末敌后只结束一次，无残留交互或重复攻击',async()=>{
 const game=makeGame([canonical('tt2-turtlearmor'),canonical('tt3-azure-sword')]);game.onBattleEnd=vi.fn();BattleSession.start(game,[{id:'a',name:'靶',hp:3,atk:0}],{isBoss:false});
 BattleSession.commands.playCard('runtime-0','self');await settle();BattleSession.commands.pickHandSelect('runtime-1');await settle();
 expect(game.onBattleEnd).toHaveBeenCalledTimes(1);expect(game.battleActive).toBe(false);expect(R.busy).toBe(false);expect(R.handSelecting).toBeNull();expect(R.granted).toHaveLength(0);
 expect(game.onBattleEnd.mock.calls[0][0].spentCards.map(o=>o.card.id)).toEqual(['starter-attack']);
});
it.each(['立即释放一次杀','立即释放1次“初始攻击”','立即施放一次’初始攻击‘'])('旧文本和canonical引号兼容：%s',async desc=>{
 const game=makeGame([C.SHA]);BattleSession.start(game,[{id:'foe',name:'靶',hp:12,atk:0}],{isBoss:false});
 const {fireConsumeTriggers}=await import('../game/src/battle/core/battle.engine.js');fireConsumeTriggers({id:'custom-trigger',name:'自定义消耗',desc:'消耗该牌时'+desc},R.foes[0]);await settle();
 expect(R.foes[0].hp).toBe(7);expect(R.hand).toContain('runtime-0');expect(R.granted).toHaveLength(1);BattleSession.commands.flee();await settle();
});
it('立即攻击操作不抢明确释放手中所有牌的语句',async()=>{
 const {auditSteps}=await import('../game/src/battle/effects/effect-steps.audit.js');
 const step=auditSteps({castStarterAttack:vi.fn()}).find(s=>s.id==='release.oneSha');
 expect(step.when({desc:'直接释放手牌中的所有初始攻击'})).toBeNull();
 expect(step.when({desc:'立即释放手中的杀'})).toBeNull();
 expect(step.when({desc:'消耗该牌时立即释放一次杀'})).toBeNull();
});
