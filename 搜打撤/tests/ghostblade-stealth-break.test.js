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


import { BUILTIN_PREVIOUS_RULES } from '../game/src/cards/builtin-card-previous-rules.js';
const { previewAction } = await import('../game/src/battle/view/battle.preview.js');
afterEach(() => vi.restoreAllMocks());
function start(stealth = false, extra = {}) {
  const card = { ...canonical('tt7-ghostblade'), ...extra };
  const game = makeGame([card, card]);
  BattleSession.start(game, [{ id:'foe', name:'靶子', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  if (stealth) R.pstat.status.stealth = 1;
  return game;
}
const draws = game => game.logs.filter(line => line.includes('抽了 2 张牌'));
async function play(uid = 'runtime-0') { BattleSession.commands.playCard(uid, 0); await settle(); }
it('无潜行：仅攻+1，无条件文本与draw字段均不得抽牌', async () => {
  const game = start(); await play();
  expect(R.foes[0].hp).toBe(994); expect(R.hand).toHaveLength(1); expect(draws(game)).toHaveLength(0);
});
it('自己的潜行被本次攻击破除：仅此时+2并抽2，重复施放不再触发', async () => {
  const game = start(true); await play();
  expect(R.foes[0].hp).toBe(992); expect(R.pstat.status.stealth).toBe(0);
  expect(R.hand).toHaveLength(3); expect(draws(game)).toHaveLength(1);
  await play('runtime-1');
  expect(R.foes[0].hp).toBe(986); expect(R.hand).toHaveLength(2); expect(draws(game)).toHaveLength(1);
});
it.each(['immune', 'stealth', 'armor'])('敌方%s挡住真实伤害：不破自身潜行、不抽牌', async defense => {
  const game = start(true);
  if (defense === 'armor') R.foes[0].defense.armor = 100;
  else R.foes[0].status[defense] = 1;
  await play();
  expect(R.foes[0].hp).toBe(1000); expect(R.pstat.status.stealth).toBe(1); expect(draws(game)).toHaveLength(0);
});
it('多段边界：首个有效伤害破潜行，后段不再加2，整张只抽2', async () => {
  const rules = structuredClone(canonical('tt7-ghostblade').rules);
  rules.triggers.onPlay[0].hits = { count: 3 };
  // Explicit operation parameters exercise the real shared segment loop.
  const game = start(true, { rules }); await play();
  expect(R.foes[0].hp).toBe(980); expect(draws(game)).toHaveLength(1); expect(R.hand).toHaveLength(3);
});
it('相同ID的显式DSL版本以onPlay为准，不误接hosted破潜行奖励', async () => {
  const game = start(true, { rules: { version:1, battle:{target:{side:'enemy',area:false}}, triggers: { onPlay: [
    { op:'damage', amount:1, target:'chosenEnemy' }, { op:'draw', amount:2 },
  ] } } });
  await play();
  expect(R.foes[0].hp).toBe(994); expect(draws(game)).toHaveLength(1);
});
it('hosted鬼魅预览保守unknown，不把未建模条件伤害标exact', () => {
  const card = canonical('tt7-ghostblade');
  const result = previewAction({ snapshot:{ foes:[{ hp:1000, dead:false, status:{}, defense:{} }], player:{atk:5,spellPower:0}, pstat:{status:{stealth:1}} },
    action:{kind:'play-card',uid:'x',targetIndex:0}, cardContext:{card, legal:true, targetIndexes:[0],mode:'normal',hostedExecutionVerified:true} });
  expect(result.confidence).toBe('unknown'); expect(result.damage).toBeNull();
});
it.each([false, true])('BOSS模式潜行=%s：条件满足时才从牌库抽2', async stealth => {
  const ghost = canonical('tt7-ghostblade');
  const game = makeGame([ghost, ghost, ghost]);
  BattleSession.start(game, [{ id:'boss', name:'靶子', hp:1000, atk:1, behavior:'strike' }], { isBoss:true });
  game.ownedCards.forEach(o => BattleSession.commands.selectDeckCard(o.uid));
  BattleSession.commands.confirmDeck();
  // A controlled pile state isolates the actual draw command from randomized opening order.
  R.set$hand(['runtime-0']); R.set$drawPile(['runtime-1', 'runtime-2']);
  R.pstat.status.stealth = stealth ? 1 : 0;
  await play();
  expect(R.foes[0].hp).toBe(stealth ? 992 : 994);
  expect(R.hand).toHaveLength(stealth ? 2 : 0);
  expect(R.drawPile).toHaveLength(stealth ? 0 : 2);
  expect(game.logs.filter(line => line.includes('抽了 2 张牌'))).toHaveLength(stealth ? 1 : 0);
  expect(draws(game)).toHaveLength(stealth ? 1 : 0);
});
it('无自身潜行时，敌方潜行不被当成奖励条件', async () => {
  const game = start(); R.foes[0].status.stealth = 1; await play();
  expect(R.foes[0].hp).toBe(1000); expect(draws(game)).toHaveLength(0);
});
it('伤害全灭敌人后沿现有终局规则不发后续抽牌', async () => {
  const game = start(true); R.foes[0].hp = 8; await play();
  expect(draws(game)).toHaveLength(0);
});
it('其他卡伪造hosted标记被规则守卫拒绝，不施伤或发奖励', async () => {
  const game = start(true, { id:'fake-ghost', rules: structuredClone(BUILTIN_PREVIOUS_RULES['tt7-ghostblade']) }); await play();
  expect(R.foes[0].hp).toBe(1000); expect(R.pstat.status.stealth).toBe(1);
  expect(draws(game)).toHaveLength(0); expect(game.logs.join(' ')).toContain('规则');
});
it('心数目标同样在真实伤害后破潜行，只奖励第一次攻击', async () => {
  const game = start(true); Object.assign(R.foes[0], { heartsMode:true, hp:8, maxHp:8 });
  await play();
  expect(R.foes[0].hp).toBe(6); expect(R.pstat.status.stealth).toBe(0); expect(draws(game)).toHaveLength(1);
  await play('runtime-1');
  expect(R.foes[0].hp).toBe(5); expect(draws(game)).toHaveLength(1);
});
it.each(['hit', 'immune', 'armor'])('其他攻击的心数结算%s：只有真实伤害破自己的潜行', async outcome => {
  const game = start(true, { ...C.SHA, draw:0, rules:C.SHA.rules });
  Object.assign(R.foes[0], { heartsMode:true, hp:8, maxHp:8 });
  if (outcome === 'immune') R.foes[0].status.immune = 1;
  if (outcome === 'armor') R.foes[0].defense.armor = 100;
  await play();
  expect(R.foes[0].hp).toBe(outcome === 'hit' ? 7 : 8);
  expect(R.pstat.status.stealth).toBe(outcome === 'hit' ? 0 : 1);
  expect(draws(game)).toHaveLength(0);
});
