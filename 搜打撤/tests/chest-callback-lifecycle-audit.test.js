import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let Chests, game, UI, actions, drawn;
const cards = [1, 2].map(i => ({ id: `reward${i}`, name: `奖励${i}`, type: '法术', rarity: '古朴' }));
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  actions = {}; drawn = vi.fn(seen => seen.has(cards[0].id) ? cards[1] : cards[0]);
  UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') },
    showOverlay(title, html) { this.el.ovBody.innerHTML = html; this.el.overlay.hidden = false; }, hideOverlay() { this.el.overlay.hidden = true; },
    act: (name, fn) => actions[name] = fn, refresh() {}, log() {},
  };
  game = { seed: 7, discoveredPairs: new Set(), layerIdx: 0, trackPos: 1, state: 'idle', ownedCards: [], myClass: '',
    usedSlots: () => game.ownedCards.length, bagCap: () => 16, canReceiveCard: () => true,
    grantCard: vi.fn(card => { game.ownedCards.push({ card }); return true; }), gainCoins: vi.fn(), persistSave: vi.fn(() => true),
  };
  window.SDT = { game, UI, Icons: { rich: html => html }, Sound: { sfx: vi.fn() },
    MAP: { chestKinds: { small: { name: '小箱', cards: 2, coins: [2, 2] } } },
    Cards: { RARITIES: ['古朴', '稀有', '史诗', '传说'], all: () => cards, randomDropCard: drawn, pickOfRarity: () => cards[0],
      classPool: () => [], rarityOf: card => card.rarity, sellPrice: () => 1, cardHTML: card => `<span>${card.name}</span>` },
    Base: { slot: 1, data: {}, save() {}, petEggDropChance: () => 0, recordPetEggChestResult() {}, bagCap: () => 16, isSha: () => false },
  };
  await import('../game/src/run/chests.js'); Chests = window.SDT.Chests;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete window.SDT; });
function open() { Chests.open(game, [{ kind: 'small' }], vi.fn(), { onCell: true }); actions.chestNext(); }

describe('宝箱回调与探索身份审计', () => {
  it('未领取宝箱不自动开箱，旧领取动作不能跨局发起开箱', () => {
    Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true });
    const oldClaim = actions.chestNext;
    vi.advanceTimersByTime(5000);
    expect(UI.el.ovBody.querySelector('.cqo-overview')).not.toBeNull();
    expect(UI.el.ovBody.querySelector('[data-act="chestSelect"]')).toBeNull();
    game.discoveredPairs = new Set(); oldClaim();
    expect(UI.el.ovBody.querySelector('[data-eps-search]')).toBeNull();
    expect(game.grantCard).not.toHaveBeenCalled();
  });

  it('领取宝箱双击只启动一次并收币一次，未选前不发卡', () => {
    Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true });
    const claim = actions.chestNext, draws = drawn.mock.calls.length;
    claim(); claim();
    expect(Chests.serialize(game).current.rewardStage).toBe('opening');
    expect(drawn).toHaveBeenCalledTimes(draws);
    expect(window.SDT.Sound.sfx.mock.calls.filter(([name]) => name === 'chestShake')).toHaveLength(1);
    expect(game.grantCard).not.toHaveBeenCalled(); expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(2);
    actions.chestReveal();
    expect(Chests.serialize(game).current.rewardStage).toBe('cards');
  });

  it.each(['run-token', 'location', 'slot'])('搜索等待期间%s变化后旧揭晓不能覆盖新局', change => {
    open(); const oldReveal = actions.chestReveal;
    if (change === 'run-token') game.discoveredPairs = new Set();
    if (change === 'location') game.trackPos++;
    if (change === 'slot') window.SDT.Base.slot = 2;
    const before = UI.el.ovBody.innerHTML; oldReveal(); vi.advanceTimersByTime(1600);
    expect(UI.el.ovBody.innerHTML).toBe(before); expect(UI.el.ovBody.querySelector('.reward-head')).toBeNull();
  });
  it.each(['run-token', 'location', 'slot', 'new-page'])('已揭晓奖励%s变化后旧领取不能发奖或写盘', change => {
    open(); actions.chestReveal(); const oldTake = actions.chestTake1;
    const beforeSaves = game.persistSave.mock.calls.length;
    if (change === 'run-token') game.discoveredPairs = new Set();
    if (change === 'location') game.trackPos++;
    if (change === 'slot') window.SDT.Base.slot = 2;
    if (change === 'new-page') UI.showOverlay('', '<div class="reward-head">新奖励页面</div>');
    oldTake({ i: '0' });
    expect(game.grantCard).not.toHaveBeenCalled(); expect(game.persistSave).toHaveBeenCalledTimes(beforeSaves);
  });
  it('背包合法挂起/恢复不重抽，旧页动作失效且现页逐张领取只发一次', () => {
    open(); actions.chestReveal(); const oldTake = actions.chestTake1; const draws = drawn.mock.calls.length;
    expect(Chests.suspend()).toBe(true); UI.showOverlay('背包', '<main>背包</main>'); Chests.resume();
    oldTake({ i: '0' }); expect(game.grantCard).not.toHaveBeenCalled();
    const current = actions.chestTake1; current({ i: '0' }); current({ i: '0' });
    expect(game.grantCard).toHaveBeenCalledTimes(1); expect(drawn).toHaveBeenCalledTimes(draws);
  });
  it('新局不再视旧箱为可恢复，resume不会把旧奖励盖回新页', () => {
    open(); actions.chestReveal(); Chests.suspend(); game.discoveredPairs = new Set();
    UI.showOverlay('', '<main id="new-run-page">新局</main>');
    expect(Chests.isOpen()).toBe(false); Chests.resume();
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局'); expect(Chests.serialize(game)).toBeNull();
  });
  it('领取后普通保存失败仍保留当前已领取事实，重试保存不重复发奖', () => {
    game.persistSave.mockReturnValue(false); open(); actions.chestReveal();
    actions.chestTake1({ i: '0' }); expect(game.grantCard).toHaveBeenCalledTimes(1);
    const saved = Chests.serialize(game); expect(saved.current.taken).toEqual([0]);
    game.persistSave.mockReturnValue(true); Chests.restore(game, saved, vi.fn()); actions.chestTake1({ i: '0' });
    expect(game.grantCard).toHaveBeenCalledTimes(1);
  });
});

function restoreFixedReceipt() {
  const saved = { version:1, seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos,
    queue:[{ kind:'small' }], index:1, context:{ onCell:true, consumeNode:false },
    current:{ kind:'small', cards:[cards[0]], coins:0, coinsReceived:false,
      taken:[], lost:[], source:'污染空投箱', title:'领取奖励' } };
  expect(Chests.restore(game, saved, vi.fn())).toBe(true);
}
it('固定事件使用独立领取样式，保留来源和既有动作；返回再领不重抽不重领', async () => {
  restoreFixedReceipt();
  const root = UI.el.ovBody;
  expect(root.querySelector('.reward-standalone-picker')).not.toBeNull();
  expect(root.querySelector('.reward-source').textContent).toBe('污染空投箱');
  expect(root.querySelector('.reward-head h3').textContent).toBe('领取奖励');
  expect(root.querySelector('.reward-count').textContent).toBe('共 1 张');
  expect(root.querySelector('.cqo-overview,.cqp-dialog,[data-act="chestClosePicker"]')).toBeNull();
  for (const action of ['chestSelect','chestTake1','chestOpenBag','chestReturn','chestSkip']) {
    expect(root.querySelector(`[data-act="${action}"]`)).not.toBeNull();
  }
  expect(root.querySelector('[data-act="chestSkip"]').dataset.cancel).toBe('false');
  const oldTake = actions.chestTake1;
  await actions.chestReturn();
  oldTake({ i:'0' });
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(Chests.restore(game, game.nodeChestRewards['0,1'], vi.fn())).toBe(true);
  actions.chestTake1({ i:'0' }); actions.chestTake1({ i:'0' });
  expect(game.grantCard).toHaveBeenCalledTimes(1);
  expect(drawn).not.toHaveBeenCalled();
  expect(Chests.serialize(game).current).toMatchObject({ taken:[0], lost:[], source:'污染空投箱', title:'领取奖励' });
  expect(root.querySelector('[data-act="chestContinue"]')).not.toBeNull();
  expect(root.querySelector('.reward-final').textContent).toBe('1 张已入背包');
});
it('固定事件满包和放弃确认仍由原动作控制，不因展示层改变奖励状态', () => {
  game.canReceiveCard = () => false;
  restoreFixedReceipt();
  expect(UI.el.ovBody.querySelector('[data-act="chestMakeRoom"]').dataset.i).toBe('0');
  expect(UI.el.ovBody.querySelector('[data-act="chestOpenBag"]').classList.contains('is-primary')).toBe(true);
  actions.chestSkip();
  expect(Chests.serialize(game).current.lost).toEqual([]);
  expect(UI.el.ovBody.querySelector('[data-act="chestLeave"]')).not.toBeNull();
  actions.chestStay();
  expect(Chests.serialize(game).current.lost).toEqual([]);
  actions.chestSkip(); actions.chestLeave();
  expect(Chests.serialize(game).current).toMatchObject({ taken:[], lost:[0] });
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(drawn).not.toHaveBeenCalled();
});

it('关闭动画期间旧领奖和放弃动作不能改变奖励或重开页面', () => {
  restoreFixedReceipt();
  const before = UI.el.ovBody.innerHTML, saves = game.persistSave.mock.calls.length;
  UI.el.overlay.classList.add('closing');
  actions.chestTake1({ i:'0' }); actions.chestSkip(); actions.chestSelect({ i:'0' });
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(game.persistSave).toHaveBeenCalledTimes(saves);
  expect(UI.el.ovBody.innerHTML).toBe(before);
});
it('放弃后取消再重选保留横向卡列位置，且不重抽不发奖', () => {
  restoreFixedReceipt();
  const scroller = UI.el.ovBody.querySelector('.loot-scroll');
  scroller.scrollLeft = 240; scroller.scrollTop = 37;
  actions.chestSkip();
  expect(document.activeElement.dataset.act).toBe('chestStay');
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollLeft).toBe(240);
  actions.chestStay(); actions.chestSelect({ i:'0' });
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollLeft).toBe(240);
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollTop).toBe(37);
  expect(Chests.serialize(game).current).toMatchObject({ taken:[], lost:[] });
  expect(game.grantCard).not.toHaveBeenCalled(); expect(drawn).not.toHaveBeenCalled();
});
