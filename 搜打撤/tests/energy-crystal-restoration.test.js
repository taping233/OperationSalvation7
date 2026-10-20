// Approved rule regression; pre-change observations are preserved in docs/evidence/2026-10-17-energy-crystal/.
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


it.each([['usePotion', false], ['usePotion', true], ['useItem', false], ['useItem', true]])('能源结晶%s入口：本场有消耗牌=%s', async (command, nonempty) => {
  const potion = canonical('tt-crystal');
  expect(potion.desc).toContain('地图背包');
  expect(potion.desc).toContain('本场消耗牌');
  expect(potion.desc).not.toContain('在背包中才能使用');
  expect(potion.rules.bag.use).toContainEqual({ op:'restoreConsumed', amount:3 });
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

it('战斗复原最多三张，仅取本场消耗堆，剩余牌和地图消耗区不变', async () => {
  const potion = canonical('tt-crystal');
  const game = makeGame([canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), canonical('tt3sp-shadowbug'), potion]);
  game.usedPocket = [{ card:canonical('tt3sp-shadowbug'), count:5 }];
  BattleSession.start(game, [{ id:'limit-foe', name:'复原上限靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  // Construct a four-card consumed pile; the real session command performs restoration.
  R.set$hand([]); R.set$consumed(['runtime-0', 'runtime-1', 'runtime-2', 'runtime-3']);
  BattleSession.commands.usePotion('runtime-4'); await settle();
  expect(R.hand).toEqual(['runtime-3', 'runtime-2', 'runtime-1']);
  expect(R.consumed).toEqual(['runtime-0']);
  expect(game.usedPocket[0].count).toBe(5);
  expect(game.ownedCards.some(entry => entry.uid === 'runtime-4')).toBe(false);
});

it('能源结晶入队后本场消耗堆被清空，执行前复检保留药水且不发卡', async () => {
  const { createBattleBag } = await import('../game/src/battle/bag/battle.bag.js');
  const game = makeGame([canonical('tt3sp-shadowbug'), canonical('tt-crystal')]);
  game.usedPocket = [{ card:canonical('tt3sp-shadowbug'), count:3 }];
  BattleSession.start(game, [{ id:'queued-foe', name:'延迟执行靶', hp:1000, atk:1, behavior:'strike' }], { isBoss:false });
  R.set$hand([]); R.set$consumed(['runtime-0']);
  // Pause at the real bag executor's scheduling boundary, then change its live pile.
  let execute;
  const queueBattleAction = vi.fn(action => { execute = action; });
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


it.each(['在背包中才能使用，可以复原最多 3 张卡牌。', '复活最多 3 张卡牌。', 'current', '玩家自己的能源结晶说明'])('能源结晶文案回填只替换已知旧句：%s', value => {
  const original = C.all().map(card => ({ ...card }));
  const current = C.TABLETOP.find(card => card.id === 'tt-crystal').desc;
  const desc = value === 'current' ? current : value;
  try {
    C.saveAll(original.map(card => card.id === 'tt-crystal' ? { ...card, desc } : card));
    C.ensureBagUseRules();
    expect(canonical('tt-crystal').desc).toBe(value === '玩家自己的能源结晶说明' ? value : current);
    C.ensureBagUseRules();
    expect(canonical('tt-crystal').desc).toBe(value === '玩家自己的能源结晶说明' ? value : current);
  } finally { C.saveAll(original); }
});


it.each(['false', 'throw'])('能源结晶文案保存%s时不中断、不覆盖旧库，随后可重试', failure => {
  const original = C.all().map(card => ({ ...card }));
  const legacy = '在背包中才能使用，可以复原最多 3 张卡牌。';
  const current = C.TABLETOP.find(card => card.id === 'tt-crystal').desc;
  let save, error;
  try {
    C.saveAll(original.map(card => card.id === 'tt-crystal' ? { ...card, desc: legacy } : card));
    const before = JSON.stringify(C.all());
    // Explicit save fault injection; the text migration must not mutate the source snapshot.
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
    save = vi.spyOn(C, 'saveAll').mockImplementation(() => {
      if (failure === 'throw') throw new Error('injected description-save rejection');
      return false;
    });
    expect(() => C.ensureBagUseRules()).not.toThrow();
    expect(save).toHaveBeenCalled();
    expect(JSON.stringify(C.all())).toBe(before);
    expect(canonical('tt-crystal').desc).toBe(legacy);
    save.mockRestore();
    C.ensureBagUseRules();
    expect(canonical('tt-crystal').desc).toBe(current);
  } finally { save?.mockRestore(); error?.mockRestore(); C.saveAll(original); }
});
