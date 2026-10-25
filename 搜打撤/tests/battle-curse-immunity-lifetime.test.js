import { battleRules } from './helpers/environment-fixtures.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { makeRuntimeBattleGame as makeGame } from './helpers/battle-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { R.bindBattleRenderer(() => {}); vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };

async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }


function begin(cards, hp = [100]) {
  const game = makeGame(cards);
  BattleSession.start(game, hp.map((value, i) => ({ id: `foe-${i}`, name: `靶${i}`, hp: value, atk: 0 })), { isBoss: false });
  R.takeBattleCardAnims();
  return game;
}
const {queueCardExecution, addPlayerCurse} = await import('../game/src/battle/core/battle.engine.js');
async function cast(index, fuels = []) {
  const entry = R.G.ownedCards[index];
  expect(queueCardExecution(entry.uid, entry.card, fuels.map(i => `runtime-${i}`), null, false)).not.toBe(false);
  await settle();
}
async function nextTurn() {
  const previous = R.turn;
  BattleSession.commands.endTurn(); await settle();
  expect(R.turn).toBe(previous + 1);
}
function pending() { return R.delayed.filter(q => q.special === 'curseImmuneOff'); }
function setupCards() {
  const guard = canonical('tt12-felguard');
  const fuel = canonical('tt7-elementstorm');
  return [guard, guard, fuel, fuel, fuel, fuel, canonical('tt8-abyss-sovereign')];
}
it('单次邪能护体到下回合过期，诅咒重新有效', async () => {
  begin(setupCards()); await cast(0,[2,3]);
  expect(R.playerCurseImmune).toBe(true); expect(pending()).toHaveLength(1);
  await nextTurn(); expect(R.playerCurseImmune).toBe(false); expect(pending()).toHaveLength(0);
  addPlayerCurse('poison',1); expect(R.pstat.status.poison).toBe(1);
});
it('同回合重复邪能护体保留最早恢复值，不永久免疫', async () => {
  begin(setupCards()); await cast(0,[2,3]); await cast(1,[4,5]);
  expect.soft(pending().map(q=>q.restore)).toEqual([false]);
  await nextTurn(); expect.soft(R.playerCurseImmune).toBe(false);
  addPlayerCurse('poison',1); expect(R.pstat.status.poison).toBe(1);
});
it('连续回合使用邪能护体，各自独立到期', async () => {
  begin(setupCards()); await cast(0,[2,3]); await nextTurn();
  expect(R.playerCurseImmune).toBe(false);
  await cast(1,[4,5]); expect(R.playerCurseImmune).toBe(true);
  await nextTurn(); expect(R.playerCurseImmune).toBe(false); expect(pending()).toHaveLength(0);
});
it.each(['before','during'])('真实深渊主宰在临时免疫%s施放，永久免疫不会被到期清除', async order => {
  begin(setupCards());
  if (order === 'before') await cast(6);
  await cast(0,[2,3]);
  if (order === 'during') await cast(6);
  expect(R.playerCurseImmune).toBe(true);
  await nextTurn(); expect.soft(R.playerCurseImmune).toBe(true); expect(pending()).toHaveLength(0);
  addPlayerCurse('poison',1); expect(R.pstat.status.poison).toBe(0);
});
it('旧存档中重复临时恢复任务按最早基值到期', async () => {
  begin(setupCards()); await cast(0,[2,3]);
  // 旧实现两次施放后的序列化队列，走正式存档还原入口。
  const saved = JSON.parse(JSON.stringify({ delayed: [
    {special:'curseImmuneOff',restore:false}, {special:'curseImmuneOff',restore:true},
  ] }));
  R.restorePilesBookkeeping(saved);
  await nextTurn(); expect(R.playerCurseImmune).toBe(false); expect(pending()).toHaveLength(0);
});
