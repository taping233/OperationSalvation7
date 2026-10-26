import { battleRules } from './helpers/environment-fixtures.js';
// Approved rule regression; pre-change observations are preserved in docs/evidence/2026-10-17-restoration-rule/.
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


it.each([['usePotion', false], ['usePotion', true], ['useItem', false], ['useItem', true]])('复原药水%s入口：本场有消耗牌=%s', async (command, nonempty) => {
  const potion = canonical('cmtn6bge52qt');
  expect(potion.desc).toContain('地图背包');
  expect(potion.desc).toContain('本场消耗牌');
  expect(potion.desc).not.toContain('在背包中才能使用');
  expect(potion.rules.bag.use).toContainEqual({ op:'restoreConsumed', amount:2 });
  const game = makeGame([canonical('tt3sp-silverthorn'), canonical('tt3sp-shadowbug'), potion]);
  game.usedPocket = [{ card:canonical('tt3sp-shadowbug'), count:3 }];
  const mapPocket = JSON.stringify(game.usedPocket);
  BattleSession.start(game, [{ id:'observe-foe', name:'观测靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  if (nonempty) {
    BattleSession.commands.beginInfusion('runtime-0');
    BattleSession.commands.selectInfusion('runtime-1');
    BattleSession.commands.confirmInfusion();
    await settle();
    expect(R.consumed).toEqual(['runtime-1']);
  } else expect(R.consumed).toEqual([]);
  const snapshot = BattleSession.getSnapshot();
  expect(snapshot.potionBar.find(p => p.uid === 'runtime-2').usable).toBe(nonempty);
  const handBefore = [...R.hand];
  BattleSession.commands[command]('runtime-2'); await settle();
  expect(game.ownedCards.some(o => o.uid === 'runtime-2')).toBe(!nonempty);
  expect(R.consumed).toEqual([]);
  expect(JSON.stringify(game.usedPocket)).toBe(mapPocket);
  if (nonempty) {
    expect(R.hand).toContain('runtime-0');
    expect(R.hand).toContain('runtime-1');
    expect(game.logs.some(log => log.includes('复原 2 张消耗牌'))).toBe(true);
  } else {
    expect(R.hand).toEqual(handBefore);
    expect(game.logs.some(log => log.includes('消耗牌堆是空的'))).toBe(true);
  }
});

it('战斗复原最多两张，仅取本场消耗堆，剩余牌和地图消耗区不变', async () => {
  const potion = canonical('cmtn6bge52qt');
  const game = makeGame([canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), potion]);
  game.usedPocket = [{ card:canonical('tt3sp-shadowbug'), count:5 }];
  BattleSession.start(game, [{ id:'limit-foe', name:'复原上限靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  // Construct a three-card consumed pile; the real session command performs restoration.
  R.set$hand([]); R.set$consumed(['runtime-0', 'runtime-1', 'runtime-2']);
  BattleSession.commands.usePotion('runtime-3'); await settle();
  expect(R.hand).toEqual(['runtime-2', 'runtime-1']);
  expect(R.consumed).toEqual(['runtime-0']);
  expect(game.usedPocket[0].count).toBe(5);
  expect(game.ownedCards.some(entry => entry.uid === 'runtime-3')).toBe(false);
});

it('复原药水入队后本场消耗堆被清空，执行前复检保留药水且不发卡', async () => {
  const { createBattleBag } = await import('../game/src/battle/bag/battle.bag.js');
  const game = makeGame([canonical('tt3sp-shadowbug'), canonical('cmtn6bge52qt')]);
  game.usedPocket = [{ card:canonical('tt3sp-shadowbug'), count:3 }];
  BattleSession.start(game, [{ id:'queued-foe', name:'延迟执行靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  R.set$hand([]); R.set$consumed(['runtime-0']);
  // Pause at the real bag executor's scheduling boundary, then change its live pile.
  let execute;
  const queueBattleAction = vi.fn(action => { execute = action;  return Promise.resolve(); });
  const bag = createBattleBag({ alive:() => R.foes, clearTargetSession:vi.fn(), queueBattleAction,
    throwIfActionCancelled:vi.fn(), interactionOf:() => null });
  expect(bag.itemUsability(game.ownedCards[1].card).usable).toBe(true);
  bag.useItem('runtime-1');
  expect(queueBattleAction).toHaveBeenCalledTimes(1);
  R.set$consumed([]);
  const ownedBefore = JSON.stringify(game.ownedCards);
  const mapBefore = JSON.stringify(game.usedPocket);
  await execute(new AbortController().signal);
  expect(JSON.stringify(game.ownedCards)).toBe(ownedBefore);
  expect(JSON.stringify(game.usedPocket)).toBe(mapBefore);
  expect(R.hand).toEqual([]);
  expect(R.consumed).toEqual([]);
  expect(game.logs.some(log => log.includes('本场消耗牌堆是空的') && log.includes('道具未消耗'))).toBe(true);
});


it.each(['legacy', 'current', 'custom'])('已播种旧药水卡库的文案回填与卡面展示：%s', variant => {
  const original = C.all().map(card => ({ ...card }));
  const current = C.TABLETOP11.find(card => card.id === 'cmtn6bge52qt').desc;
  const desc = variant === 'legacy' ? '在背包中才能使用，复原最多两张卡牌' : variant === 'custom' ? '玩家自定义药水说明' : current;
  try {
    C.saveAll(original.map(card => card.id === 'cmtn6bge52qt' ? { ...card, desc } : card));
    C.ensureTabletop();
    expect(canonical('cmtn6bge52qt').desc).toBe(variant === 'custom' ? desc : current);
    C.ensureBagUseRules();
    expect(canonical('cmtn6bge52qt').desc).toBe(variant === 'custom' ? desc : current);
  } finally { C.saveAll(original); }
});

it('旧药水快照卡面也显示现行双场景说明，自定义文字不替换', async () => {
  const { displayCardDescription } = await import('../game/src/cards/card-description-text.js');
  const legacy = '在背包中才能使用，复原最多两张卡牌';
  const rendered = displayCardDescription(legacy, 'cmtn6bge52qt');
  expect(rendered).toBe(displayCardDescription(C.TABLETOP11.find(card => card.id === 'cmtn6bge52qt').desc, 'cmtn6bge52qt'));
  expect(rendered).toContain('消耗牌堆');
  expect(displayCardDescription('玩家自定义药水说明', 'cmtn6bge52qt')).toBe('玩家自定义药水说明');
  expect(displayCardDescription(legacy, 'custom-id')).toBe(legacy);
});

it.each(['false', 'throw'])('药水旧文案保存%s时旧库保留并能重试', failure => {
  const original = C.all().map(card => ({ ...card }));
  const legacy = '在背包中才能使用，复原最多两张卡牌';
  let save, error;
  try {
    C.saveAll(original.map(card => card.id === 'cmtn6bge52qt' ? { ...card, desc: legacy } : card));
    const before = JSON.stringify(C.all());
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    save = vi.spyOn(C, 'saveAll').mockImplementation(() => {
      if (failure === 'throw') throw new Error('injected potion description-save rejection');
      return false;
    });
    expect(() => C.ensureBagUseRules()).not.toThrow();
    expect(save).toHaveBeenCalled();
    expect(JSON.stringify(C.all())).toBe(before);
    save.mockRestore(); C.ensureBagUseRules();
    expect(canonical('cmtn6bge52qt').desc).toBe(C.TABLETOP11.find(card => card.id === 'cmtn6bge52qt').desc);
  } finally { save?.mockRestore(); error?.mockRestore(); C.saveAll(original); }
});
