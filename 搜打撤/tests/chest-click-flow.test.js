import { chestBaseMocks } from './helpers/environment-fixtures.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

const card = { id: 'fixture-card', name: '测试补给卡', rarity: '古朴', type: '法术', desc: '测试', cost: 0 };

describe('搜刮点点击链路', () => {
  afterEach(() => {
    vi.useRealTimers();
    delete window.SDT;
    document.body.innerHTML = '';
  });

  it.each([true, false])('放大阅读可安全关闭，从独立或特写按钮领取后单箱直接返回探索（特写领取=%s）', async zoomClaim => {
    vi.resetModules();
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
      showCardZoom:vi.fn((selectedCard, options) => {
        const zoom = document.createElement('div'); zoom.id = 'cardZoom';
        zoom._closeCardZoom = vi.fn(() => zoom.remove());
        zoom.innerHTML = `<p>${selectedCard.desc}</p>${options.footer}`;
        zoom.addEventListener('click', event => {
          const button = event.target.closest('[data-act]');
          if (button) acts[button.dataset.act]?.(button.dataset);
        });
        document.body.appendChild(zoom);
      }),
    };
    window.SDT = {
      UI,
      MAP: { chestKinds: { small: { name: '小型物资箱', cards: 1, coins: [0, 0] } } },
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
      ...chestBaseMocks(() => vi),
    };

    const { SDT: chestFacade } = await import('../game/src/run/chests.js');
    chestFacade.Chests.open(game, [{ kind: 'small' }]);
    expect(ovBody.querySelector('.cqo-overview')).toBeNull();
    expect(ovBody.querySelector('[data-eps-search]')).toBeNull();
    expect(ownedCards).toHaveLength(0);
    expect(ovBody.querySelector('[data-act="chestTake1"]')).not.toBeNull();
    expect(ovBody.querySelector('[data-act="chestSelect"]')).not.toBeNull();
    expect(ovBody.querySelector('.reward-compact')).toBeNull();
    expect(ovBody.querySelectorAll('.reward-stage [data-act="chestTake1"]')).toHaveLength(1);
    expect(ovBody.querySelectorAll('.reward-foot [data-act="chestTake1"]')).toHaveLength(0);
    expect(ovBody.querySelector('.reward-foot [data-act="chestOpenBag"]')).not.toBeNull();
    expect(ovBody.querySelector('.reward-foot [data-act="chestReturn"]')).not.toBeNull();
    expect(ovBody.querySelector('[data-act="chestSkip"]').closest('details').open).toBe(false);
    ovBody.querySelector('[data-act="chestSelect"]').click();
    expect(ownedCards).toHaveLength(0);   // 查看不领取
    expect(UI.showCardZoom).toHaveBeenCalledWith(card, expect.objectContaining({ from:expect.any(HTMLElement), hideNote:true, presentation:'expedition', footer:expect.stringContaining('chestTake1') }));
    expect(ovBody.querySelector('.reward-detail')).toBeNull();
    expect(document.querySelector('#cardZoom').textContent).toContain(card.desc);
    document.getElementById('cardZoom')._closeCardZoom(true);
    expect(ownedCards).toHaveLength(0);
    expect(game.state).toBe('modal');
    ovBody.querySelector('[data-act="chestSelect"]').click();
    const close = document.getElementById('cardZoom')._closeCardZoom;
    if (zoomClaim) document.querySelector('#cardZoom [data-act="chestTake1"]').click();
    else {
      close(true);
      ovBody.querySelector('[data-act="chestTake1"]').click();
    }
    expect(close).toHaveBeenCalledWith(true);
    for (let n=0;n<8;n++) await Promise.resolve();
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(ownedCards).toHaveLength(1);
    expect(document.querySelector('.reward-completion-receipt').textContent).toContain('已收下');
    expect(document.querySelector('.reward-completion-receipt').getAttribute('role')).toBe('status');
    acts.chestTake1({ i:0 }); // Old receipt callback cannot re-grant or reopen the completed queue.
    expect(ownedCards).toHaveLength(1);
    expect(game.state).toBe('idle');
    expect(overlay.hidden).toBe(true);
    expect(window.SDT.Base.recordPetEggChestResult).toHaveBeenCalledTimes(1);
    expect(window.SDT.Base.recordPetEggChestResult).toHaveBeenCalledWith({ eggGranted: false });
  });
});
