// Production chest definitions/cards, reward controller, capacity rules and JSON restore.
// The UI, random draw pool and inventory write are isolated ports, not live-browser QA.
import { afterEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';
import cardData from '../game/data/cards-sync.json';
import { canReceiveCardFromBag, stackCapOf } from '../game/src/core/card-capacity.js';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';

const library = cardData.cards;
const ordinary = library.filter(card => card.rarity === '古朴' && ['武术', '法术', '装备', '道具', '资源'].includes(card.type) && !card.unrandom).slice(0, 3);
const egg = library.find(card => card.id === 'pet-egg');
const classCards = [0, 1, 2].map(i => ({ id:`class-${i}`, name:`职业候选${i}`, rarity:'职业', type:'武术' }));
const gift = { id:'gift-extra', name:'附赠候选', rarity:'古朴', type:'法术' };

afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  delete window.SDT; document.body.innerHTML = '';
});

async function setup({ kind='small', withEgg=true, pool=ordinary, isClass=false, capacity=16, withGift=false } = {}) {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const body = document.getElementById('ovBody'), overlay = document.getElementById('overlay'), acts = {};
  body.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) acts[button.dataset.act]?.(button.dataset);
  });
  const done = vi.fn();
  const game = { seed:17, layerIdx:0, trackPos:1, discoveredPairs:new Set(), myClass:'武术',
    state:'idle', ownedCards:[], inventory:[], coins:0, bagCap:() => capacity,
    usedSlots() {
      const groups = new Map();
      for (const { card } of this.ownedCards) groups.set(card.name, { card, count:(groups.get(card.name)?.count || 0) + 1 });
      return [...groups.values()].reduce((sum, group) => sum + Math.ceil(group.count / stackCapOf(group.card)), 0);
    },
    canReceiveCard(card) {
      return canReceiveCardFromBag(card, { ownedCards:this.ownedCards, canAcceptCard:() => this.usedSlots() < capacity });
    },
    grantCard:vi.fn((card, options) => {
      if (!game.canReceiveCard(card)) return false;
      game.ownedCards.push({ card:structuredClone(card) });
      if (withGift && card.id === pool[0]?.id) options.deferAcquiredCard(gift);
      return true;
    }),
    gainCoins:vi.fn(amount => { game.coins += amount; }), persistSave:vi.fn(),
  };
  const draw = vi.fn(seen => pool.find(card => !seen.has(card.id)));
  const pity = vi.fn();
  window.SDT = {
    UI:{ el:{ overlay, ovBody:body, ovTitle:document.getElementById('ovTitle') },
      showOverlay(title, html) { body.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; }, act(name, fn) { acts[name] = fn; }, refresh:vi.fn(), log:vi.fn() },
    MAP:structuredClone(mapData),
    Cards:{ RARITIES:['古朴', '稀有', '史诗', '传说'], all:() => library, randomDropCard:draw,
      pickOfRarity:vi.fn(tier => library.find(card => card.rarity === tier && card.type === '法术' && !card.unrandom)),
      classPool:() => pool, rarityOf:card => card.rarity, sellPrice:() => 1, cardHTML:card => `<div>${card.name}</div>` },
    Base:{ data:{}, slot:1, save:vi.fn(), petEggDropChance:() => withEgg ? 1 : 0,
      recordPetEggChestResult:pity, bagCap:() => capacity, isSha:() => false },
    Sound:{ sfx:vi.fn() }, Icons:{ rich:html => html },
  };
  let randomIndex = 0;
  const random = vi.fn(() => (randomIndex++ % 3) / 3);
  const { setRandomService } = await import('../game/src/core/random.js');
  setRandomService({ random, reseed:vi.fn(), snapshot:vi.fn(), restore:vi.fn() });
  await import('../game/src/run/chests.js');
  const Chests = window.SDT.Chests;
  const click = (action, index) => {
    const button = body.querySelector(`[data-act="${action}"]${index === undefined ? '' : `[data-i="${index}"]`}`);
    expect(button, `${action}:${index ?? ''}`).not.toBeNull(); button.click();
  };
  const saved = () => JSON.parse(JSON.stringify(Chests.serialize(game)));
  const reload = () => {
    const value = saved(), beforeRandom = random.mock.calls.length, beforeDraw = draw.mock.calls.length;
    expect(restoreChestReward(game, value)).toBeTruthy();
    game.ownedCards = JSON.parse(JSON.stringify(game.ownedCards));
    expect(Chests.restore(game, value, done)).toBe(true);
    expect(random).toHaveBeenCalledTimes(beforeRandom); expect(draw).toHaveBeenCalledTimes(beforeDraw);
    expect(pity).toHaveBeenCalledTimes(1);
  };
  const reveal = () => { click('chestNext'); click('chestReveal'); };
  Chests.open(game, [{ kind, isClass }], done, { onCell:true });
  return { game, Chests, body, acts, click, saved, reload, reveal, draw, random, pity, done };
}

describe('真实小/中宝箱的基础候选与附赠边界', () => {
  it.each(['medium'].flatMap(kind => [false, true].map(withEgg => ({ kind, withEgg }))))(
    '$kind 出蛋=$withEgg：仅基础三选一，开箱前/选择后重载保留边界且不重发', async ({ kind, withEgg }) => {
      const h = await setup({ kind, withEgg });
      expect(mapData.chestKinds[kind].pickFrom).toBe(3); expect(ordinary).toHaveLength(3);
      expect(h.saved().current).toMatchObject({ claimMode:'one', choiceCount:3 });
      expect(h.saved().current.cards).toHaveLength(withEgg ? 4 : 3);
      expect(h.pity).toHaveBeenCalledExactlyOnceWith({ eggGranted:withEgg });
      expect(h.random).toHaveBeenCalledTimes(2); // Same egg/coin draws as before the boundary fix.
      expect(h.saved().current.cards.slice(0, 3)).toEqual(ordinary);
      expect(window.SDT.Cards.pickOfRarity).not.toHaveBeenCalled();
      h.reload(); h.reveal(); h.reload();
      expect(h.body.querySelectorAll('[data-act="chestPick"]')).toHaveLength(3);
      expect(h.body.querySelectorAll('[data-act="chestTake1"]')).toHaveLength(withEgg ? 1 : 0);
      if (withEgg) expect(h.body.textContent).toContain('附赠');
      const oldPick = h.acts.chestPick;
      h.click('chestPick', 0); oldPick({ i:0 });
      expect(h.saved().current).toMatchObject({ taken:[0], lost:[1, 2], choiceCount:3 });
      h.reload();
      if (withEgg) { h.click('chestTake1', 3); h.reload(); h.acts.chestTake1({ i:3 }); }
      expect(h.game.ownedCards.map(owned => owned.card.id)).toEqual(withEgg ? [ordinary[0].id, egg.id] : [ordinary[0].id]);
      const coins = h.saved().current.coins;
      expect(h.body.querySelector('[data-act="chestOverviewCoins"]')).toBeNull(); h.reload(); h.acts.chestOverviewCoins();
      expect(h.game.gainCoins).toHaveBeenCalledExactlyOnceWith(coins); expect(h.game.coins).toBe(coins);
      h.click('chestFinish'); h.acts.chestFinish(); expect(h.done).toHaveBeenCalledTimes(1);
    });

  it.each(['medium'])('%s 满包选择失败不丢候选；选择后蛋满包保留，返回地图/重载/腾格后只领一次', async kind => {
    const h = await setup({ kind, capacity:1 });
    h.game.ownedCards.push({ card:{ id:'filler', name:'占位卡', type:'法术' } });
    h.reveal(); h.acts.chestPick({ i:0 });
    expect(h.saved().current).toMatchObject({ taken:[], lost:[] });
    h.reload(); h.game.ownedCards.pop(); h.Chests.resume(); h.click('chestPick', 0);
    h.acts.chestTake1({ i:3 });
    expect(h.saved().current).toMatchObject({ taken:[0], lost:[1, 2] });
    await h.acts.chestReturn(); expect(h.game.state).toBe('idle');
    const parked = JSON.parse(JSON.stringify(h.game.nodeChestRewards['0,1']));
    expect(restoreChestReward(h.game, parked)).toBeTruthy();
    expect(h.Chests.restore(h.game, parked, h.done)).toBe(true);
    h.click('chestNext');
    h.game.ownedCards.pop(); h.Chests.resume(); h.click('chestTake1', 3); h.reload(); h.acts.chestTake1({ i:3 });
    expect(h.game.ownedCards.map(owned => owned.card.id)).toEqual([egg.id]);
    expect(h.saved().current).toMatchObject({ taken:[0, 3], lost:[1, 2] });
    expect(h.pity).toHaveBeenCalledExactlyOnceWith({ eggGranted:true });
  });

  it.each(['medium'])('%s 可先领宠物蛋，再三选一；附赠领取不能消耗基础选择', async kind => {
    const h = await setup({ kind }); h.reveal(); h.click('chestTake1', 3); h.reload();
    expect(h.body.querySelectorAll('[data-act="chestPick"]')).toHaveLength(3);
    expect(h.saved().current).toMatchObject({ taken:[3], lost:[] });
    h.click('chestPick', 1);
    expect(h.saved().current).toMatchObject({ taken:[3, 1], lost:[0, 2] });
    expect(h.game.ownedCards).toHaveLength(2);
  });

  it.each(['medium'])('%s 宠物蛋与领卡后附赠均不进入永久放弃集合', async kind => {
    const h = await setup({ kind, withGift:true }); h.reveal(); h.click('chestPick', 0); h.reload();
    expect(h.saved().current).toMatchObject({ choiceCount:3, taken:[0], lost:[1, 2] });
    expect(h.saved().current.cards.slice(3).map(card => card.id)).toEqual([egg.id, gift.id]);
    h.click('chestTake'); h.reload(); h.acts.chestTake();
    expect(h.game.ownedCards.map(owned => owned.card.id)).toEqual([ordinary[0].id, egg.id, gift.id]);
    expect(h.saved().current).toMatchObject({ taken:[0, 3, 4], lost:[1, 2] });
  });

  it.each(['medium'].flatMap(kind => [0, 1, 2, 3].map(size => ({ kind, size }))))(
    '$kind 职业池仅$size张：按实际候选数保存，空池蛋独立可领', async ({ kind, size }) => {
      const h = await setup({ kind, pool:classCards.slice(0, size), isClass:true });
      expect(h.saved().current.claimMode).toBe(size ? 'one' : 'all');
      expect(h.saved().current.choiceCount).toBe(size || undefined);
      expect(h.saved().current.cards).toHaveLength(size + 1);
      h.reload(); h.reveal();
      if (size) { h.click('chestPick', 0); expect(h.saved().current.lost).toEqual(Array.from({ length:size - 1 }, (_, i) => i + 1)); }
      h.reload(); h.click('chestTake1', size);
      expect(h.game.ownedCards.filter(owned => owned.card.id === egg.id)).toHaveLength(1);
      expect(restoreChestReward(h.game, h.saved())).toBeTruthy();
    });

  it.each([0, 1, 2])('随机浅池仅%s张也不会把蛋并入候选，快照可恢复', async size => {
    const h = await setup({ kind:'medium', pool:ordinary.slice(0, size) }); h.reload(); h.reveal();
    expect(h.saved().current.choiceCount).toBe(size || undefined);
    if (size) h.click('chestPick', 0);
    h.click('chestTake1', size); h.reload();
    expect(h.saved().current.lost).not.toContain(size);
    expect(h.game.ownedCards.filter(owned => owned.card.id === egg.id)).toHaveLength(1);
  });

  it('蛋若本已在基础池中，不复制、不改为附赠，也不伪报额外出蛋', async () => {
    const h = await setup({ kind:'medium', pool:[ordinary[0], ordinary[1], egg] }); h.reveal();
    expect(h.saved().current).toMatchObject({ choiceCount:3, claimMode:'one' });
    expect(h.saved().current.cards).toHaveLength(3);
    expect(h.pity).toHaveBeenCalledExactlyOnceWith({ eggGranted:false });
    h.click('chestPick', 0); expect(h.saved().current.lost).toEqual([1, 2]);
  });

  it.each(['large', 'boss'])('%s 保持全部领取，宠物蛋与原有附赠不受选择边界影响', async kind => {
    const h = await setup({ kind }); h.reveal();
    expect(h.body.querySelector('.reward-count')).toBeNull();
    expect(h.saved().current.claimMode).toBe('all'); expect(h.saved().current.choiceCount).toBeUndefined();
    expect(h.body.querySelectorAll('[data-act="chestPick"]')).toHaveLength(0);
    const count = h.saved().current.cards.length;
    h.click('chestTake'); h.reload(); h.acts.chestTake();
    expect(h.game.ownedCards).toHaveLength(count); expect(h.saved().current.lost).toEqual([]);
    expect(h.game.ownedCards.filter(owned => owned.card.id === egg.id)).toHaveLength(1);
  });

  it('部分领取、完成和重载保留实际库存，不显示入包汇总', async()=>{
    const h=await setup({kind:'large'}); h.reveal();
    const card=h.saved().current.cards[0];
    h.game.ownedCards.push({card:{id:'prior',name:'以前的卡'}});
    h.click('chestTake1',0); h.click('chestClosePicker');
    expect(h.body.querySelector('.cqo-receipt')).toBeNull();
    expect(h.game.ownedCards.some(owned=>owned.card.name===card.name)).toBe(true);
    h.reload(); expect(h.body.querySelector('.cqo-receipt')).toBeNull();
    h.click('chestOpen',0); h.click('chestTake');
    const received=h.saved().current.cards;
    expect(h.body.querySelector('.cqo-receipt')).toBeNull();
    for(const got of received) expect(h.game.ownedCards.some(owned=>owned.card.id===got.id)).toBe(true);
  });
  it.each(['medium'])('%s 旧快照缺少claimMode/choiceCount时维持原有恢复语义', async kind => {
    const h = await setup({ kind }); const legacy = h.saved();
    for (const reward of [legacy.current, legacy.queue[0].reward]) {
      delete reward.claimMode; delete reward.choiceCount; reward.rewardStage = 'cards';
    }
    legacy.screen = 'cards';
    expect(h.Chests.restore(h.game, legacy, h.done)).toBe(true);
    expect(h.saved().current.claimMode).toBe(kind === 'medium' ? 'one' : 'all');
    expect(h.saved().current.choiceCount).toBeUndefined();
    expect(h.body.querySelectorAll(`[data-act="${kind === 'medium' ? 'chestPick' : 'chestTake1'}"]`)).toHaveLength(4);
  });
  it.each([false, true])('新小箱职业=%s仅随机一张，原金币/抽取序列不变', async isClass => {
    const h = await setup({ isClass, pool:isClass ? classCards : ordinary, withEgg:false });
    expect(mapData.chestKinds.small).toMatchObject({ cards:1, coins:[1, 1] });
    expect(mapData.chestKinds.small.pickFrom).toBeUndefined();
    expect(h.saved().current).toMatchObject({ claimMode:'all', coins:1, cards:[isClass ? classCards[0] : ordinary[0]] });
    expect(h.saved().current.choiceCount).toBeUndefined();
    expect(h.draw).toHaveBeenCalledTimes(isClass ? 0 : 1);
    expect(h.random.mock.calls).toEqual(Array.from({ length:isClass ? 3 : 2 }, () => ['loot']));
    expect(window.SDT.Cards.pickOfRarity).not.toHaveBeenCalled();
    h.reload(); h.reveal(); h.reload();
    expect(h.body.querySelectorAll('[data-act="chestPick"]')).toHaveLength(0);
    expect(h.body.querySelectorAll('[data-act="chestTake1"]')).toHaveLength(1);
    const stale = h.acts.chestTake1;
    h.click('chestTake1', 0); stale({ i:0 }); stale({ i:0 });
    expect(h.game.grantCard).toHaveBeenCalledTimes(1);
    expect(h.saved()).toBeNull();
    expect(h.done).toHaveBeenCalledTimes(1);
    expect(h.game.state).toBe('idle');
    expect(document.querySelector('.reward-completion-receipt').textContent).toContain(isClass ? classCards[0].name : ordinary[0].name);
  });

  it.each([false, true])('小箱职业=%s满包保留同一卡，重载整理后只发一次', async isClass => {
    const h = await setup({ isClass, pool:isClass ? classCards : ordinary, withEgg:false, capacity:1 });
    h.game.ownedCards.push({ card:{ id:'filler', name:'占位', type:'法术' } });
    h.reveal(); h.acts.chestTake1({ i:0 });
    expect(h.saved().current).toMatchObject({ taken:[], lost:[] });
    const original = h.saved().current.cards;
    await h.acts.chestReturn();
    const parked = JSON.parse(JSON.stringify(h.game.nodeChestRewards['0,1']));
    expect(h.Chests.restore(h.game, parked, h.done)).toBe(true);
    h.click('chestNext'); h.reload(); h.game.ownedCards.pop(); h.Chests.resume();
    h.click('chestTake1', 0); h.acts.chestTake1({ i:0 });
    expect(h.game.ownedCards.map(x => x.card)).toEqual(original);
    expect(h.saved()).toBeNull();
    expect(h.done).toHaveBeenCalledTimes(1);
    expect(h.game.nodeChestRewards['0,1']).toBeUndefined();
    expect(h.game.grantCard).toHaveBeenCalledTimes(2); // One refusal, one successful grant.
  });

  it('小箱原有蛋与领卡附赠独立领取且重载不重发', async () => {
    const h = await setup({ withGift:true }); h.reveal();
    expect(h.saved().current.cards).toHaveLength(2);
    h.click('chestTake1', 0); h.reload();
    expect(h.saved().current.cards.map(card => card.id)).toEqual([ordinary[0].id, egg.id, gift.id]);
    h.click('chestTake'); h.reload(); h.acts.chestTake();
    expect(h.game.ownedCards.map(x => x.card.id)).toEqual([ordinary[0].id, egg.id, gift.id]);
    expect(h.saved().current.lost).toEqual([]);
  });

  it.each(['one', 'all', undefined])('旧小箱%s快照保留三张及原领取模式，不按单卡配置裁剪', async claimMode => {
    const h = await setup({ withEgg:false }); const legacy = h.saved();
    for (const reward of [legacy.current, legacy.queue[0].reward]) {
      reward.cards = ordinary; reward.rewardStage = 'cards';
      if (claimMode) reward.claimMode = claimMode; else delete reward.claimMode;
      if (claimMode === 'one') reward.choiceCount = 3;
    }
    legacy.screen = 'cards'; const draws = h.draw.mock.calls.length, randoms = h.random.mock.calls.length;
    expect(h.Chests.restore(h.game, legacy, h.done)).toBe(true);
    expect(h.saved().current.cards).toEqual(ordinary);
    expect(h.saved().current.claimMode).toBe(claimMode || 'all');
    expect(h.body.textContent).toContain(claimMode === 'one' ? '3 张中选 1 张' : '3 张 · 可全部领取');
    expect(h.draw).toHaveBeenCalledTimes(draws); expect(h.random).toHaveBeenCalledTimes(randoms);
    h.click(claimMode === 'one' ? 'chestPick' : 'chestTake1', 0); h.reload();
    expect(h.saved().current.lost).toEqual(claimMode === 'one' ? [1, 2] : []);
  });

});

describe('三选一与附赠的总览状态连续性', () => {
  it('尚未选择时总览只陈述选择规则，不提前宣布放弃', async () => {
    const h = await setup({ kind:'medium' });
    h.reveal(); h.click('chestClosePicker');
    const rule = h.body.querySelector('.cqo-box-rule').textContent;
    expect(rule).toBe('3 张中选 1 张');
    expect(h.saved().current).toMatchObject({ taken:[], lost:[] });
  });

  it.each([false, true])('已选择且附赠待领，重载=%s：总览与卡牌页均明确其余基础卡已放弃', async reload => {
    const h = await setup({ kind:'medium', capacity:1 });
    h.reveal();
    const oldPick = h.acts.chestPick;
    h.click('chestPick', 0);
    h.click('chestClosePicker');
    if (reload) h.reload();
    expect(h.saved().current).toMatchObject({ taken:[0], lost:[1, 2] });
    expect(h.saved().queue[0].completed).toBe(false);
    const rule = h.body.querySelector('.cqo-box-rule').textContent;
    expect(rule).toContain('其余 2 张已放弃');
    expect(rule).toContain('剩余 1 张待处理');
    expect(rule).not.toContain('未领取');
    h.click('chestOpen', 0);
    expect([...h.body.querySelectorAll('.reward-unit.dropped .reward-unit-state')].map(el => el.textContent)).toEqual(['×未选择 · 已放弃', '×未选择 · 已放弃']);
    const before = h.game.grantCard.mock.calls.length;
    oldPick({ i:1 }); h.acts.chestPick({ i:1 });
    expect(h.game.grantCard).toHaveBeenCalledTimes(before);
    expect(h.saved().current).toMatchObject({ taken:[0], lost:[1, 2] });
  });

  it('附赠全部领完后总览保留真实放弃数并允许继续探索', async () => {
    const h = await setup({ kind:'medium' }); h.reveal();
    h.click('chestPick', 0); h.click('chestTake1', 3);
    expect(h.body.querySelector('.cqo-box-rule').textContent).toBe('已领取 2 张 · 其余 2 张已放弃');
    expect(h.saved().current).toMatchObject({ taken:[0, 3], lost:[1, 2] });
    h.click('chestFinish'); expect(h.done).toHaveBeenCalledTimes(1);
  });
});

describe('真实领奖卡面与详情共用动作', () => {
  it.each([['medium', 16], ['small', 16], ['medium', 1], ['small', 1]])('%s 容量%s时详情与卡面动作一致且不暗中领卡', async (kind, capacity) => {
    const h = await setup({ kind, capacity });
    if (capacity === 1) h.game.ownedCards.push({ card:{ id:'full', name:'占位', type:'法术' } });
    const zoom = vi.fn(); window.SDT.UI.showCardZoom = zoom;
    h.reveal();
    const original = h.body.querySelector('.reward-unit [data-act]:not([data-act="chestSelect"])');
    h.click('chestSelect', 0);
    const footer = document.createElement('div'); footer.innerHTML = zoom.mock.calls[0][1].footer;
    const button = footer.querySelector('button');
    expect(button.dataset.act).toBe(original.dataset.act);
    expect(button.textContent).toBe(original.textContent);
    expect(button.dataset.cancel).toBe('false');
    if (kind === 'medium') expect(footer.textContent).toContain('其余基础候选将放弃');
    expect(h.game.grantCard).not.toHaveBeenCalled();
    expect(h.saved().current).toMatchObject({ taken:[], lost:[] });
  });
});
