import { afterEach, describe, expect, it, vi } from 'vitest';

const card = { id: 'fixture-card', name: '测试补给卡', rarity: '古朴', type: '法术', desc: '测试', cost: 0 };

describe('宝箱点击链路', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete window.SDT;
    document.body.innerHTML = '';
  });

  it('搜索中点击宝箱立即揭晓，点击卡牌经 data-act 入包并结束宝箱', async () => {
    vi.useFakeTimers();
    const acts = {};
    const ovBody = document.createElement('div');
    ovBody.id = 'ovBody';
    ovBody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-act]');
      if (button) acts[button.dataset.act]?.(button.dataset);
    });
    const cardShell = document.createElement('div');
    cardShell.className = 'card';
    cardShell.innerHTML = '<h2 id="ovTitle"></h2>';
    cardShell.append(ovBody);
    const overlay = document.createElement('div');
    overlay.id = 'overlay';
    overlay.append(cardShell);
    document.body.append(overlay);

    const ownedCards = [];
    const game = {
      state: 'idle', myClass: '', ownedCards,
      usedSlots: () => ownedCards.length,
      bagCap: () => 10,
      canReceiveCard: () => true,
      grantCard: (item) => { ownedCards.push({ card: item, count: 1 }); return true; },
      gainCoins: vi.fn(),
    };
    const UI = {
      el: { overlay, ovBody, ovTitle: cardShell.querySelector('#ovTitle'), ovCloseX: null },
      showOverlay(title, html) {
        this.el.ovTitle.innerHTML = title;
        ovBody.innerHTML = html;
        overlay.hidden = false;
      },
      hideOverlay() { overlay.hidden = true; },
      act: (name, fn) => { acts[name] = fn; },
      refresh: vi.fn(),
      log: vi.fn(),
    };
    window.SDT = {
      UI,
      MAP: { chestKinds: { small: { name: '小宝箱', cards: 1, coins: [0, 0] } } },
      Cards: {
        RARITIES: ['古朴', '稀有', '史诗', '传说'],
        all: () => [card],
        randomDropCard: () => card,
        pickOfRarity: () => card,
        classPool: () => [],
        rarityOf: (item) => item.rarity,
        sellPrice: () => 1,
        cardHTML: () => '<div class="hs-card">测试卡</div>',
      },
      Base: { data: { eggPity: 0, eggBattles: 0 }, save: vi.fn(), bagCap: () => 10, isSha: () => false },
      Sound: { sfx: vi.fn() },
      Icons: { rich: (html) => html },
    };

    const { SDT: chestFacade } = await import('../game/src/run/chests.js');
    chestFacade.Chests.open(game, [{ kind: 'small' }]);
    expect(ovBody.querySelector('[data-eps-search]')).not.toBeNull();
    ovBody.querySelector('[data-eps-search]').click();
    expect(ovBody.querySelector('[data-act="chestTake1"]')).not.toBeNull();

    ovBody.querySelector('[data-act="chestTake1"]').click();
    expect(ownedCards).toHaveLength(1);
    ovBody.querySelector('[data-act="chestTake"]').click();
    expect(game.state).toBe('idle');
    expect(overlay.hidden).toBe(true);
  });
});
