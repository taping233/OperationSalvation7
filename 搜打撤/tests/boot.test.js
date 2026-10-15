/* 启动链冒烟测试：真实导入 src/main.js 并触发 DOMContentLoaded。
 * 回归目标：ESM 循环导入下模块体在顶层读 game 导致启动崩溃
 *（症状：标题页漏出局内下方控制栏 / 开始游戏·设置按钮无响应）。
 * jsdom 无 canvas/Audio/WebAudio，这里 stub 掉渲染与音频，只验启动接线。 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

// 单跑约 5s：全量并行负载下会越过 vitest 默认 5s 超时形成负载 flake，给足裕量。
// 60s（2026-10-03 第三次复发）：测试库增长使全量时长 117.6s（10-02 receipt）→134s，全库挤压下
// hideOverlay 的 210ms 收场 timer（overlay.js）实际延迟可超 15s，旧 20s 顶已不够；仅真卡死才等满。
vi.setConfig({ testTimeout: 60000, hookTimeout: 60000 });

// ---- 环境补桩（必须在动态 import main.js 之前就位） ----
// 2D 上下文：所有方法返回可链式/可读的哑值
// 故意恒真：jsdom 无 canvas，无论原生 getContext 是否存在都强制换成本桩（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
if (!window.HTMLCanvasElement.prototype.getContext || true) {
  const noopCtx = () => new Proxy(function () {}, {
    get: (_t, k) => {
      if (k === 'canvas') return null;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createPattern' || k === 'getImageData') return () => ({ addColorStop: () => {}, data: [] });
      return () => noopCtx();
    },
    set: () => true,
    apply: () => noopCtx(),
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return noopCtx(); };
}
// Audio 元素（sound.js 顶层 new Audio）
window.Audio = class FakeAudio {
  constructor() { this.loop = false; this.volume = 1; this.preload = ''; }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  load() {}
};
// WebAudio（sound.js 惰性创建，兜底防未定义）
window.AudioContext = window.AudioContext || class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} } }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0, setValueAtTime: () => {} } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
// fetch（boot 顶层拉 version.json，失败会走 .catch 分支，不影响启动）
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: '0.51.0' }) });

// 注入真实页面结构：读取 index.html，剥掉 script/link（模块由动态 import 接管）
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
{
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.head.innerHTML = '';
  document.body.innerHTML = body;
}

// 模块加载（DOMContentLoaded 已在 jsdom 环境建立时派发过，
// boot.js 的监听随后注册，故下方手动再派发一次触发启动链）
await import('../game/src/main.js');
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
// fetch .then 与 UI 初始化里的微任务需要清一轮
await new Promise(r => setTimeout(r, 0));

const waitFor = async (cond, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise(r => setTimeout(r, 20));
  }
  return cond();
};

describe('启动链（DOMContentLoaded → showTitle）', () => {
  it('启动完成后 body 挂上 lobby 类（局内控件在标题页隐藏）', () => {
    expect(document.body.classList.contains('lobby'), 'body 缺少 lobby 类').toBe(true);
  });
  it('标题封面处于显示状态', () => {
    const title = document.getElementById('title');
    expect(title).not.toBeNull();
    expect(title.hidden).toBe(false);
  });

  it('真实启动接线的 Ctrl+L 在四个控制台页签均可关闭，长按与输入法组合不重复切换', async () => {
    const { game } = await import('../game/src/run/game.session.js');
    const UI = window.SDT.UI;
    const previousState = game.state;
    const sourceAction = vi.fn();
    game.state = 'modal';
    UI.showOverlay('来源节点', '<section id="consoleSource"><button data-act="sourceAction">继续</button></section>', 'page');
    UI.act('sourceAction', sourceAction);
    // 整页 staged 揭幕的遮层会短暂阻断普通按键（Ctrl+L 在内）；等遮层退场再按。
    await waitFor(() => !document.querySelector('.page-visual-handoff'));
    const source = document.getElementById('consoleSource');
    const toggle = (options = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key:'l', ctrlKey:true, bubbles:true, cancelable:true, ...options }));
    for (const [index, tab] of ['debug', 'agent', 'data', 'keys'].entries()) {
      // 上一轮关闭会把来源页按 page 模式重开，同样产生 staged 遮层。
      await waitFor(() => !document.querySelector('.page-visual-handoff'));
      toggle();
      // 只有首次冷入口等待真实控件；缓存命中仍沿用后续即时业务断言。
      if (index === 0) await vi.waitFor(() => expect(document.querySelector('#devConsole [data-act="devcTab"]')).not.toBeNull());
      document.querySelector(`[data-act="devcTab"][data-tab="${tab}"]`).click();
      expect(document.querySelector('#devConsole')).not.toBeNull();
      toggle({ repeat:true }); toggle({ isComposing:true }); toggle({ keyCode:229 });
      expect(document.querySelector('#devConsole')).not.toBeNull();
      if (tab === 'debug') {
        const input = document.getElementById('devcSearch');
        const key = new KeyboardEvent('keydown', { key:'L', ctrlKey:true, bubbles:true, cancelable:true });
        input.dispatchEvent(key);
        expect(key.defaultPrevented).toBe(true);
      } else toggle({ key:'L' });
      expect(document.querySelector('#devConsole')).toBeNull();
      expect(document.getElementById('consoleSource')).toBe(source);
      expect(game.state).toBe('modal');
    }
    source.querySelector('button').click();
    expect(sourceAction).toHaveBeenCalledOnce();
    UI.hideOverlay();
    await waitFor(() => document.getElementById('overlay').hidden);
    game.state = previousState;
  });

  it('基地首次打开的真实 Escape 接线只取消待开请求，不重置已保存档案', async () => {
    const hub = await import('../game/src/hub/game.hub.js');
    const { game } = await import('../game/src/run/game.session.js');
    document.getElementById('mStart').click();
    await waitFor(() => document.querySelector('.slot-page'));
    document.querySelector('[data-act="newSlot"][data-slot="5"]').click();
    const savedBase = window.SDT.Base.peek(5);
    expect(hub.baseHubLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(hub.baseHubLoading).toBe(false);
    expect(await waitFor(() => document.querySelector('.slot-page') && document.getElementById('slotRestoreError')?.textContent.includes('基地尚未打开'))).toBe(true);
    expect(document.getElementById('hubMain')).toBeNull();
    expect(window.SDT.Base.peek(5)).toEqual(savedBase);
    expect(document.querySelector('.page-loading')).toBeNull();
    document.querySelector('[data-act="slotBack"]').click();
    await waitFor(() => game.state === 'title');
    await waitFor(() => document.getElementById('overlay').hidden);
  });

  it('照相馆动态载入可被快捷切页或真实 Escape 取消并恢复来源页状态', async () => {
    const cardsLib = await import('../game/src/hub/game.cardslib.js');
    const { game } = await import('../game/src/run/game.session.js');
    expect(document.getElementById('overlay').hidden).toBe(true);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true, bubbles: true }));
    await waitFor(() => document.querySelector('.slot-page'));
    document.querySelector('[data-act="enterSlot"][data-slot="5"]').click();
    await waitFor(() => document.getElementById('hubMain'));
    expect(game.state).toBe('modal');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', altKey: true, bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true, bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(false);
    expect(cardsLib.cardPageOpen).toBe(true);
    expect(document.getElementById('hubMain')).not.toBeNull();
    await waitFor(() => document.querySelector('#hubMain[data-page="stash"]'));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', altKey: true, bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', altKey: true, bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(false);
    expect(cardsLib.cardPageOpen).toBe(true);
    expect(game.state).toBe('modal');
    await new Promise(r => setTimeout(r, 30));
    expect(document.querySelector('.card-library-page')).toBeNull();
    document.querySelector('#hubMain [data-act="hubHome"]').click();
    expect(document.querySelector('#hubMain [data-act="closeBase"]')).not.toBeNull();
    document.querySelector('#hubMain [data-act="closeBase"]').click();
    expect(await waitFor(() => document.querySelector('.slot-page'))).toBeTruthy();
    document.querySelector('.slot-page [data-act="slotBack"]').click();
    expect(await waitFor(() => game.state === 'title')).toBe(true);
    await waitFor(() => document.getElementById('overlay').hidden);

    document.getElementById('btnCardLib').click();
    expect(cardsLib.cardPageLoading).toBe(true);
    expect(game.state).toBe('title');
    document.getElementById('btnCardLib').click();
    expect(cardsLib.cardPageLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(false);
    expect(cardsLib.cardPageOpen).toBe(false);
    expect(game.state).toBe('title');
    await new Promise(r => setTimeout(r, 30));
    expect(document.querySelector('.card-library-page')).toBeNull();
    expect(document.getElementById('overlay').hidden).toBe(true);
  });

  it('标题→选档→基地→选档往返保留档案，按钮与 Escape 语义一致', async () => {
    const { game, getActiveSlot } = await import('../game/src/run/game.session.js');
    document.getElementById('mStart').click();
    await waitFor(() => document.querySelector('.slot-page'));
    expect(document.querySelector('.slot-page')).not.toBeNull();

    document.querySelector('[data-act="newSlot"][data-slot="1"]').click();
    await waitFor(() => document.getElementById('hubMain'));
    expect(game.state).toBe('modal');
    expect(document.querySelector('.hub-head .help-btn')).toBeNull();
    const baseBefore = window.SDT.Base.peek(1);

    document.querySelector('#hubMain [data-act="closeBase"]').click();
    await waitFor(() => document.querySelector('.slot-page'));
    expect(getActiveSlot()).toBe(1);
    expect(window.SDT.Base.peek(1)).toEqual(baseBefore);
    expect(document.querySelector('[data-act="enterSlot"][data-slot="1"]')).not.toBeNull();

    document.querySelector('[data-act="enterSlot"][data-slot="1"]').click();
    await waitFor(() => document.getElementById('hubMain'));
    document.querySelector('#hubMain [data-act="hubTab"][data-tab="stash"]').click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await waitFor(() => document.querySelector('.slot-page'));
    expect(getActiveSlot()).toBe(1);
    expect(window.SDT.Base.peek(1)).toEqual(baseBefore);
    document.querySelector('[data-act="slotBack"]').click();
    await waitFor(() => game.state === 'title');
    await waitFor(() => document.getElementById('overlay').hidden);
  });

  it('卡牌档案馆可打开、筛选、清空与排序', { timeout: 15_000 }, async () => {
    const originalSfx = window.SDT.Sound.sfx;
    window.SDT.Sound.sfx = () => {};
    document.getElementById('btnCardLib').click();
    await waitFor(() => document.querySelector('.page-loading'));
    expect(document.querySelector('.card-library-page')).toBeNull();
    await waitFor(() => document.querySelector('.card-library-page'));
    await waitFor(() => !document.querySelector('.page-loading'));
    const page = document.querySelector('.card-library-page');
    expect(page).not.toBeNull();
    expect(document.getElementById('libResultCount')).not.toBeNull();
    // The first window can mount after selection caching; moving on must clear its marker.
    const firstSelected = document.querySelector('#libGrid .lib-cardwrap[aria-current="true"]').dataset.card;
    HTMLElement.prototype.scrollIntoView ||= () => {}; // Navigation scrolls the destination tile's outer shell; jsdom has no scrolling API.
    document.querySelector('#libPreview [data-act="libNext"]').click();
    const selectedCards = [...document.querySelectorAll('#libGrid .lib-cardwrap[aria-current="true"]')];
    expect(selectedCards).toHaveLength(1);
    expect(selectedCards[0].dataset.card).not.toBe(firstSelected);
    const search = document.getElementById('cardSearch');
    search.value = '不存在的卡牌';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(document.querySelector('.clib-empty')).not.toBeNull();
    expect(document.querySelector('#libPreview .studio-preview-empty')).not.toBeNull();
    document.querySelector('[data-act="libClearFilter"]').click();
    expect(document.querySelector('.lib-grid')).not.toBeNull();
    expect(document.querySelector('#libPreview .studio-preview-copy')).not.toBeNull();
    const sort = document.getElementById('libSort');
    // 选中一张换序后会移动位置的卡，确保筛选台在 ID 不变时仍重算序号和导航状态。
    const cards = window.SDT.Cards.all();
    const byId = new Map(cards.map(card => [card.id, card]));
    const rarityOrder = [...document.querySelectorAll('#libGrid .lib-cardwrap')].map(node => node.dataset.card);
    const nameOrder = [...rarityOrder].sort((a, b) => String(byId.get(a)?.name || '').localeCompare(String(byId.get(b)?.name || ''), 'zh'));
    const selectedId = rarityOrder.find((id, i) => nameOrder.indexOf(id) !== i);
    expect(selectedId).toBeTruthy();
    const selectedNode = document.querySelector(`#libGrid .lib-cardwrap[data-card="${selectedId}"]`);
    selectedNode.focus();
    const oldPosition = document.querySelector('#libPreview .pv-pos').textContent;
    sort.value = 'name';
    sort.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sort.value).toBe('name');
    expect(document.querySelector('#libPreview .pv-pos').textContent).not.toBe(oldPosition);
    expect(document.querySelector('#libPreview .pv-pos').textContent).toBe(`${nameOrder.indexOf(selectedId) + 1} / ${nameOrder.length}`);

    search.value = byId.get(selectedId).name;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    const selectedTile = document.querySelector(`#libGrid .lib-cardwrap[data-card="${selectedId}"]`);
    const selectedIndex = Number(selectedTile.closest('.lib-item').dataset.i);
    const filteredCount = Number(document.getElementById('libResultCount').textContent);
    expect(document.querySelector('#libPreview .pv-pos').textContent).toBe(`${selectedIndex + 1} / ${filteredCount}`);
    expect(document.querySelector('#libPreview [data-act="libPrev"]').disabled).toBe(selectedIndex === 0);
    expect(document.querySelector('#libPreview [data-act="libNext"]').disabled).toBe(selectedIndex === filteredCount - 1);
    document.querySelector('[data-act="libClearFilter"]').click();
    window.SDT.Sound.sfx = originalSfx;
  });

  it('照相馆以照片背签打开，默认大图仍用卡牌面且保留 footer 委托', async () => {
    const originalSfx = window.SDT.Sound.sfx;
    window.SDT.Sound.sfx = () => {};
    const card = document.querySelector('#libGrid .lib-cardwrap');
    expect(card).not.toBeNull();
    const sourcePaper = card.querySelector('.studio-photo-paper');
    const originalUiRect = window.SDT.UiScale.rect;
    const originalClientRects = Element.prototype.getClientRects;
    const sourceBox = { left: 80, top: 90, width: 120, height: 160 };
    const targetBox = { left: 300, top: 160, width: 620, height: 500 };
    const rect = box => ({ ...box, right: box.left + box.width, bottom: box.top + box.height });
    sourcePaper.getBoundingClientRect = () => rect(sourceBox);
    window.SDT.UiScale.rect = node => node.classList?.contains('cz-photo-paper')
      ? rect(targetBox)
      : node.classList?.contains('studio-photo-paper') ? rect(sourceBox) : originalUiRect(node);
    Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    card.focus();
    card.click();
    const photoZoom = document.getElementById('cardZoom');
    expect(photoZoom?.classList.contains('cz-photo')).toBe(true);
    expect(photoZoom.querySelector('.cz-photo-image img')).not.toBeNull();
    expect(photoZoom.querySelector('.cz-photo-rules')).not.toBeNull();
    expect(photoZoom.querySelector('.cz-card')).toBeNull();
    expect(photoZoom.style.getPropertyValue('--cz-photo-from-transform')).toContain('translate(');
    const photoNote = photoZoom.querySelector('.cz-note-input');
    expect(photoNote.maxLength).toBe(240);
    photoNote.value = '测试照片背签';
    photoNote.dispatchEvent(new Event('input', { bubbles: true }));
    photoZoom.querySelector('.cz-note').click();
    expect(document.getElementById('cardZoom')).toBe(photoZoom);
    // 存档写入是异步 storage 操作：全量负载下 260ms 固定等待会撞「保存中…」（门禁两次抖动），
    // 按项目药方改为条件等待（有上限），条件满足即返回。
    await waitFor(() => photoZoom.querySelector('.cz-note-status').textContent === '已存档', 3000);
    expect(photoZoom.querySelector('.cz-note-status').textContent).toBe('已存档');
    expect(document.querySelector('#libPreview .pv-note')?.textContent).toContain('测试照片背签');
    photoNote.value = '';
    photoNote.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => photoZoom.querySelector('.cz-note-status').textContent === '尚未撰写', 3000);
    const { photoNoteFor } = await import('../game/src/cards/card-photo-notes.js');
    const selectedCard = window.SDT.Cards.all().find(c => c.id === card.dataset.card);
    const restoredNote = photoNoteFor(selectedCard);
    expect(document.querySelector('#libPreview .pv-note')?.textContent || '').toBe(restoredNote ? `备注${restoredNote}` : '');
    document.querySelector('#cardZoom .cz-backdrop').click();
    expect(photoZoom.classList.contains('cz-photo-closing-to-source')).toBe(true);
    expect(photoZoom.style.getPropertyValue('--cz-photo-to-transform')).toContain('translate(');
    expect(document.getElementById('overlay').inert).toBe(true);
    expect(photoZoom.querySelector('.cz-note-status').textContent).toBe('尚未撰写');
    await new Promise(r => setTimeout(r, 400));
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(document.getElementById('overlay').inert).toBe(false);
    expect(document.activeElement).toBe(card);
    window.SDT.UiScale.rect = originalUiRect;
    Element.prototype.getClientRects = originalClientRects;

    // Reopening while a photo is reversing cancels that pending removal immediately.
    card.click();
    const reversingPhoto = document.getElementById('cardZoom');
    reversingPhoto.querySelector('.cz-backdrop').click();
    let footerCalled = 0;
    window.SDT.UI.act('zoomTestFooter', () => { footerCalled += 1; });
    window.SDT.UI.showCardZoom(window.SDT.Cards.all()[0], {
      footer: '<button type="button" data-act="zoomTestFooter">测试</button>',
    });
    const defaultZoom = document.getElementById('cardZoom');
    expect(reversingPhoto.isConnected).toBe(false);
    expect(defaultZoom.querySelector('.cz-card .hs-card')).not.toBeNull();
    expect(defaultZoom.querySelector('.cz-photo-layout')).toBeNull();
    defaultZoom.querySelector('.cz-foot [data-act="zoomTestFooter"]').click();
    expect(footerCalled).toBe(1);
    expect(document.getElementById('cardZoom')).toBe(defaultZoom);
    defaultZoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    expect(document.getElementById('cardZoom')).toBe(defaultZoom);
    defaultZoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 270));
    document.querySelector('.card-library-page [data-act="closeCardPage"]').click();
    await new Promise(r => setTimeout(r, 230));
    expect(document.getElementById('overlay').hidden).toBe(true);
    window.SDT.Sound.sfx = originalSfx;
  });
  it('开始游戏 / 设置 / 退出按钮已绑定监听（可点击响应）', () => {
    // getEventListeners 不可用，用行为代理：点击 mSettings 应弹出设置 overlay（不再 hidden）
    document.getElementById('mSettings').click();
    const overlay = document.getElementById('overlay');
    expect(overlay.hidden, '点击设置后 overlay 应打开').toBe(false);
    document.getElementById('settingsBack')?.click();
  });
  it('跨文件 mixin 已延迟绑定（TDZ 回归点）', () => {
    const g = window.SDT.game;
    expect(typeof g.grantCard).toBe('function');      // bindRunMixins
    expect(typeof g.onBattleEnd).toBe('function');    // bindBagMixins
    expect(g.TYPE_NAME && typeof g.TYPE_NAME.coin).toBe('string'); // bindNotesMixins
    expect(typeof g.debug.openShop).toBe('function'); // boot 调试入口
  });
  it('成就陈列室按整页暂停背景，并完成退场后返回标题', async () => {
    document.getElementById('mAch').click();
    const overlay = document.getElementById('overlay');
    expect(overlay.querySelector('.achievement-gallery')).not.toBeNull();
    expect(overlay.querySelector('.card').classList.contains('page')).toBe(true);
    expect(document.body.classList.contains('page-covered')).toBe(true);
    overlay.querySelector('[data-act="achBack"]').click();
    expect(overlay.hidden).toBe(false);
    expect(overlay.classList.contains('closing')).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 240));
    expect(overlay.hidden).toBe(true);
    expect(window.SDT.game.state).toBe('title');
  });
  it('核心模块已发布，战斗域按需加载后发布', async () => {
    for (const k of ['RULES', 'MAP', 'Art', 'Icons', 'Sound', 'Camera', 'Notes', 'Cards', 'Base', 'Meta', 'RenderScheduler', 'Renderer', 'UI', 'Chests']) {
      expect(window.SDT[k], `window.SDT.${k} 未发布`).toBeTruthy();
    }
    const { ensureBattleReady } = await import('../game/src/battle/battle-loader.js');
    await ensureBattleReady();
    expect(window.SDT.Battle, 'window.SDT.Battle 按需加载后未发布').toBeTruthy();
    expect(typeof window.SDT.Battle.getSnapshot).toBe('function');
    expect(Object.isFrozen(window.SDT.Battle)).toBe(true);
    for (const command of ['playCard', 'selectInfusion', 'confirmInfusion', 'cancelInfusion', 'endTurn', 'flee', 'openGrave', 'closeGrave', 'selectDeckCard', 'confirmDeck', 'cancelDeck', 'cancelPendingTarget']) {
      expect(typeof window.SDT.Battle.commands[command], `Battle.commands.${command} 未发布`).toBe('function');
    }
  });
  // 骰子 UI 的两个落定测试已随骰子系统整体移除一并退役（2026-09-19 老板定向）。

  it('运行时按 mapSeed 重建局部几何，并以稳定节点提交移动事务', async () => {
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
    const game = session.game;
    session.buildDerived('integration-map-seed');
    expect(game.mapSeed).toBe('integration-map-seed');
    expect(game.generatorVersion).toBeTruthy();
    expect(game.layoutVersion).toBeTruthy();
    expect(game.geometryVersion).toContain('integration-map-seed');
    expect(game.layerBounds).toHaveLength(4);
    for (const [li, layer] of game.layerData.entries()) {
      const positions = game.nodePos[li];
      for (const [nodeIdx, node] of layer.logical.entries()) {
        for (const [toLi, toIdx] of node.next) {
          if (toLi !== li) continue;
          const a = positions[nodeIdx], b = game.nodePos[toLi][toIdx];
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBe(180);
        }
      }
    }

    const li = 0;
    const start = game.layerData[li].entrances[0];
    const edge = game.layerData[li].logical[start].next.find(([toLi]) => toLi === li);
    expect(edge).toBeTruthy();
    game.layerIdx = li; game.trackPos = start; game.pos = session.cellCenter(li, start);
    game.state = 'idle'; game.moveTarget = null;
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(run.moveTo(edge[0], edge[1])).toBe(true);
    expect(game.state).not.toBe('moving');
    expect([game.layerIdx, game.trackPos]).toEqual(edge);
    expect(game.pos).toEqual(session.cellCenter(edge[0], edge[1]));
    localStorage.removeItem('sdt-reduce-motion');
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('地图首次点击只预览，再次点击同节点才开始移动', async () => {
    const session = await import('../game/src/run/game.session.js');
    const { getExpeditionPreview } = await import('../game/src/run/expedition.view.js');
    const game = session.game;
    const wasRunActive = game.runActive;
    session.buildDerived('map-two-click-seed');
    const start = game.layerData[0].entrances[0];
    game.layerIdx = 0; game.trackPos = start; game.pos = session.cellCenter(0, start);
    game.state = 'idle'; game.moveTarget = null; game.runActive = true;
    session.enterLayer(0, start);
    const [, next] = game.layerData[0].logical[start].next.find(([li]) => li === 0);
    game.visited ||= {};
    const wasVisited = game.visited['0,' + next];
    game.visited['0,' + next] = 1;
    const node = session.cellCenter(0, next);
    const rect = vi.spyOn(session.canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 3000, bottom: 3000, width: 3000, height: 3000 });
    const originalRaf = globalThis.requestAnimationFrame;
    const callbacks = [];
    globalThis.requestAnimationFrame = callback => { callbacks.push(callback); return callbacks.length; };
    localStorage.removeItem('sdt-reduce-motion');
    const clickNode = () => {
      const point = session.cam.worldToScreen(node.x, node.y);
      for (const type of ['pointerdown', 'pointerup']) {
        const event = new MouseEvent(type, { clientX: point.x, clientY: point.y, button: 0, bubbles: true, cancelable: true });
        Object.defineProperty(event, 'pointerId', { value: 1 });
        session.canvas.dispatchEvent(event);
      }
    };
    try {
      clickNode();
      expect(game.state).toBe('idle');
      expect(game.trackPos).toBe(start);
      expect(getExpeditionPreview(game)).toMatchObject({ li: 0, idx: next });
      expect(game.moveTarget).toMatchObject({ li: 0, idx: next });
      expect(document.querySelector('.expedition-map-preview').hidden).toBe(false);
      clickNode();
      expect(game.state).toBe('moving');
      expect(getExpeditionPreview(game)).toBeNull();
    } finally {
      if (game.state === 'moving') callbacks.at(-1)?.(performance.now() + 400);
      rect.mockRestore();
      globalThis.requestAnimationFrame = originalRaf;
      game.moveTarget = null;
      if (wasVisited === undefined) delete game.visited['0,' + next];
      else game.visited['0,' + next] = wasVisited;
      game.runActive = wasRunActive;
      game.state = 'title';
    }
  });

  it('非 reduced-motion 的 fake rAF 移动最终只提交一次', async () => {
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
    const game = session.game;
    session.buildDerived('async-move-seed');
    const li = 0;
    const start = game.layerData[li].entrances[0];
    const edge = game.layerData[li].logical[start].next.find(([toLi]) => toLi === li);
    expect(edge).toBeTruthy();
    game.layerIdx = li; game.trackPos = start; game.pos = session.cellCenter(li, start);
    game.state = 'idle'; game.moveTarget = null; game.turn = 1;
    localStorage.removeItem('sdt-reduce-motion');

    const originalRaf = globalThis.requestAnimationFrame;
    const callbacks = [];
    globalThis.requestAnimationFrame = (callback) => { callbacks.push(callback); return callbacks.length; };
    try {
      expect(run.moveTo(edge[0], edge[1])).toBe(true);
      expect(game.state).toBe('moving');
      const tick = callbacks.at(-1);
      expect(typeof tick).toBe('function');
      const now = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) + 600;
      tick(now);
      // 路线时钟走满后先进入 100ms 抵达反馈（光环淡出），移动锁保持到反馈结束。
      expect(game.state).toBe('moving');
      expect([game.layerIdx, game.trackPos]).toEqual(edge);
      const settle = callbacks.at(-1);
      settle(now + 200);
      expect(game.state).not.toBe('moving');
      expect(game.turn).toBe(2);
      // 重复调用同一个已完成帧回调不得再次结算。
      tick(now + 600);
      settle(now + 600);
      expect(game.turn).toBe(2);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      localStorage.removeItem('sdt-reduce-motion');
      document.getElementById('overlay')?.setAttribute('hidden', '');
      game.state = 'title';
    }
  });

  it('第一层 door 确认后进入第二层，终层仍保留 extraction', async () => {
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
    const game = session.game;
    session.buildDerived('door-transition-seed');
    const door = game.layerData[0].doors[0];
    const from = game.layerData[0].logical.findIndex(cell =>
      cell.next.some(([toLi, toIdx]) => toLi === 0 && toIdx === door.at));
    expect(from).toBeGreaterThanOrEqual(0);
    game.layerIdx = 0; game.trackPos = from; game.pos = session.cellCenter(0, from);
    game.state = 'idle'; game.moveTarget = null;
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(run.moveTo(0, door.at)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 950));
    const goDoor = document.querySelector('#ovBody [data-act="goDoor"]');
    expect(goDoor).not.toBeNull();
    goDoor.click();
    expect(game.layerIdx).toBe(door.toLayer);
    expect(game.trackPos).toBe(door.arriveAt);
    expect(game.state).toBe('idle');
    expect(game.layerData[3].logical[game.layerData[3].exit].def.type).toBe('extraction');
    localStorage.removeItem('sdt-reduce-motion');
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('enterLayer 将入口与可走分支一起构图，隐藏节点不占据画面', async () => {
    const session = await import('../game/src/run/game.session.js');
    const game = session.game;
    const camera = session.cam;
    session.buildDerived('fit-layer-seed');
    camera.resize(800, 600);
    const li = 3;
    const at = game.layerData[li].entrances[0];
    session.enterLayer(li, at);
    expect(game.activeLayerBounds).toEqual(game.layerBounds[li]);
    expect(camera.frameExploration).toBeTypeOf('function');
    // Brush-map framing intentionally enlarges the current decision (2026-10-15 map-brush).
    // All route centres stay visible, their span fits the decision area, and fogged
    // remote nodes must not dilute it; a fixed 70px inset is no longer the contract.
    expect(camera.frameMode).toBe('routes');
    const indices = [at, ...game.layerData[li].logical[at].next.filter(([nl]) => nl === li).map(([, idx]) => idx)];
    const screens = indices.map(idx => {
      const p = game.nodePos[li][idx];
      const screen = camera.worldToScreen(p.x, p.y);
      expect(screen.x).toBeGreaterThan(0);
      expect(screen.x).toBeLessThan(camera.viewW - (camera.detailInset || 0));
      expect(screen.y).toBeGreaterThan(0);
      expect(screen.y).toBeLessThan(camera.viewH);
      return screen;
    });
    expect(Math.max(...screens.map(p => p.x)) - Math.min(...screens.map(p => p.x)))
      .toBeLessThanOrEqual((camera.viewW - (camera.detailInset || 0)) * .80);
    expect(Math.max(...screens.map(p => p.y)) - Math.min(...screens.map(p => p.y)))
      .toBeLessThanOrEqual((camera.viewH - 70) * .90);
    const remote = game.nodePos[li].findIndex((_, idx) => !indices.includes(idx));
    expect(remote).toBeGreaterThanOrEqual(0);
    const original = game.nodePos[li][remote];
    const framing = { cx: camera.cx, cy: camera.cy, zoom: camera.zoom };
    try {
      game.nodePos[li][remote] = { x: 1e6, y: 1e6 };
      camera.frameExploration(game);
      expect({ cx: camera.cx, cy: camera.cy, zoom: camera.zoom }).toEqual(framing);
    } finally { game.nodePos[li][remote] = original; }
    game.state = 'title';
  });

  it('战斗数字键/点选与内层卡面键盘输入共享选中、取消和目标结算', { timeout: 15_000 }, async () => {
    await (await import('../game/src/battle/battle-loader.js')).ensureBattleReady();
    const sha = window.SDT.Cards.all().find(c => c.id === 'starter-attack');
    const game = {
      ownedCards: [{ uid: 'boot-click-sha', card: sha },
        { uid: 'boot-blocked', card: { ...sha, id: 'boot-expensive', cost: 99 } }], hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 0,
      myClass: '战士', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
    };
    const foes = [{ id: 'infantry', name: '第一目标', hp: 40, maxHp: 40, atk: 1 },
      { id: 'infantry', name: '第二目标', hp: 20, maxHp: 20, atk: 1 }];
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    try {
      window.SDT.Battle.start(game, foes, { isBoss: false, name: '输入回归' });
      await waitFor(() => document.querySelector('.sts-hand .bt-card[data-uid="boot-click-sha"]'));
      const card = document.querySelector('.sts-hand .bt-card[data-uid="boot-click-sha"]');
      const face = card.querySelector('.hs-card');
      expect(card.getAttribute('role')).toBe('group');
      expect(card.tabIndex).toBe(-1);
      expect(face.getAttribute('role')).toBe('button');
      expect(face.tabIndex).toBe(0);
      expect(face.getAttribute('aria-disabled')).toBe('false');
      const blocked = document.querySelector('.sts-hand .bt-card[data-uid="boot-blocked"]');
      expect(blocked.dataset.blockReason).toContain('能量不足');
      expect(blocked.querySelector('.hs-card').getAttribute('aria-disabled')).toBe('true');
      const before = window.SDT.Battle.getSnapshot();
      const key = (target, value, extra = {}) => {
        const event = new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...extra });
        target.dispatchEvent(event); return event;
      };
      const expectUnspent = () => {
        const snap = window.SDT.Battle.getSnapshot();
        expect(snap.energy).toBe(before.energy);
        expect(snap.foes.map(f => f.hp)).toEqual(before.foes.map(f => f.hp));
        expect(snap.hand.includes(card.dataset.uid)).toBe(true);
      };
      key(document, card.dataset.handIndex, { isComposing: true });
      expect(card.classList.contains('click-selected')).toBe(false);
      key(document, card.dataset.handIndex);
      expect(card.classList.contains('click-selected')).toBe(true);
      expect(face.getAttribute('aria-pressed')).toBe('true');
      expectUnspent();
      const playAction = window.SDT.UI._acts.btPlay;
      expect(typeof playAction).toBe('function');
      key(document, 'Escape', { isComposing: true });
      key(document, 'Escape', { keyCode: 229 });
      expect(window.SDT.UI._acts.btPlay).toBe(playAction);
      expect(document.getElementById('overlay').hidden).toBe(false);
      expect(card.classList.contains('click-selected')).toBe(true);
      expect(key(document, 'Escape').defaultPrevented).toBe(true);
      expect(face.getAttribute('aria-pressed')).toBe('false');
      // Shift+Enter remains an explicit inspector shortcut; normal play needs no inspector button.
      key(face, 'Enter', { shiftKey: true });
      expect(document.querySelector('.bt-hand-detail')).not.toBeNull();
      expectUnspent();
      key(document, 'Escape');
      card.click();
      expect(card.classList.contains('click-selected')).toBe(true);
      expect(document.querySelector('.bt-hand-detail')).toBeNull();
      expectUnspent();
      key(document, 'Escape');
      expect(key(face, ' ').defaultPrevented).toBe(true);
      expect(face.getAttribute('aria-pressed')).toBe('true');
      expectUnspent();
      const enemy = document.querySelector('.sts-foe[data-eidx="0"]');
      expect(enemy.getAttribute('role')).toBe('button');
      expect(enemy.tabIndex).toBe(0);
      key(enemy, 'Enter');
      await waitFor(() => window.SDT.Battle.getSnapshot().foes[0].hp < before.foes[0].hp);
      const after = window.SDT.Battle.getSnapshot();
      expect(after.foes[1].hp).toBe(before.foes[1].hp);
      expect(after.energy).toBeLessThan(before.energy);
      expect(after.hand.includes('boot-click-sha')).toBe(false);
    } finally {
      if (game.battleActive) window.SDT.Battle.commands.flee();
      Element.prototype.animate = oldAnimate;
      document.getElementById('overlay')?.setAttribute('hidden', '');
      game.state = 'title';
    }
  });

  it('唯一敌人也需确认目标；键盘选中可取消且确认前不扣资源', async () => {
    await (await import('../game/src/battle/battle-loader.js')).ensureBattleReady();
    const sha = window.SDT.Cards.all().find(c => c.id === 'starter-attack');
    const game = {
      ownedCards: [{ uid: 'boot-single-sha', card: sha }], hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 0,
      myClass: '战士', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
    };
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    try {
      window.SDT.Battle.start(game, [{ id: 'infantry', name: '唯一敌', hp: 40, maxHp: 40, atk: 1 }], { isBoss: false, name: '单敌输入' });
      await waitFor(() => document.querySelector('.sts-hand .bt-card.need-target'));
      const card = document.querySelector('.sts-hand .bt-card.need-target');
      const face = card.querySelector('.hs-card');
      const before = window.SDT.Battle.getSnapshot();
      face.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(face.getAttribute('aria-pressed')).toBe('true');
      expect(window.SDT.Battle.getSnapshot().foes[0].hp).toBe(40);
      expect(window.SDT.Battle.getSnapshot().energy).toBe(before.energy);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      expect(face.getAttribute('aria-pressed')).toBe('false');
      expect(window.SDT.Battle.getSnapshot().hand.includes('boot-single-sha')).toBe(true);
      card.click();
      expect(document.querySelector('.bt-hand-detail')).toBeNull();
      expect(card.classList.contains('click-selected')).toBe(true);
      expect(window.SDT.Battle.getSnapshot().foes[0].hp).toBe(before.foes[0].hp);
      expect(window.SDT.Battle.getSnapshot().energy).toBe(before.energy);
      document.querySelector('.sts-foe[data-eidx="0"]').click();
      await waitFor(() => window.SDT.Battle.getSnapshot().foes[0].hp < before.foes[0].hp);
      expect(window.SDT.Battle.getSnapshot().energy).toBeLessThan(before.energy);
      expect(window.SDT.Battle.getSnapshot().hand.includes('boot-single-sha')).toBe(false);
    } finally {
      if (game.battleActive) window.SDT.Battle.commands.flee();
      Element.prototype.animate = oldAnimate;
      document.getElementById('overlay')?.setAttribute('hidden', '');
      game.state = 'title';
    }
  });

  // IME 家族守卫（game.boot.js 两处 Esc 分支）：中文输入法组合态按 Esc 是取消候选词，
  // 不得误关卡牌大页 / 不得打断加载态强关逻辑。定式对齐 ui.js:79。
  // 真实 timer 等待 + 满载并发下 15s 会抖（10-03 冻结门实测两红两绿）；放宽到 30s 上限，断言本身不变。
  // 60s（10-03 第三次复发）：测试库增长后 30s 已可被「前段开页等待 + 45s 收场窗口」合法耗尽
  //（连红四轮：三轮 AssertionError + 一轮 TimeoutError）；用例级须与文件级 60s 对齐，
  // 否则用例级优先压过 setConfig，下方 45s waitFor 永远等不满。
  it('卡牌大页 Esc 关闭与加载态强关：输入法组合态（isComposing / keyCode 229）不误触', { timeout: 60_000 }, async () => {
    const cardsLib = await import('../game/src/hub/game.cardslib.js');
    const { game } = await import('../game/src/run/game.session.js');
    game.state = 'title';
    const overlay = document.getElementById('overlay');

    // 大页打开（btnCardLib → 加载完成 → cardPageOpen 且 overlay 可见）
    document.getElementById('btnCardLib').click();
    await waitFor(() => document.querySelector('.card-library-page'), 15000);
    expect(cardsLib.cardPageOpen).toBe(true);
    expect(cardsLib.cardPageLoading).toBe(false);
    expect(overlay.hidden).toBe(false);

    // 玩家真实漏网链：焦点在卡牌库搜索框（INPUT）里打中文，按 Esc 取候选词。
    // 焦点守卫（boot.js:158）令 moveCancel 不触发，Esc 只由大页关闭分支（boot.js:257）响应。
    const search = document.getElementById('cardSearch');
    expect(search).not.toBeNull();
    search.focus();

    // ① 组合态 Esc（isComposing=true）：大页不关
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    expect(cardsLib.cardPageOpen).toBe(true);
    expect(document.querySelector('.card-library-page')).not.toBeNull();

    // ③ keyCode=229 合成：同样不关
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, keyCode: 229 }));
    expect(cardsLib.cardPageOpen).toBe(true);
    expect(document.querySelector('.card-library-page')).not.toBeNull();

    // ② 非组合态普通 Esc：照常关闭（非 IME 场景行为不变；关闭带收场动画，用条件等待。
    // overlay.hidden 必须并入 waitFor 条件——「大页 DOM 消失」与「overlay 收尾」非同拍，
    // 分步同步断言在全量并发负载下有竞态缝（01:14 批次②全量实锤一例））
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cardsLib.cardPageOpen).toBe(false);
    // 45000ms 窗口：waitFor 绿跑时条件成立即返回（零成本），仅真卡死才等满——
    // 全量并发负载下本文件单测可慢 3-5 倍，3000ms 曾两次假红（批次②/③实锤）；
    // 15000 第三次复发（10-03 全量连红三轮，单跑恒绿）：断言条件绑定 hideOverlay 的
    // 210ms 收场 timer（overlay.js finish 置 hidden），全库挤压下 timer 饥饿可迟至 15s+。
    await waitFor(() => !document.querySelector('.card-library-page') && overlay.hidden, 45000);
    expect(overlay.hidden).toBe(true);

    // 加载态分支（boot.js 152）同族守卫：组合态 Esc 不强关、不打断加载
    document.getElementById('btnCardLib').click();
    expect(cardsLib.cardPageLoading).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, keyCode: 229 }));
    expect(cardsLib.cardPageLoading).toBe(true);
    expect(cardsLib.cardPageOpen).toBe(true);
    // 非组合态照旧强关（现状语义保持）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cardsLib.cardPageLoading).toBe(false);
    expect(cardsLib.cardPageOpen).toBe(false);
    await waitFor(() => !document.querySelector('.card-library-page') && overlay.hidden, 3000);
  });
});
