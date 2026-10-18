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


const poisonTotal = () => R.foes.reduce((sum, foe) => sum + (foe.status.poison || 0), 0);
const spell = { id:'probe-spell', name:'法术测试', type:'法术', cost:0, dmg:1, dmgType:'fixed', desc:'造成1点固定伤害。',
  rules:{version:1,battle:{target:{side:'enemy',area:false}},triggers:{onPlay:[{op:'damage',amount:1,target:'chosenEnemy'}]}} };
function startCards(cards) {
 const game = makeGame(cards);
 BattleSession.start(game, [{id:'a',name:'靶甲',hp:1000,atk:1},{id:'b',name:'靶乙',hp:1000,atk:1}], {isBoss:false});
 return game;
}
async function play(index, target = 0) { BattleSession.commands.playCard(`runtime-${index}`, target, true); await settle(); }
it('毒杖首次与第二把装配不施毒，武术不触发，连续法术每张仅施毒1次', async () => {
 const staff = canonical('tt2-venomstaff');
 const game = startCards([staff, staff, C.SHA, spell, spell]);
 expect(poisonTotal()).toBe(0);
 await play(0,'self'); expect(poisonTotal()).toBe(0); expect(R.poisonOnSpell).toBe(true);
 await play(0,'self'); expect(poisonTotal()).toBe(0); expect(R.equipped).toHaveLength(1);
 await play(1,'self'); expect(poisonTotal()).toBe(0);
 await play(2); expect(poisonTotal()).toBe(0);
 await play(3); expect(poisonTotal()).toBe(1);
 await play(4); expect(poisonTotal()).toBe(2);
 expect(game.logs.filter(line => line.includes('<b>毒杖</b>：'))).toHaveLength(2);
});
it('新战斗清除毒杖监听，重新装备前法术不施毒', async () => {
 startCards([canonical('tt2-venomstaff')]); await play(0,'self');
 startCards([spell]); expect(R.poisonOnSpell).toBe(false);
 await play(0); expect(poisonTotal()).toBe(0);
});
it('同ID显式onPlay以DSL为准，不被hosted被动门吞掉', async () => {
 const card = {...canonical('tt2-venomstaff'), rules:{version:1,battle:{hosted:['venom-staff'],target:{side:'enemy',area:false}},
  triggers:{onPlay:[{op:'curse',curse:'poison',stacks:2,target:'randomEnemy'}]}}};
 startCards([card]); await play(0); expect(poisonTotal()).toBe(2);
});
it('其他装备合法立即附毒仍执行，不全局屏蔽装备文本', async () => {
 const card = {id:'probe-equip',name:'即时施毒装备',type:'装备',cost:0,desc:'附加中毒。',dmg:0};
 startCards([card]); await play(0,'self'); expect(poisonTotal()).toBe(1);
});
it('双敌提示准确说明单体与全体落点及注能确认', () => {
 const game = startCards([spell]);
 const hint = game.logs.find(line => line.includes('以一敌多'));
 expect(hint).toContain('战场空地'); expect(hint).toContain('注能');
 expect(hint).not.toContain('伤害与群体卡都');
});
it('hosted执行采用定版被动，存档自定义立即施毒文案不绕过身份门', async () => {
 const staff = {...canonical('tt2-venomstaff'), desc:'附加99层中毒。'};
 startCards([staff, spell]); await play(0,'self'); expect(poisonTotal()).toBe(0);
 await play(1); expect(poisonTotal()).toBe(1);
});
