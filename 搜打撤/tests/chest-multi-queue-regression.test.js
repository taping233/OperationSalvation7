import { continueChestRewards } from './helpers/chest-actions.js';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); delete window.SDT; document.body.innerHTML = ''; });

it('multi-chest leave and take actions advance exactly once per box', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  const actions = {};
  ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) actions[button.dataset.act]?.(button.dataset);
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
  window.SDT = {
    UI, MAP: { chestKinds: { small: { name:'小宝箱', cards:2, coins:[2, 2] } } },
    Cards: { RARITIES:['古朴','稀有','史诗','传说'], all:() => [card, otherCard], randomDropCard:seen => seen.has(card.id) ? otherCard : card,
      pickOfRarity:() => card, classPool:() => [], rarityOf:item => item.rarity,
      sellPrice:() => 1, cardHTML:() => '<div>队列测试卡</div>' },
    Base: { data:{eggPity:0,eggBattles:0}, save:vi.fn(), petEggDropChance:() => 0,
      recordPetEggChestResult:vi.fn(), bagCap:() => 10, isSha:() => false },
    Sound: { sfx:vi.fn() }, Icons: { rich:html => html },
  };
  const { SDT } = await import('../game/src/run/chests.js');
  SDT.Chests.open(game, [{kind:'small'}, {kind:'small'}], done);
  expect(ovBody.querySelector('.cqo-progress').getAttribute('aria-label')).toBe('2 箱待领，共 2 箱');
  ovBody.querySelector('[data-act="chestNext"]').click();
  ovBody.querySelector('[data-act="chestReveal"]').click();
  const previews = [...ovBody.querySelectorAll('[data-act="chestSelect"]')];
  const claims = [...ovBody.querySelectorAll('[data-act="chestTake1"]')];
  expect(previews).toHaveLength(2);
  expect(claims).toHaveLength(2);
  for (const preview of previews) {
    expect(preview).toBeInstanceOf(HTMLButtonElement);
    expect(preview.type).toBe('button');
    expect(preview.getAttribute('aria-label')).toMatch(/^放大查看.+/);
  }
  for (const claim of claims) {
    expect(claim).toBeInstanceOf(HTMLButtonElement);
    expect(claim.type).toBe('button');
    expect((claim.getAttribute('aria-label') || claim.textContent).trim()).toBe('收下');
  }
  expect(ovBody.querySelector('[data-act="chestSkip"]')).not.toBeNull();
  ovBody.querySelector('[data-act="chestSkip"]').click();
  expect(ovBody.querySelector('[data-act="chestLeave"]')).not.toBeNull();
  ovBody.querySelector('[data-act="chestLeave"]').click();
  expect(ovBody.querySelector('.cqo-overview')).not.toBeNull();
  continueChestRewards(actions);
  expect(ovBody.querySelector('.cqo-progress').getAttribute('aria-label')).toBe('1 箱待领，共 2 箱');
  expect(ovBody.querySelector('[data-act="chestSelect"]')).toBeNull();
  ovBody.querySelector('[data-act="chestNext"]').click();
  ovBody.querySelector('[data-act="chestReveal"]').click();
  expect(ovBody.querySelector('[data-act="chestTake"]')).not.toBeNull();
  ovBody.querySelector('[data-act="chestTake"]').click();
  expect(game.grantCard).toHaveBeenCalledTimes(2);
  continueChestRewards(actions);
  expect(done).toHaveBeenCalledTimes(1);
  expect(game.state).toBe('idle');
  expect(overlay.hidden).toBe(true);
  expect(game.gainCoins).toHaveBeenCalledTimes(2);
});
