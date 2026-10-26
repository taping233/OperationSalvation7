import { overlayElements, chestMocks } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let Chests, game, UI, actions, drawn;
const cards = [1, 2].map(i => ({ id: `reward${i}`, name: `奖励${i}`, type: '法术', rarity: '古朴' }));
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  actions = {}; drawn = vi.fn(seen => seen.has(cards[0].id) ? cards[1] : cards[0]);
  UI = { el: { ...overlayElements() },
    showOverlay(title, html) { this.el.ovBody.innerHTML = html; this.el.overlay.hidden = false; }, hideOverlay() { this.el.overlay.hidden = true; },
    act: (name, fn) => actions[name] = fn, refresh() {}, log() {},
  };
  game = { seed: 7, discoveredPairs: new Set(), layerIdx: 0, trackPos: 1, state: 'idle', ownedCards: [], myClass: '',
    usedSlots: () => game.ownedCards.length, bagCap: () => 16, canReceiveCard: () => true,
    grantCard: vi.fn(card => { game.ownedCards.push({ card }); return true; }), gainCoins: vi.fn(), persistSave: vi.fn(() => true),
  };
  window.SDT = { game, UI, ...chestMocks(cards, () => vi, () => drawn),
  };
  await import('../game/src/run/chests.js'); Chests = window.SDT.Chests;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete window.SDT; });
async function open() { Chests.open(game, [{ kind: 'small' }], vi.fn(), { onCell: true }); }

describe('搜刮点回调与探索身份审计', () => {
  it('直接展示卡牌不自动领取，旧领取不能跨局修改页面', async () => {
    Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true });
    const oldTake = actions.chestTake1, before = UI.el.ovBody.innerHTML;
    expect(UI.el.ovBody.querySelector('[data-eps-search]')).toBeNull();
    expect(game.grantCard).not.toHaveBeenCalled();
    game.discoveredPairs = new Set(); oldTake({ i:'0' }); vi.advanceTimersByTime(5000);
    expect(UI.el.ovBody.innerHTML).toBe(before);
    expect(game.grantCard).not.toHaveBeenCalled();
  });

  it('领取搜刮点双击只启动一次并收币一次，未选前不发卡', async () => {
    Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true });
    const draws = drawn.mock.calls.length;
    Chests.suspend(); Chests.resume(); Chests.resume();
    expect(Chests.serialize(game).current.rewardStage).toBe('cards');
    expect(drawn).toHaveBeenCalledTimes(draws);
    expect(game.gainCoins).toHaveBeenCalledTimes(1);
    expect(game.grantCard).not.toHaveBeenCalled(); expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(2);
    await Promise.resolve();
    expect(Chests.serialize(game).current.rewardStage).toBe('cards');
  });

  it.each(['run-token', 'location', 'slot'])('奖励展示后%s变化，旧领取不能覆盖新局', async change => {
    await open(); const oldTake = actions.chestTake1;
    if (change === 'run-token') game.discoveredPairs = new Set();
    if (change === 'location') game.trackPos++;
    if (change === 'slot') window.SDT.Base.slot = 2;
    const before = UI.el.ovBody.innerHTML; oldTake({ i:'0' }); vi.advanceTimersByTime(1600);
    expect(UI.el.ovBody.innerHTML).toBe(before); expect(UI.el.ovBody.querySelector('.reward-v14')).not.toBeNull();
  });
  it.each(['run-token', 'location', 'slot', 'new-page'])('已揭晓奖励%s变化后旧领取不能发奖或写盘', async change => {
    await open(); await Promise.resolve(); const oldTake = actions.chestTake1;
    const beforeSaves = game.persistSave.mock.calls.length;
    if (change === 'run-token') game.discoveredPairs = new Set();
    if (change === 'location') game.trackPos++;
    if (change === 'slot') window.SDT.Base.slot = 2;
    if (change === 'new-page') UI.showOverlay('', '<div class="reward-head">新奖励页面</div>');
    oldTake({ i: '0' });
    expect(game.grantCard).not.toHaveBeenCalled(); expect(game.persistSave).toHaveBeenCalledTimes(beforeSaves);
  });
  it('背包合法挂起/恢复不重抽，旧页动作失效且现页逐张领取只发一次', async () => {
    await open(); await Promise.resolve(); const oldTake = actions.chestTake1; const draws = drawn.mock.calls.length;
    expect(Chests.suspend()).toBe(true); UI.showOverlay('背包', '<main>背包</main>'); Chests.resume();
    oldTake({ i: '0' }); expect(game.grantCard).not.toHaveBeenCalled();
    const current = actions.chestTake1; current({ i: '0' }); current({ i: '0' });
    expect(game.grantCard).toHaveBeenCalledTimes(1); expect(drawn).toHaveBeenCalledTimes(draws);
  });
  it('新局不再视旧箱为可恢复，resume不会把旧奖励盖回新页', async () => {
    await open(); await Promise.resolve(); Chests.suspend(); game.discoveredPairs = new Set();
    UI.showOverlay('', '<main id="new-run-page">新局</main>');
    expect(Chests.isOpen()).toBe(false); Chests.resume();
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局'); expect(Chests.serialize(game)).toBeNull();
  });
  it('领取后普通保存失败仍保留当前已领取事实，重试保存不重复发奖', async () => {
    game.persistSave.mockReturnValue(false); await open(); await Promise.resolve();
    await actions.chestTake1({ i: '0' }); expect(game.grantCard).toHaveBeenCalledTimes(1);
    const saved = Chests.serialize(game); expect(saved.current.taken).toEqual([0]);
    game.persistSave.mockReturnValue(true); Chests.restore(game, saved, vi.fn()); await actions.chestTake1({ i: '0' });
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
  expect(root.querySelector('.reward-count')).toBeNull();
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
  await actions.chestTake1({ i:'0' }); await actions.chestTake1({ i:'0' });
  expect(game.grantCard).toHaveBeenCalledTimes(1);
  expect(drawn).not.toHaveBeenCalled();
  expect(Chests.serialize(game).current).toMatchObject({ taken:[0], lost:[], source:'污染空投箱', title:'领取奖励' });
  expect(root.querySelector('[data-act="chestContinue"]')).not.toBeNull();
  expect(root.querySelectorAll('.reward-unit-state.is-received')).toHaveLength(1); expect(root.querySelector('.reward-final')).toBeNull();
});
it('固定事件满包和放弃确认仍由原动作控制，不因展示层改变奖励状态', async () => {
  game.canReceiveCard = () => false;
  restoreFixedReceipt();
  expect(UI.el.ovBody.querySelector('[data-act="chestMakeRoom"]').dataset.i).toBe('0');
  expect(UI.el.ovBody.querySelector('[data-act="chestOpenBag"]').classList.contains('is-primary')).toBe(true);
  await actions.chestSkip();
  expect(Chests.serialize(game).current.lost).toEqual([]);
  expect(UI.el.ovBody.querySelector('[data-act="chestLeave"]')).not.toBeNull();
  await actions.chestStay();
  expect(Chests.serialize(game).current.lost).toEqual([]);
  await actions.chestSkip(); await actions.chestLeave();
  expect(Chests.serialize(game).current).toMatchObject({ taken:[], lost:[0] });
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(drawn).not.toHaveBeenCalled();
});

it('关闭动画期间旧领奖和放弃动作不能改变奖励或重开页面', async () => {
  restoreFixedReceipt();
  const before = UI.el.ovBody.innerHTML, saves = game.persistSave.mock.calls.length;
  UI.el.overlay.classList.add('closing');
  await actions.chestTake1({ i:'0' }); await actions.chestSkip(); await actions.chestSelect({ i:'0' });
  expect(game.grantCard).not.toHaveBeenCalled();
  expect(game.persistSave).toHaveBeenCalledTimes(saves);
  expect(UI.el.ovBody.innerHTML).toBe(before);
});
it('放弃后取消再重选保留横向卡列位置，且不重抽不发奖', async () => {
  restoreFixedReceipt();
  const scroller = UI.el.ovBody.querySelector('.loot-scroll');
  scroller.scrollLeft = 240; scroller.scrollTop = 37;
  await actions.chestSkip();
  expect(document.activeElement.dataset.act).toBe('chestStay');
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollLeft).toBe(240);
  await actions.chestStay(); await actions.chestSelect({ i:'0' });
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollLeft).toBe(240);
  expect(UI.el.ovBody.querySelector('.loot-scroll').scrollTop).toBe(37);
  expect(Chests.serialize(game).current).toMatchObject({ taken:[], lost:[] });
  expect(game.grantCard).not.toHaveBeenCalled(); expect(drawn).not.toHaveBeenCalled();
});

it.each(['overview', 'cards'])('等待返回地图时 %s 被新页面替换，迟到成功不能关新页', async screen => {
  let resolveCommit;
  const beforeMapReturn = vi.fn(() => new Promise(resolve => { resolveCommit = resolve; }));
  Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true, beforeMapReturn });
  if (screen === 'cards') { Chests.suspend(); Chests.resume(); }
  const pending = actions.chestReturn();
  UI.showOverlay('背包', '<main id="replacement">新页面</main>');
  const saves = game.persistSave.mock.calls.length;
  resolveCommit(true);
  expect(await pending).toBe(false);
  expect(UI.el.overlay.hidden).toBe(false);
  expect(game.state).toBe('modal');
  expect(document.getElementById('replacement').textContent).toBe('新页面');
  expect(game.persistSave).toHaveBeenCalledTimes(saves);
});

it('正常结算重绘后仍返回地图，重复点击只提交一次，失败后可以重试', async () => {
  let resolveCommit;
  const beforeMapReturn = vi.fn(() => new Promise(resolve => { resolveCommit = resolve; }));
  Chests.open(game, [{ kind:'small' }], vi.fn(), { onCell:true, beforeMapReturn });
  const first = actions.chestReturn();
  expect(await actions.chestReturn()).toBe(false);
  resolveCommit(false); expect(await first).toBe(false);
  expect(UI.el.overlay.hidden).toBe(false);
  const retry = actions.chestReturn();
  // Real settlement restores the reward view before resolving its successful commit.
  beforeMapReturn.mock.calls.at(-1)[1].resume(); resolveCommit(true);
  expect(await retry).toBe(true);
  expect(beforeMapReturn).toHaveBeenCalledTimes(2);
  expect(UI.el.overlay.hidden).toBe(true);
  expect(game.state).toBe('idle');
});

it.each([
  ['overview', 'reward', false], ['cards', 'reward', false],
  ['overview', 'map', false], ['cards', 'map', false],
  ['overview', 'map', true], ['cards', 'reward', true],
])('%s 返回时%s保存失败（throw=%s）保留原奖励，重试不重抽或重领', async (screen, phase, throws) => {
  await open(); await Promise.resolve(); await actions.chestTake1({ i:'0' });
  if (screen === 'overview') await actions.chestClosePicker();
  const before = Chests.serialize(game), draws = drawn.mock.calls.length;
  game.persistSave.mockReset().mockReturnValue(true);
  if (phase === 'map') game.persistSave.mockReturnValueOnce(true);
  game.persistSave.mockImplementationOnce(() => {
    if (throws) throw new Error('isolated return save failure');
    return false;
  });
  expect(await actions.chestReturn()).toBe(false);
  expect(UI.el.overlay.hidden).toBe(false);
  expect(game.state).toBe('modal');
  expect(Chests.serialize(game).current).toMatchObject({ cards:before.current.cards, taken:[0], lost:[] });
  expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
  expect(UI.el.ovBody.querySelector('[data-act="chestReturn"]')).not.toBeNull();
  expect(game.grantCard).toHaveBeenCalledOnce();
  expect(await actions.chestReturn()).toBe(true);
  expect(UI.el.overlay.hidden).toBe(true);
  expect(game.state).toBe('idle');
  expect(drawn).toHaveBeenCalledTimes(draws);
  expect(Chests.restore(game, game.nodeChestRewards['0,1'], vi.fn())).toBe(true);
  actions.chestOpen?.({ i:'0' }); await actions.chestTake1({ i:'0' });
  expect(game.grantCard).toHaveBeenCalledOnce();
});
