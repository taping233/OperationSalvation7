// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// 2026-09-22 hub 拆分：断言串分布在壳与两个切片，三文件拼接后仍断言「基地源码含 X」
const hub = ['hub/game.hub.runtime.js', 'hub/game.hub.depart.js', 'hub/game.hub.pages.js']
  .map((f) => readFileSync(`game/src/${f}`, 'utf8')).join('\n');
const altar = readFileSync('game/src/run/game.run.class-choice.page.js', 'utf8');
const departure = readFileSync('game/src/run/game-session-departure.js', 'utf8');

describe('基地出发与选角回流回归', () => {
  it('选角预览同步初始选择，基地入口先选人物再进入卡牌整备', () => {
    expect(altar).toContain("let sel = previous && picks.includes(previous.rulesetId) ? previous.rulesetId : picks[0];");
    expect(altar).toContain("if (onCancel) { onCancel(); return; }");
    expect(hub).toContain('requestClassChoice({');
    expect(hub).toContain('onSelect: (cl, start) => {');
    expect(hub).toContain('deployCharacter = cl;');
    expect(hub).toContain('deployStart = start;');
    expect(hub).toContain('openDepartPrep');
    expect(hub).toMatch(/await newRun\(mode, picks, \{ skipClassChoice: true,[\s\S]*?isCurrent:/);
    expect(departure).toContain('openClassChoice');
    expect(departure).toContain('departure-pending');
  });

  it('出征整备写盘失败会留在整备页并停止出发', () => {
    expect(hub).toMatch(/const started = await newRun\(mode, picks, \{ skipClassChoice: true,/);
    expect(hub).toContain('if (started === false) {');
    expect(hub).toContain('deployHint = deployRecovery');
    expect(hub).toContain('本次出征已开始保存，原人物与携带已固定；请继续本次出征，或返回选档恢复。');
    expect(hub).toContain('出征存档尚未完成，携带选择已保留；可调整后重试。');
    // 顺序守卫：失败分支 → 重置选牌 → 成功返回；中间允许有限的合法插入（音效/埋点），不锁死相邻字节（CRLF 教训同族）
    expect(hub).toContain('const finishPublishedDeparture = async ownsPage => {');
    expect(altar).toContain('const result = await beforeConfirm();');
    expect(altar.indexOf('await beforeConfirm()')).toBeLessThan(altar.indexOf('const card = SDT.Cards.randomClassCard(cl)'));
  });
});

describe('基地操作键盘语义与危险操作保护', () => {
  it('仓库卡牌为可聚焦的非提交按钮，整备拖拽卡面提供键盘语义与焦点样式', async () => {
    const harness = await createBrowsingHarness();
    try {
      harness.base.data.stash = [{ card: { id: 'keyboard', name: '键盘检查', type: '武术', rarity: '古朴' }, count: 1 }];
      harness.runtime.openBaseHub('stash');
      const card = harness.host.querySelector('.stash-cell');
      expect(card.tagName).toBe('BUTTON');
      expect(card.type).toBe('button');
      card.focus(); expect(document.activeElement).toBe(card);
    } finally { harness.runtime.closeBase(); document.body.replaceChildren(); }
    expect(hub).toContain('role="button" tabindex="0" aria-pressed=');
    expect(hub).toContain("e.key !== 'Enter' && e.key !== ' '");
    expect(readFileSync('game/css/hub.css', 'utf8')).toContain('.dep-card[role="button"]:focus-visible');
  });

  it('职业收藏、高价值/最后一张消费或卖出默认先就地二次确认（2026-10-06 特写操作台改版）', () => {
    // 2026-10-06 老板改版：旧确认页（stashConfirmCancel/stash-shell 弹窗）废除，
    // 危险操作改特写页脚按钮就地二次确认（armOrRun 变红 2.6s），保护语义不变
    expect(hub).toContain("armOrRun('stashCollectOne'");
    expect(readFileSync('game/src/hub/hub.trade-shop-v5.js', 'utf8')).toContain('price >= 5 || count <= 1');
    expect(hub).toContain("armOrRun('stashUseMat'");
    expect(readFileSync('game/src/hub/hub.trade-shop-v5.js', 'utf8')).toContain('data-act="tradeShopSellOne"');
  });
});

// 与 home-async-lifecycle 相同的 UI 宿主端口；基地壳和内页使用真实模块。
// jsdom 不测视觉尺寸，显式 scroll 事件只验证浏览状态的保存/返回行为。
async function createBrowsingHarness() {
  vi.resetModules();
  let activeSlot = 1;
  const stored = new Map();
  const freshData = () => ({ appearance: {}, wood: 1, rations: 0, coins: 100, keys: 0, stash: [], pocket: [] });
  const host = document.createElement('div'); host.id = 'overlay';
  document.body.replaceChildren(host);
  const ui = {
    el: { overlay: host }, _acts: {},
    showOverlay(_title, html) { host.innerHTML = html; this._acts = {}; },
    hideOverlay() { document.getElementById('cardZoom')?._closeCardZoom?.(true); host.innerHTML = ''; },
    log: vi.fn(), act(name, handler) { this._acts[name] = handler; },
    showCardZoom: vi.fn((card, options = {}) => {
      document.getElementById('cardZoom')?._closeCardZoom?.(true);
      const from = options.returnFocus || document.activeElement;
      const zoom = document.createElement('section'); zoom.id = 'cardZoom';
      zoom.innerHTML = `<div class="cz-backdrop"></div><button class="cz-close" type="button">关闭</button><div class="cz-card">${card.name}</div><div class="cz-foot">${options.footer || ''}</div>`;
      zoom._closeCardZoom = () => { zoom.remove(); if (from?.isConnected) from.focus({ preventScroll: true }); };
      zoom.addEventListener('click', event => {
        if (event.target.closest('.cz-close,.cz-backdrop')) { zoom._closeCardZoom(); return; }
        const button = event.target.closest('.cz-foot [data-act]');
        if (button && !button.disabled) ui._acts[button.dataset.act]?.({ ...button.dataset });
      });
      document.body.append(zoom);
    }),
  };
  host.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) ui._acts[button.dataset.act]?.({ ...button.dataset });
  });
  const base = {
    get slot() { return activeSlot; }, data: freshData(), PETS: [],
    keyCount: () => 0, stashUsed: () => 0, stashCap: () => 25, stashRoom: () => 25,
    ownedPets: () => [], bagCap:() => 16, canUpgradeBag:() => false, canUpgradeStash:() => false,
    purchase: vi.fn(({ price, material }) => {
      if (!material || base.data.coins < price) return { ok: false, why: 'poor' };
      base.data.coins -= price;
      base.data[material]++;
      return { ok: true };
    }),
  };
  window.SDT = {
    UI: ui, Base: base,
    Cards: { all: () => [{ id: 'tt-wood', name: '木材', type: '材料卡', rarity: '古朴', desc: '用于扩建' }, { id: 'tt-rations', name: '口粮', type: '材料卡', rarity: '古朴', desc: '用于伙伴培养' }], cardHTML: card => `<span>${card.name}</span>` },
    Sound: { music: vi.fn(), sfx: vi.fn() },
    Art: { hydrateSelectedSkins: vi.fn() },
    Meta: { checkUnlocks: vi.fn(), pendingAch: () => [], pendingColl: () => [] },
    Icons: { img: () => '' },
  };
  vi.doMock('../game/src/run/game.session.js', () => ({
    MAP: { rules: { bagMax:30, stashMax:100, bagUpgradeWood:2, stashUpgradeWood:2, stashUpgradeSlots:3 }, items: { wood: { name: '木材' }, rations: { name: '口粮' } } },
    game: { state: '' }, getActiveSlot: () => activeSlot,
    startNewGame: vi.fn(), setLobby: vi.fn(),
  }));
  vi.doMock('../game/src/hub/game.cardslib.js', () => ({
    Sfx: { ding: vi.fn(), tick: vi.fn() }, configureCardNavigation: vi.fn(), _set_cardPageOpen: vi.fn(),
  }));
  vi.doMock('../game/src/hub/base.commands.js', () => ({ readBase: vi.fn(), readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
  vi.doMock('../game/src/hub/collection.commands.js', () => ({
    convertCollection: vi.fn(), getCharacter: vi.fn(), getCollection: vi.fn(), selectSkin: vi.fn(), stackKeyOf: vi.fn(),
  }));
  vi.doMock('../game/src/home/home.commands.js', () => ({ createHomeCommands: () => ({}) }));
  vi.doMock('../game/src/home/home.presenter.js', () => ({ presentHome: value => value, homeErrorMessage: value => value.message }));
  vi.doMock('../game/src/home/home.visuals.js', () => ({ getM04VisualPack: () => ({}) }));
  vi.doMock('../game/src/home/story.last-lamp.js', () => ({ validateLastLampState: vi.fn() }));
  vi.doMock('../game/src/hub/game.hub.preparation.js', () => ({
    createHubPreparationFeature: () => ({ open: vi.fn(), dispose: vi.fn(), returnToBase: vi.fn() }),
  }));
  vi.doMock('../game/src/hub/game.hub.depart.js', async () => {
    const { baseHomeV3HTML } = await import('../game/src/hub/hub.home-v3.js');
    return {
      hubDeployHTML: () => baseHomeV3HTML({ base, meta: window.SDT.Meta, modes: { standard: { id: 'standard' }, elite: { id: 'elite', enemyMul: 1.5, coinMul: 1.5, xpMul: 1.5 } }, mode: 'standard', prepared: false, character: { id: 'wu', name: '无' }, picks: 0 }),
      openDepartPrep: vi.fn(), deployPick: {}, setDeployPick: vi.fn(),
    };
  });
  const runtime = await import('../game/src/hub/game.hub.runtime.js');
  const click = selector => {
    const button = host.querySelector(selector) || document.querySelector(`#cardZoom ${selector}`);
    expect(button, `缺少可点击入口 ${selector}`).not.toBeNull();
    button.focus();
    button.click();
  };
  const scroll = value => {
    const page = host.querySelector('.hub-page');
    page.scrollTop = value;
    page.dispatchEvent(new Event('scroll'));
  };
  return {
    runtime, base, ui, host, click, scroll,
    page: () => host.querySelector('.hub-page'),
    useSlot(next) {
      stored.set(activeSlot, base.data);
      activeSlot = next;
      base.data = stored.get(next) || freshData();
    },
  };
}

function enablePersonnelNavigationFixture() {
  Object.assign(window.SDT.Meta, { classSummary:() => [{cls:'侠客',lv:1,xp:0,need:50,pool:0,maxed:false}], perkText:level => `生命 +${level}`, isCollectible:() => true });
  Object.assign(window.SDT.Art, { listSkins:() => [], skinUrl:() => '/wu.webp', classAvatarArt:() => '<img alt="无" src="/wu.webp">' });
  window.SDT.Cards.classPool = () => [];
}

describe('基地分页、详情返回与档位浏览状态', () => {
  let browsing;
  afterEach(() => { browsing?.runtime.closeBase(); browsing = null; document.body.replaceChildren(); });

  it('七个基地房间的页头和常驻导航保持一致，浏览不改资源', async () => {
    browsing = await createBrowsingHarness();
    enablePersonnelNavigationFixture();
    Object.assign(window.SDT.Meta, { COLL_MILESTONES:[], collProgress:() => 0, collTotal:() => 0 });
    const courtyard = await import('../game/src/hub/hub.courtyard-v3.js');
    const mount = vi.spyOn(courtyard, 'mountCourtyardV3').mockImplementation(() => () => {});
    const before = JSON.stringify(browsing.base.data);
    try {
      for (const [tab, title] of Object.entries({ deploy:'基地', classes:'人物', stash:'后勤', shop:'交易所', ach:'收藏室', upgrade:'建设', courtyard:'庭院' })) {
        browsing.runtime.openBaseHub(tab);
        expect(browsing.host.querySelector('.camp-brand h2').textContent).toBe(title);
        const selected = browsing.host.querySelector('.base-navigation-v7 [aria-current="page"]');
        expect(selected.dataset.tab).toBe(tab);
        expect(selected.querySelector('span').textContent).toBe(title);
      }
      expect(JSON.stringify(browsing.base.data)).toBe(before);
    } finally { mount.mockRestore(); }
  });

  it('收藏室合并奖励入口，目标与里程碑返回奖励，再返回收藏室', async () => {
    browsing = await createBrowsingHarness();
    Object.assign(window.SDT.Meta, { COLL_MILESTONES:[], collProgress:() => 0, collTotal:() => 0 });
    const before = JSON.stringify(browsing.base.data);
    browsing.runtime.openBaseHub('ach');
    expect(browsing.host.querySelector('.hub-archive-v3').dataset.archiveView).toBe('cards');
    expect(browsing.host.querySelector('.av3-collection-progress')).toBeNull();
    browsing.click('[data-act="hubCollectionView"][data-view="rewards"]');
    expect(browsing.host.querySelector('.av3-collection-progress')).toBeNull();
    browsing.click('[data-act="hubCollectionView"][data-view="classes"]');
    expect(browsing.host.querySelector('.av12-summary [role="progressbar"]')).not.toBeNull();
    browsing.click('[data-act="rewardMain"]');
    expect(browsing.host.querySelector('.hub-archive-v3').dataset.archiveView).toBe('rewards');
    browsing.click('[data-act="hubCollectionView"][data-view="classes"]');
    const { configureCardNavigation } = await import('../game/src/hub/game.cardslib.js');
    configureCardNavigation.mock.calls.at(-1)[0].closeBase();
    expect(browsing.host.querySelector('.hub-archive-v3').dataset.archiveView).toBe('rewards');
    browsing.click('[data-act="archiveMain"]');
    expect(browsing.host.querySelector('.hub-archive-v3').dataset.archiveView).toBe('cards');
    expect(JSON.stringify(browsing.base.data)).toBe(before);
  });

  it('后勤直接进仓库，补给和扩建按来源返回，导航不修改档案', async () => {
    browsing = await createBrowsingHarness();
    const before = JSON.stringify(browsing.base.data);
    browsing.runtime.openBaseHub();
    expect(browsing.host.querySelector('.base-navigation-v7 [data-tab="shop"]')).not.toBeNull();
    browsing.click('[data-act="hubTab"][data-tab="stash"]');
    expect(browsing.host.querySelector('.warehouse-v3')).not.toBeNull();
    browsing.click('[data-act="hubTab"][data-tab="shop"]');
    expect(browsing.host.querySelector('.hub-back').getAttribute('aria-label')).toBe('返回后勤');
    browsing.click('[data-act="logisticsParent"]');
    browsing.click('[data-act="hubTab"][data-tab="upgrade"]');
    expect(browsing.host.querySelector('.hub-back').getAttribute('aria-label')).toBe('返回后勤');
    browsing.click('[data-act="logisticsParent"]');
    expect(browsing.host.querySelector('.warehouse-v3')).not.toBeNull();
    expect(JSON.stringify(browsing.base.data)).toBe(before);
  });

  it('培养经补给的整理仓库快捷回流保留人物来源和筛选', async () => {
    browsing = await createBrowsingHarness(); enablePersonnelNavigationFixture();
    browsing.base.data.stash = [{card:{id:'growth-one',name:'培养甲',cls:'侠客',rarity:'职业',type:'武术'},count:1}];
    browsing.base.stashRoom = () => 0;
    browsing.runtime.openBaseHub('classes');
    browsing.click('[data-act="hubTab"][data-tab="stash"][data-character="wu"]');
    browsing.click('[data-act="hubTab"][data-tab="shop"]');
    browsing.click('[data-act="hubTab"][data-tab="stash"][data-view="cards"]');
    expect(browsing.host.querySelector('.warehouse-purpose').hidden).toBe(false);
    expect(browsing.host.querySelector('.hub-back').dataset.act).toBe('stashOrigin');
    browsing.click('[data-act="stashOrigin"]');
    expect(browsing.host.querySelector('.personnel-v2').dataset.section).toBe('profile');
  });

  it('主页待复原快捷入口清除旧培养范围，可领取成就也在收藏入口提示', async () => {
    browsing = await createBrowsingHarness(); enablePersonnelNavigationFixture();
    browsing.base.data.stash = [{card:{id:'growth-one',name:'培养甲',cls:'侠客',rarity:'职业',type:'武术'},count:1}];
    browsing.base.data.pocket = [{card:{id:'p',name:'等待复原'},count:1}];
    window.SDT.Meta.pendingAch = () => [{id:'claimable'}];
    browsing.runtime.openBaseHub('classes');
    browsing.click('[data-act="hubTab"][data-tab="stash"][data-character="wu"]');
    browsing.click('[data-act="stashOrigin"]'); browsing.click('[data-act="hubHome"]');
    expect(browsing.host.querySelector('[data-tab="ach"] em').textContent).toBe('1');
    browsing.click('[data-act="hubTab"][data-view="pocket"]'); browsing.click('[data-act="warehouseMain"]');
    expect(browsing.host.querySelector('.warehouse-purpose').hidden).toBe(true);
    expect(browsing.host.querySelector('.hub-back').dataset.act).toBe('hubHome');
  });

  it('待复原作为次级页返回仓库，再次进入保留该页滚动位置', async () => {
    browsing = await createBrowsingHarness();
    browsing.base.data.pocket = [{ card:{id:'pocket-one',name:'待复原的牌'},count:1 }];
    browsing.runtime.openBaseHub();
    browsing.click('.base-navigation-v7 [data-act="hubTab"][data-tab="stash"]');
    const previous = browsing.host.querySelector('#hubMain');
    browsing.click('[data-act="hubStashView"][data-view="pocket"]');
    browsing.scroll(240);
    const warehouse = browsing.host.querySelector('.warehouse-v3');
    const disclosure = warehouse.querySelector('.warehouse-rules');
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector('summary').textContent).toBe('复原说明');
    expect(warehouse.querySelector('.stash-pocket-note')).toBeNull();
    expect(warehouse.querySelector('[data-warehouse-pocket-count]').textContent).toBe('1 张');
    const card = warehouse.querySelector('[data-stack-key]');
    disclosure.querySelector('summary').click();
    expect(disclosure.open).toBe(true);
    expect(disclosure.textContent).toContain('未复原卡牌将在下次出征时清空');
    expect(warehouse.querySelector('[data-stack-key]')).toBe(card);
    expect(browsing.page().scrollTop).toBe(240);
    expect(browsing.host.querySelector('[data-act="warehouseMain"]')).not.toBeNull();
    browsing.click('[data-act="warehouseMain"]');
    expect(browsing.host.querySelector('.warehouse-v3').dataset.pocket).toBe('false');
    browsing.click('[data-act="hubHome"]');
    expect(browsing.host.querySelector('#hubMain').dataset.page).toBe('deploy');
    expect(previous.isConnected).toBe(false);
    browsing.click('.base-navigation-v7 [data-act="hubTab"][data-tab="stash"]');
    browsing.click('[data-act="hubStashView"][data-view="pocket"]');

    expect(browsing.host.querySelector('.camp-section-head h2').textContent).toBe('待复原');
    expect(browsing.host.querySelector('.hub-back').dataset.act).toBe('warehouseMain');
    expect(browsing.host.querySelector('.warehouse-v3').dataset.pocket).toBe('true');
    expect(browsing.page().scrollTop).toBe(240);
  });

  it('物资数字支持聚焦读取，浏览不修改档案或打开卡牌', async () => {
    browsing=await createBrowsingHarness();browsing.runtime.openBaseHub('stash');
    const before=JSON.stringify(browsing.base.data),page=browsing.page();
    const wood=browsing.host.querySelector('[data-resource-name="木材"]');
    expect(wood.tabIndex).toBe(0);expect(wood.getAttribute('aria-label')).toBe('木材 1');
    wood.focus();expect(document.activeElement).toBe(wood);
    expect(browsing.page()).toBe(page);expect(browsing.ui.showCardZoom).not.toHaveBeenCalled();
    expect(JSON.stringify(browsing.base.data)).toBe(before);
  });

  it('换档进入基地清除上一档的成功提示、滚动位置和来源焦点', async () => {
    browsing = await createBrowsingHarness();
    browsing.runtime.openBaseHub('shop');
    browsing.click('[data-act="tradeShopSelectGood"][data-key="wood"]');
    browsing.click('[data-act="tradeShopBuy"]');
    expect(browsing.base.purchase).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(browsing.host.querySelector('[role="status"]')?.textContent).toContain('购入木材'));
    browsing.scroll(320);
    browsing.runtime.closeBase();
    browsing.useSlot(2);
    browsing.runtime.openBaseHub('shop');

    expect(browsing.host.querySelector('.camp-notice').textContent).toBe('');
    expect(browsing.page().scrollTop).toBe(0);
    expect(browsing.host.querySelector('[data-act="tradeShopSelectGood"].is-selected').dataset.key).toBe('tt3-skewer');
    expect(browsing.base.data).toMatchObject({ coins: 100, wood: 1 });
  });
});
