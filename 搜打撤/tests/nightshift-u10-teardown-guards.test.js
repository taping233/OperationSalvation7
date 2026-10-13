import { afterEach, describe, expect, it, vi } from 'vitest';

// U10（2026-09-29 夜班）：teardown 后触发面守卫批量收口（find-E-0120 H1-H4）。
// 构造姿势对齐 e4-battle-loader U5-a：vi.stubGlobal 拆宿主 + 假定时器把挂起回调推过拆除线；
// 守卫语义 = 环境拆除分支安全短路（浏览器内不可达，生产行为逐字不变）。

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.SDT;
  document.body.innerHTML = '';
});

// H2 chests.js:389——逐卡揭晓音效定时器裸引 document.querySelector（无句柄无清理）
// 注：H2/H3/H4 置于文件前部、H1（拆 window）垫后——sdt-facade 首次 import 时固化
// window.SDT 门面引用，须保证首次装载发生在宿主存活时（否则 sdtDefine 写入孤儿对象）。
describe('U10 H2 chests 逐卡揭晓音效守卫', () => {
  it('揭晓后 document 拆除，音效定时器安全短路，不抛 document 引用错', async () => {
    vi.useFakeTimers();
    // 骨架逐字镜像 chest-click-flow.test.js 的已验证桩集
    const acts = {};
    const ovBody = document.createElement('div');
    ovBody.id = 'ovBody';
    ovBody.addEventListener('click', event => {
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
    const card = { id: 'fixture-card', name: '测试补给卡', rarity: '古朴', type: '法术', desc: '测试', cost: 0 };
    const game = {
      state: 'idle', myClass: '', ownedCards,
      usedSlots: () => ownedCards.length, bagCap: () => 10,
      canReceiveCard: () => true,
      grantCard: item => { ownedCards.push({ card: item, count: 1 }); return true; },
      gainCoins: vi.fn(),
    };
    const UI = {
      el: { overlay, ovBody, ovTitle: cardShell.querySelector('#ovTitle'), ovCloseX: null },
      showOverlay(title, html) { this.el.ovTitle.innerHTML = title; ovBody.innerHTML = html; overlay.hidden = false; },
      hideOverlay() { overlay.hidden = true; },
      act: (name, fn) => { acts[name] = fn; },
      refresh: vi.fn(), log: vi.fn(),
    };
    window.SDT = {
      UI,
      MAP: { chestKinds: { small: { name: '小宝箱', cards: 1, coins: [0, 0] } } },
      Cards: {
        RARITIES: ['古朴', '稀有', '史诗', '传说'],
        all: () => [card], randomDropCard: () => card, pickOfRarity: () => card, classPool: () => [],
        rarityOf: item => item.rarity, sellPrice: () => 1, cardHTML: () => '<div class="hs-card">测试卡</div>',
      },
      Base: { data: { eggPity: 0, eggBattles: 0 }, save: vi.fn(), petEggDropChance: () => 0, recordPetEggChestResult: vi.fn(), bagCap: () => 10, isSha: () => false },
      Sound: { sfx: vi.fn() },
      Icons: { rich: html => html },
    };
    const { SDT: chestFacade } = await import('../game/src/run/chests.js');
    chestFacade.Chests.open(game, [{ kind: 'small' }]);
    ovBody.querySelector('[data-eps-search]').click();        // 立即揭晓 → scheduleRevealSfx 挂 140ms 定时器（无句柄）
    ovBody.querySelector('[data-act="chestTake1"]').click();
    ovBody.querySelector('[data-act="chestContinue"]').click(); // 单卡已领完，继续探索使 cur 失活
    expect(chestFacade.Chests.isOpen()).toBe(false);
    expect(vi.getTimerCount()).toBeGreaterThan(0);             // 揭晓音效定时器仍待触发
    vi.stubGlobal('document', undefined);
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
  });
});

// H3 cardslib.page.js:716——关页 240ms 淡出摘类定时器裸引 document.body（唯一守卫是模块内存位）
describe('U10 H3 cardslib 关页摘类守卫', () => {
  it('关页 240ms 摘类定时器在 document 拆除后安全短路', async () => {
    vi.useFakeTimers();
    window.SDT = {
      UI: { hideOverlay: vi.fn(), showOverlay: vi.fn(), refresh: vi.fn(), log: vi.fn(), act: vi.fn(), el: { ovBody: document.createElement('div') } },
      game: { state: 'title' },
      Sound: { sfx: vi.fn() },
      Cards: { all: () => [], RARITIES: [] },
      Icons: { rich: v => v },
      // recovery.commands 装载期（game.session 依赖链）会读 BASE_VERSION
      Base: { BASE_VERSION: 1, SLOT_KEY: id => `slot-${id}`, data: {}, save: vi.fn(() => true) },
    };
    await import('../game/src/hub/game.cardslib.page.js');    // 装载即注册 closeLibrary closer（page.js:723）
    const { closeCardPageTop } = await import('../game/src/hub/game.cardslib.common.js');
    closeCardPageTop();   // 空 body（无 cdesStage/depMain/hubMain）→ 直达真实 closeLibPage → 挂 240ms 摘类定时器
    vi.stubGlobal('document', undefined);
    expect(() => vi.advanceTimersByTime(240)).not.toThrow();
  });
});

// H4 cinematics.js:81——发卡队列 close 后 setTimeout(showNext, 100)，showNext 直写 document.body
describe('U10 H4 cinematics 发卡队列续棒守卫', () => {
  it('队列 close 后 100ms 续棒定时器在 document 拆除后安全短路', async () => {
    vi.useFakeTimers();
    window.SDT = {
      game: { runActive: true },
      Sound: { sfx: vi.fn() },
      Cards: { cardHTML: () => '<div class="x"></div>' },
    };
    const { cinematicsMethods } = await import('../game/src/ui/cinematics.js');
    const card = { name: '测试卡', rarity: '稀有' };
    cinematicsMethods.showCardReward(card);          // 立即展示第一张（document 存活）
    cinematicsMethods.showCardReward(card);          // 第二张入队（多张连发自动排队）
    document.getElementById('cardGet').click();      // 收下第一张 → close() → setTimeout(showNext, 100)
    vi.stubGlobal('document', undefined);
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
  });

  it('战斗获得按显示时上下文分层，后续队列回到地图不会沿用战斗样式', async () => {
    vi.resetModules(); vi.useFakeTimers();
    window.SDT = {
      game: { runActive:true, battleActive:true },
      Sound: { sfx:vi.fn() },
      Cards: { rarityOf:() => '棱彩', cardHTML:card => `<div class="hs-card rv-prism">${card.name}</div>` },
    };
    document.body.innerHTML = '<div id="overlay"><div class="battle-stage"></div></div>';
    const { cinematicsMethods } = await import('../game/src/ui/cinematics.js');
    const card = { name:'能力样本', rarity:'稀有' };
    cinematicsMethods.showCardReward(card, '实际来源');
    cinematicsMethods.showCardReward(card);
    const first = document.getElementById('cardGet');
    expect(first.dataset.combat).toBe('true');
    expect(first.dataset.rarity).toBe('棱彩');
    expect(first.querySelector('.lg-kicker').textContent).toBe('棱彩获得');
    expect(first.querySelector('.lg-name')).toBeNull();
    first.click();
    window.SDT.game.battleActive = false;
    document.querySelector('.battle-stage').remove();
    vi.advanceTimersByTime(100);
    const queued = [...document.querySelectorAll('#cardGet')].at(-1);
    expect(queued.dataset.combat).toBe('false');
    expect(queued.querySelector('.lg-name').textContent).toBe('能力样本');
    expect(queued.querySelector('.lg-hint').textContent).toBe('点击任意处继续');
  });
});

// H1 pocket-strip.js:91——600ms 永久 interval 的 tick() 裸引 window.SDT（模块装载即自启，无清理通道）。
// 置于文件末尾：本用例拆除整个 window，须保证其余用例的 sdt-facade 首次装载已在此前完成。
describe('U10 H1 pocket-strip tick 宿主守卫', () => {
  it('window 拆除后 600ms 轮询安全短路，不抛 window 引用错', async () => {
    vi.useFakeTimers();
    await import('../game/src/experience/pocket-strip.js');   // 模块自启 startPocketStrip → setInterval(tick, 600)
    expect(vi.getTimerCount()).toBeGreaterThan(0);            // 自证 interval 已挂（用例非空转）
    vi.stubGlobal('window', undefined);
    expect(() => vi.advanceTimersByTime(600)).not.toThrow();
  });
});
