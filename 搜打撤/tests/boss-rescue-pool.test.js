import { battleRules } from './helpers/environment-fixtures.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { makeRuntimeBattleGame as makeGame } from './helpers/battle-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 0) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };

async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }


const { Random, SeededRandomService, setRandomService } = await import('../game/src/core/random.js');
let randomSnapshot;
beforeEach(() => { randomSnapshot = Random.snapshot(); });
afterEach(() => { vi.restoreAllMocks(); const restored = new SeededRandomService(); restored.restore(randomSnapshot); setRandomService(restored); });
const plain = { id:'rescue-valid', name:'可用法术', type:'法术', rarity:'古朴', cost:0, dmg:1, dmgType:'spell', desc:'造成1点法术伤害。' };
async function rescue(pool, boss = true) {
  const game = makeGame([canonical('cmtn1wnhhym')]);
  BattleSession.start(game, [{ id:'foe', name:'靶子', hp:1000, atk:1, behavior:'strike' }], { isBoss:boss });
  if (boss) { BattleSession.commands.selectDeckCard('runtime-0'); BattleSession.commands.confirmDeck(); }
  vi.spyOn(C, 'all').mockReturnValue(pool); const fixed = new SeededRandomService(0); fixed.random = () => 0; setRandomService(fixed);
  BattleSession.commands.playCard('runtime-0', 'any'); await settle();
  return game;
}
it('首脑生成池排除道具，合法候选仍生成3张且能实际打出', async () => {
  const drink = canonical('tt4-woodify');
  const game = await rescue([drink, plain]);
  expect(R.granted.map(o => o.card.id)).toEqual([plain.id, plain.id, plain.id]);
  const uid = R.hand[0]; BattleSession.commands.playCard(uid, 0); await settle();
  expect(R.hand).not.toContain(uid); expect(R.foes[0].hp).toBe(999);
  expect(game.logs.join(' ')).not.toContain('道具卡只能');
});
it('首脑池没有合法候选时不生成禁用道具，明确提示且结束动作', async () => {
  const game = await rescue([canonical('tt4-woodify')]);
  expect(R.granted).toHaveLength(0); expect(R.hand).toHaveLength(0);
  expect(game.logs.join(' ')).toContain('当前没有符合本场战斗规则的随机卡牌');
  expect(R.busy).toBe(false);
});
it('普通战仍可生成道具，不改变全局随机掉落资格', async () => {
  const drink = canonical('tt4-woodify'); expect(C.isRandomObtainable(drink)).toBe(true);
  await rescue([drink], false);
  expect(R.granted.filter(o => o.card.id === drink.id).map(o => o.card.id)).toEqual([drink.id, drink.id, drink.id]);
  expect(R.granted.filter(o => o.uid.startsWith('normal-sha-'))).toHaveLength(5);
  expect(C.isRandomObtainable(drink)).toBe(true);
});
it('生成池保留原有unrandom/稀有度资格，不纳入禁止随机的候选', async () => {
  await rescue([{ ...plain, id:'excluded', unrandom:true }, plain]);
  expect(R.granted.map(o => o.card.id)).toEqual([plain.id, plain.id, plain.id]);
});
it('阿猫本体仍触发附赠，只有救急本体安排下回合消耗', async () => {
  const cat = canonical('tt2-apollo'); const game = await rescue([cat, plain]);
  expect(R.hand).toHaveLength(6); expect(game.logs.join(' ')).toContain('阿猫的礼物');
  const pending = R.delayed.filter(job => job.special === 'consumeTemps');
  expect(pending).toHaveLength(1); expect(pending[0].uids).toHaveLength(3);
});
