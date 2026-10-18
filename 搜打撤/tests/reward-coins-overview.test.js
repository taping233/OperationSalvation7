import { afterEach, expect, it, vi } from 'vitest';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';

afterEach(() => { vi.useRealTimers(); delete window.SDT; document.body.innerHTML = ''; });

async function setup() {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body = document.getElementById('ovBody'), overlay = document.getElementById('overlay'), actions = {};
  body.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) actions[button.dataset.act]?.(button.dataset);
  });
  const card = { id:'supply', name:'补给卡', type:'法术', rarity:'古朴', cost:0, desc:'' };
  const draw = vi.fn(() => card);
  window.SDT = {
    UI:{ el:{ overlay, ovBody:body, ovTitle:document.getElementById('ovTitle') },
      showOverlay(title, html) { body.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; }, act(name, fn) { actions[name] = fn; }, refresh:vi.fn(), log:vi.fn() },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱', cards:1, coins:[2,2] } } },
    Cards:{ RARITIES:['古朴','稀有','史诗','传说'], all:() => [card], randomDropCard:draw,
      pickOfRarity:() => card, classPool:() => [], rarityOf:c => c.rarity, sellPrice:() => 1, cardHTML:c => `<div>${c.name}</div>` },
    Base:{ data:{}, slot:1, save:vi.fn(), petEggDropChance:() => 0, recordPetEggChestResult:vi.fn(), bagCap:() => 10, isSha:() => false },
    Sound:{ sfx:vi.fn() }, Icons:{ rich:html => html },
  };
  const game = { seed:17, layerIdx:0, trackPos:1, state:'idle', ownedCards:[], myClass:'',
    usedSlots:() => 0, bagCap:() => 10, canReceiveCard:() => true,
    grantCard:vi.fn(() => true), gainCoins:vi.fn(), persistSave:vi.fn() };
  await import('../game/src/run/chests.js');
  const chests = window.SDT.Chests;
  const click = (act, index) => {
    const button = body.querySelector(`[data-act="${act}"]${index === undefined ? '' : `[data-i="${index}"]`}`);
    expect(button, act).not.toBeNull(); button.click();
  };
  const open = () => { click('chestNext'); click('chestReveal'); };
  const save = () => JSON.parse(JSON.stringify(chests.serialize(game)));
  return { body, game, chests, draw, click, open, save, actions };
}

it('金币可先独立领取，未开箱读档保持原卡牌且金币不重领', async () => {
  const { body, game, chests, draw, click, open, save, actions } = await setup();
  const done = vi.fn();
  chests.open(game, [{ kind:'small' }], done, { onCell:true });
  expect(body.querySelector('.cqo-coins')).not.toBeNull();
  expect(body.querySelector('.cqo-boxes [data-act="chestOverviewCoins"]')).toBeNull();
  const staleClaim = actions.chestOverviewCoins;
  game.canReceiveCard = () => false;
  click('chestOverviewCoins'); staleClaim();
  expect(game.gainCoins).toHaveBeenCalledExactlyOnceWith(2);
  expect(game.grantCard).not.toHaveBeenCalled();
  const saved = save();
  expect(saved.current).toMatchObject({ rewardStage:'chest', coinsReceived:true, taken:[] });
  expect(restoreChestReward(game, saved)).not.toBeNull();
  expect(chests.restore(game, saved, done)).toBe(true);
  expect(body.querySelector('[data-act="chestOverviewCoins"]')).toBeNull();
  game.canReceiveCard = () => true;
  open();
  expect(body.querySelector('.cqp-dialog .reward-coin-unit')).toBeNull();
  click('chestTake1'); click('chestFinish');
  expect(game.gainCoins).toHaveBeenCalledTimes(1);
  expect(draw).toHaveBeenCalledTimes(1);
  expect(done).toHaveBeenCalledTimes(1);
});


it.each(['chestNext', 'chestOpen'])('开箱入口%s只收当前箱金币，卡牌领取不追加收币', async action => {
  const h = await setup(), done = vi.fn();
  h.chests.open(h.game, [{ kind:'small' }, { kind:'small' }], done, { onCell:true });
  expect(h.draw).toHaveBeenCalledTimes(1);
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).toContain('开箱并收金币');
  expect(h.body.querySelector('[data-act="chestOpen"]').getAttribute('aria-label')).toContain('开箱并收金币');
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 2 · 已领 0');
  const staleOpen = h.actions[action];
  h.click(action, action === 'chestOpen' ? 0 : undefined); staleOpen({ i:0 });
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2]);
  expect(h.save().current.coinsReceived).toBe(true);
  expect(h.draw).toHaveBeenCalledTimes(1);
  h.click('chestReveal'); h.click('chestTake1');
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2]);
  expect(h.body.querySelector('.cqo-progress').textContent).toContain('1箱待领');
  const saved = h.save(); expect(h.chests.restore(h.game, saved, done)).toBe(true);
  h.open();
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2, 2]);
  expect(h.draw).toHaveBeenCalledTimes(2);
  h.click('chestTake1');
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 0 · 已领 4');
  h.click('chestFinish'); h.actions.chestFinish();
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2, 2]);
  expect(done).toHaveBeenCalledTimes(1);
});

it('先独立领首箱币，再开两箱只新增第二箱币，返回地图/重载不重发', async () => {
  const h = await setup(), done = vi.fn();
  h.chests.open(h.game, [{ kind:'small' }, { kind:'small' }], done, { onCell:true });
  const staleClaim = h.actions.chestOverviewCoins;
  h.click('chestOverviewCoins');
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).toContain('打开宝箱');
  h.open(); h.click('chestTake1');
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2]);
  expect(h.draw).toHaveBeenCalledTimes(1);
  h.open();
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2, 2]);
  expect(h.draw).toHaveBeenCalledTimes(2);
  await h.actions.chestReturn(); expect(h.game.state).toBe('idle');
  staleClaim();
  const saved = JSON.parse(JSON.stringify(h.game.nodeChestRewards['0,1']));
  expect(restoreChestReward(h.game, saved)).toBeTruthy();
  expect(h.chests.restore(h.game, saved, done)).toBe(true);
  h.click('chestNext'); h.click('chestTake1');
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 0 · 已领 4');
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([2, 2]);
  expect(h.draw).toHaveBeenCalledTimes(2);
});

function fixedSnapshot({ screen='cards', source, taken=[] } = {}) {
  const card = { id:'a', name:'原奖励', type:'法术', rarity:'古朴' };
  const current = { kind:'small', cards:[card,{ ...card, id:'b', name:'另一奖励' }], coins:3,
    coinsReceived:false, rewardStage:'cards', taken, lost:[], ...(source ? { source } : {}) };
  return { version:1, seed:17, layerIdx:0, trackPos:1, queue:[{ kind:'small', reward:current }],
    index:1, context:{ onCell:true }, current, screen };
}

it.each(['chestTake', 'chestLeave'])('直接恢复待领卡牌层后%s不收币，独立金币仍可完成且只收一次', async action => {
  const h = await setup(), done = vi.fn();
  expect(h.chests.restore(h.game, fixedSnapshot(), done)).toBe(true);
  if (action === 'chestLeave') h.click('chestSkip');
  const staleCard = h.actions[action];
  h.click(action); staleCard();
  expect(h.game.gainCoins).not.toHaveBeenCalled();
  expect(h.save().current.coinsReceived).toBe(false);
  expect(h.save().current[action === 'chestTake' ? 'taken' : 'lost']).toEqual([0, 1]);
  expect(h.body.querySelector('[data-act="chestFinish"]')).toBeNull();
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 3 · 已领 0');
  expect(h.chests.restore(h.game, h.save(), done)).toBe(true);
  const staleCoin = h.actions.chestOverviewCoins;
  h.click('chestOverviewCoins'); staleCoin();
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  expect(h.chests.restore(h.game, h.save(), done)).toBe(true);
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 0 · 已领 3');
  h.click('chestFinish'); expect(done).toHaveBeenCalledTimes(1);
});

it('旧已开卡牌从总览继续时收未领币，之后单领/重入不重发', async () => {
  const h = await setup();
  expect(h.chests.restore(h.game, fixedSnapshot({ screen:'overview' }), vi.fn())).toBe(true);
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).toContain('继续领取并收金币');
  expect(h.body.querySelector('[data-act="chestOpen"]').getAttribute('aria-label')).toContain('继续领取并收金币');
  h.click('chestNext');
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  h.click('chestTake1');
  h.click('chestClosePicker');
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).toContain('继续领取');
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).not.toContain('收金币');
  expect(h.body.querySelector('[data-act="chestOpen"]').getAttribute('aria-label')).not.toContain('收金币');
  h.click('chestOpen', 0);
  expect(h.chests.restore(h.game, h.save(), vi.fn())).toBe(true);
  h.click('chestTake1', 1);
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
});

it('多个已生成快照金币独立汇总，仅收未领箱且不重新抽卡', async () => {
  const h = await setup(), saved = fixedSnapshot({ screen:'overview' });
  saved.queue.push({kind:'small', reward:{...structuredClone(saved.current), coins:5, coinsReceived:true}});
  saved.queue.push({kind:'small', reward:{...structuredClone(saved.current), coins:7}});
  expect(h.chests.restore(h.game, saved, vi.fn())).toBe(true);
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 10 · 已领 5');
  const stale = h.actions.chestOverviewCoins;
  h.click('chestOverviewCoins'); stale();
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([3, 7]);
  expect(h.chests.restore(h.game, h.save(), vi.fn())).toBe(true);
  expect(h.body.querySelector('.cqo-coins').textContent).toContain('待领 0 · 已领 15');
  h.actions.chestOverviewCoins();
  expect(h.game.gainCoins.mock.calls.flat()).toEqual([3, 7]);
  expect(h.draw).not.toHaveBeenCalled();
});

it.each(['chestTake', 'chestLeave', 'chestContinue'])('固定奖励非总览入口保留原%s收币行为且不重复', async action => {
  const h = await setup(), done = vi.fn();
  expect(h.chests.restore(h.game, fixedSnapshot({ source:'事件固定奖励', taken:action === 'chestContinue' ? [0, 1] : [] }), done)).toBe(true);
  if (action === 'chestLeave') h.click('chestSkip');
  const stale = h.actions[action]; h.click(action); stale();
  expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  if (action !== 'chestContinue') {
    expect(h.chests.restore(h.game, h.save(), done)).toBe(true);
    h.click('chestContinue');
    expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(3);
  }
  expect(done).toHaveBeenCalledTimes(1);
});

it('未生成的无金币箱和已独立领币箱入口不声称收金币', async () => {
  const h = await setup();
  window.SDT.MAP.chestKinds.boss = { name:'首脑保险柜', cards:1, coins:null };
  h.chests.open(h.game, [{kind:'small'}, {kind:'boss'}], vi.fn(), {onCell:true});
  const bossButton = h.body.querySelector('[data-act="chestOpen"][data-i="1"]');
  expect(bossButton.getAttribute('aria-label')).toContain('打开宝箱');
  expect(bossButton.textContent).not.toContain('收金币');
  h.click('chestOverviewCoins');
  expect(h.body.querySelector('[data-act="chestOpen"][data-i="0"]').textContent).not.toContain('收金币');
  h.open(); h.click('chestTake1');
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).toContain('打开宝箱');
  expect(h.body.querySelector('[data-act="chestNext"]').textContent).not.toContain('收金币');
  expect(h.draw).toHaveBeenCalledTimes(1);
});
