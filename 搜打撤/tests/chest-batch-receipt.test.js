import { chestBaseMocks } from './helpers/environment-fixtures.js';
import { continueChestRewards } from './helpers/chest-actions.js';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); delete window.SDT; document.body.innerHTML = ''; });

it.each([[true, true, false], [true, false, false], [false, true, false], [false, false, false], [true, true, true]])('本批顶部与领取名单一致（首箱领取=%s，次箱领取=%s，异名=%s）', async (first, second, distinct) => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  const actions = {};
  let pendingAction;
  ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) pendingAction=actions[button.dataset.act]?.(button.dataset);
  });
  const card = { id: 'queue-card', name: '队列测试卡', rarity: '古朴', type: '法术', desc: '', cost: 0 };
  const otherCard = { ...card, id:'queue-card-2', name:'队列测试卡二' };
  const done = vi.fn();
  const game = {
    state: 'idle', myClass: '', ownedCards: [],
    usedSlots: () => game.ownedCards.length, bagCap: () => 10, canReceiveCard: () => true,
    grantCard: vi.fn(item => { game.ownedCards.push({ card:item }); return true; }), gainCoins: vi.fn(),
  };
  const UI = {
    el: { overlay, ovBody, ovTitle: document.getElementById('ovTitle') },
    showOverlay(title, html) { this.el.ovTitle.innerHTML = title; ovBody.innerHTML = html; overlay.hidden = false; },
    hideOverlay() { overlay.hidden = true; },
    act(name, fn) { actions[name] = fn; },
    refresh: vi.fn(), log: vi.fn(),
  };
  const dropCard = distinct ? vi.fn().mockReturnValueOnce(card).mockReturnValue(otherCard) : () => card;
  window.SDT = {
    UI, MAP: { chestKinds: { small: { name:'小宝箱', cards:1, coins:[2, 2] } } },
    Cards: { RARITIES:['古朴','稀有','史诗','传说'], all:() => [card, otherCard], randomDropCard:dropCard,
      pickOfRarity:() => card, classPool:() => [], rarityOf:item => item.rarity,
      sellPrice:() => 1, cardHTML:() => '<div>队列测试卡</div>' },
    ...chestBaseMocks(() => vi),
  };
  const { SDT } = await import('../game/src/run/chests.js');
  SDT.Chests.open(game, [{kind:'small'}, {kind:'small'}], done);
  let claimed = 0;
  for (const take of [first, second]) {
    expect(ovBody.querySelector('[data-eps-search]')).toBeNull(); await pendingAction;
    if (take) {
      ovBody.querySelector('[data-act="chestTake1"]').click(); await pendingAction;
      claimed++;
    } else {
      ovBody.querySelector('[data-act="chestSkip"]').click(); await pendingAction;
      ovBody.querySelector('[data-act="chestLeave"]').click(); await pendingAction;
    }

    expect(ovBody.querySelector('.reward-notice')).toBeNull();
    expect(ovBody.querySelector('.cqo-receipt')).toBeNull();
    expect(game.grantCard).toHaveBeenCalledTimes(claimed);
    expect(game.gainCoins).toHaveBeenCalledTimes(2);
  }
  expect(ovBody.querySelector('[data-act="chestContinue"]')).not.toBeNull();
  await continueChestRewards(actions);
  expect(done).toHaveBeenCalledTimes(1);
  expect(game.state).toBe('idle');
});
