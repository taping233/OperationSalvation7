// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const game = { state: 'title', devMode: false };
vi.mock('../game/src/run/game.session.js', () => ({ game }));

async function setup(catalog = null, { curtain = false } = {}) {
  vi.resetModules();
  vi.useFakeTimers();
  game.state = 'title'; game.devMode = false;
  const frames = [], observers = [], acts = {};
  vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this); }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.disconnected = true; this.targets.clear(); }
  });
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  document.body.className = '';
  if (curtain) document.body.insertAdjacentHTML('beforeend', '<div class="page-loading page-loading--city"></div>');
  const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
  const cards = catalog || Array.from({ length: 140 }, (_, i) => ({ id: `fixture-${i}`, name: `照片${i}`, type: '法术', rarity: '古朴', desc: `合成说明${i}`, cost: 1 }));
  const UI = {
    _acts: acts,
    el: { overlay, ovBody: body },
    act: (name, callback) => { acts[name] = callback; },
    showOverlay(title, html, mode) { body.innerHTML = html; overlay.hidden = false; document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode })); },
    hideOverlay: vi.fn(() => { document.dispatchEvent(new CustomEvent('sdt-overlay-close')); overlay.hidden = true; }),
    showCardZoom: vi.fn(), refresh: vi.fn(), log: vi.fn(),
  };
  window.SDT = { UI, Base: { slot: 1 }, Sound: { sfx: vi.fn() }, Icons: { img: () => '', rich: value => value }, Art: { cardIcon: card => `<img data-lib-src="/${card.id}.png" alt="">` }, Cards: {
    all: () => cards, RARITIES: ['古朴', '稀有', '棱彩'], TYPES: ['法术', '道具'], DMG_TYPES: ['法术'], DMG_TYPE_META: {}, TYPE_ART: {},
    deriveDraw: () => 0, deriveInfuse: () => 0, deriveHeal: () => 0, deriveArmor: () => 0, rarityOf: card => card.rarity,
  } };
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const page = await import('../game/src/hub/game.cardslib.page.js');
  page.openCardLibrary();
  return { page, UI, cards, acts, frames, observers, body, overlay };
}

afterEach(() => { document.dispatchEvent(new CustomEvent('sdt-overlay-close')); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); document.body.className = ''; });

describe('照相馆真实实现生命周期回归', () => {
  it('过场期间只挂首窗，过场结束才恢复远处瓦片与分批壳', async () => {
    const { page, frames, observers } = await setup(null, { curtain:true });
    const root = document.querySelector('.card-library-page');
    const grid = document.getElementById('libGrid');
    const initial = grid.children.length;
    frames.splice(0).forEach(callback => callback());
    expect(grid.children.length).toBe(initial);
    expect(observers.filter(observer => observer.targets.has(grid.querySelector('.lib-ph')))).toHaveLength(0);
    page.finishPhotoStudioEntry(document.createElement('div'));
    frames.splice(0).forEach(callback => callback());
    expect(grid.children.length).toBe(initial);
    page.finishPhotoStudioEntry(root);
    frames.splice(0).forEach(callback => callback());
    expect(grid.children.length).toBeGreaterThan(initial);
  });

  it('首屏照片主动赋图源，不等待观察器派发；取消后释放准备', async () => {
    const { page } = await setup(null, { curtain:true });
    const grid = document.getElementById('libGrid');
    const tile = grid.firstElementChild;
    const image = tile.querySelector('img');
    grid.getBoundingClientRect = () => ({ top:0, bottom:100 });
    tile.getBoundingClientRect = image.getBoundingClientRect = () => ({ top:1, bottom:80 });
    expect(image.hasAttribute('src')).toBe(false);
    const controller = new AbortController();
    const ready = page.preparePhotoStudioEntry(controller.signal);
    expect(image.getAttribute('src')).toBe('/fixture-0.png');
    expect(image.loading).toBe('eager');
    controller.abort();
    await ready;
  });

  it('外部换页释放旧观察器，旧筛选Escape不吞掉新页按键', async () => {
    const { UI, observers, body } = await setup();
    const choice = document.querySelector('.studio-choice');
    choice.open = true;
    UI.showOverlay('新页', '<div id="replacement"><button>返回</button></div>', 'page');
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    body.querySelector('button').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(observers.every(observer => observer.disconnected)).toBe(true);
    expect(UI._inputHandler).toBeNull();
    expect(UI._hoverHandler).toBeNull();
    expect(UI._acts.libNext).toBeUndefined();
  });
  it('旧关闭/输入/翻片动作不能关闭重开的新照相馆', async () => {
    const { page, UI, acts } = await setup();
    const oldClose = acts.closeCardPage, oldNext = acts.libNext, oldInput = UI._inputHandler;
    acts.closeCardPage(); page.openCardLibrary();
    const newRoot = document.querySelector('.card-library-page');
    const name = newRoot.querySelector('.studio-dossier-name').textContent;
    oldNext(); oldInput({ target: { id: 'cardSearch', value: '不存在' } });
    vi.advanceTimersByTime(120);
    expect(newRoot.querySelector('.studio-dossier-name')?.textContent).toBe(name);
    oldClose();
    expect(UI.el.overlay.hidden).toBe(false);
    expect(game.state).toBe('modal');
  });
  it('离开后旧分帧壳与observer通知不会注入替换页，取消入馆就绪会释放图监听', async () => {
    const { page, acts, UI, frames, observers } = await setup();
    const image = document.querySelector('.studio-photo-art img');
    const grid = document.getElementById('libGrid');
    grid.getBoundingClientRect = () => ({ top: 0, bottom: 100 });
    image.getBoundingClientRect = () => ({ top: 1, bottom: 80 });
    const remove = vi.spyOn(image, 'removeEventListener');
    const controller = new AbortController();
    const readiness = page.preparePhotoStudioEntry(controller.signal);
    controller.abort(); await readiness;
    expect(remove.mock.calls.map(call => call[0])).toEqual(['load', 'error']);
    const oldShell = grid.querySelector('.lib-ph');
    acts.closeCardPage();
    UI.showOverlay('新页', '<div id="replacement">替换页</div>', 'page');
    frames.forEach(callback => callback());
    observers.forEach(observer => observer.callback([{ target: oldShell, isIntersecting: true }]));
    expect(document.getElementById('libGrid')).toBeNull();
    expect(document.getElementById('replacement').textContent).toBe('替换页');
  });
  it('换档后旧关闭动作不覆盖新档状态', async () => {
    const { UI, acts } = await setup();
    window.SDT.Base.slot = 2;
    game.state = 'idle';
    acts.closeCardPage();
    expect(game.state).toBe('idle');
    expect(UI.hideOverlay).not.toHaveBeenCalled();
  });
  it('快速关闭后进入共用卡页开关的Hub，旧淡出结束会移除照相馆类', async () => {
    const { acts, UI } = await setup();
    acts.closeCardPage();
    vi.advanceTimersByTime(100);
    expect(document.body.classList.contains('cardlib-open')).toBe(true);
    UI.showOverlay('基地', '<div id="hubMain">基地</div>', 'page');
    const { setCardPageOpen } = await import('../game/src/hub/game.cardslib.common.js');
    setCardPageOpen(true);
    vi.advanceTimersByTime(140);
    expect(document.body.classList.contains('cardlib-open')).toBe(false);
    expect(document.getElementById('hubMain').textContent).toBe('基地');
  });
  it('导出再返回照相馆保持标题来源，外部替换释放资源不改变当前页面状态', async () => {
    const { acts, UI } = await setup();
    acts.exportCards();
    expect(document.getElementById('ovExport')).not.toBeNull();
    expect(document.body.classList.contains('cardlib-open')).toBe(false);
    acts.backLib();
    expect(document.querySelector('.card-library-page')).not.toBeNull();
    expect(game.state).toBe('modal');
    acts.closeCardPage();
    expect(game.state).toBe('title');
    UI.showOverlay('基地', '<div id="hubMain">新基地</div>', 'page');
    expect(document.getElementById('hubMain').textContent).toBe('新基地');
  });
  it('重复ID保持目录首项的详情/查看照片一致，重开更新目录', async () => {
    const first = { id: 'duplicate', name: '首项原卡', type: '法术', rarity: '古朴', desc: '首项说明', cost: 1 };
    const second = { ...first, name: '末项重复卡', desc: '末项说明' };
    const { acts, UI, page, cards } = await setup([first, second]);
    expect(document.querySelector('.studio-dossier-name').textContent).toBe(first.name);
    expect(document.querySelectorAll('#libGrid [data-card="duplicate"]')).toHaveLength(1);
    acts.libInspect({ card: 'duplicate' });
    expect(UI.showCardZoom.mock.calls[0][0]).toBe(first);
    acts.closeCardPage(); cards.splice(0, cards.length, { ...first, name: '刷新目录' }); page.openCardLibrary();
    expect(document.querySelector('.studio-dossier-name').textContent).toBe('刷新目录');
  });
  it('引用目录同样使用首项身份，重复ID的旧名称不指向另一张卡', async () => {
    await setup();
    const first = { id: 'dup-reference', name: '首项引用卡', desc: '首项' };
    const second = { ...first, name: '末项引用卡' };
    const { createCardDescriptionRenderer } = await import('../game/src/cards/card-description-links.js');
    const renderer = createCardDescriptionRenderer([first, second]);
    expect(renderer.getCard('dup-reference')).toBe(first);
    const holder = document.createElement('div');
    holder.innerHTML = renderer.render('获得「首项引用卡」和「末项引用卡」。', 'source');
    expect(holder.querySelectorAll('[data-card-reference]')).toHaveLength(1);
    expect(holder.querySelector('[data-card-reference]').textContent).toBe('首项引用卡');
  });
  it('棱彩扫光不跨筛选继承，关页清掉扫光定时器', async () => {
    const { UI, acts } = await setup([
      { id: 'fixture-prism', name: '棱彩样本', type: '法术', rarity: '棱彩', desc: '样本', cost: 1 },
      { id: 'fixture-plain', name: '普通样本', type: '法术', rarity: '古朴', desc: '样本', cost: 1 },
    ]);
    const grid = document.getElementById('libGrid');
    const select = document.getElementById('libRar');
    select.value = '棱彩'; UI._inputHandler({ target: select });
    expect(grid.classList.contains('lib-holo')).toBe(true);
    select.value = '全部'; UI._inputHandler({ target: select });
    expect(grid.classList.contains('lib-holo')).toBe(false);
    select.value = '棱彩'; UI._inputHandler({ target: select });
    acts.closeCardPage();
    const remove = vi.spyOn(grid.classList, 'remove');
    vi.advanceTimersByTime(2300);
    expect(remove).not.toHaveBeenCalledWith('lib-holo');
  });
  it('类型/费用排序与连续翻片同步到详情和唯一选中照片，往返保留筛选', async () => {
    const cards = [
      { id: 'fixture-a', name: '甲', type: '法术', rarity: '古朴', desc: '甲', cost: 3 },
      { id: 'fixture-b', name: '乙', type: '道具', rarity: '稀有', desc: '乙', cost: 1 },
      { id: 'fixture-c', name: '丙', type: '法术', rarity: '古朴', desc: '丙', cost: 2 },
    ];
    const { UI, acts, page } = await setup(cards);
    acts.libTab({ t: '法术' });
    const sort = document.getElementById('libSort'); sort.value = 'cost'; UI._inputHandler({ target: sort });
    const tile = document.querySelector('#libGrid [data-card="fixture-c"]');
    tile.focus();
    expect(document.querySelector('.studio-zoom').dataset.card).toBe('fixture-c');
    acts.libNext();
    expect(document.querySelector('.studio-zoom').dataset.card).toBe('fixture-a');
    expect(document.querySelector('.studio-dossier-name').textContent).toBe('甲');
    expect(document.querySelectorAll('#libGrid [aria-current="true"]')).toHaveLength(1);
    acts.closeCardPage(); page.openCardLibrary();
    expect(document.querySelector('.type-tab.on').dataset.t).toBe('法术');
    expect(document.getElementById('libSort').value).toBe('cost');
    expect(document.querySelector('.studio-zoom').dataset.card).toBe('fixture-a');
  });
  it('中文输入组合不提前筛选，筛选为空与重置后选片详情保持一致', async () => {
    const { UI, acts } = await setup();
    const search = document.getElementById('cardSearch');
    search.dispatchEvent(new Event('compositionstart'));
    search.value = '不存在'; UI._inputHandler({ target: search, isComposing: true });
    vi.advanceTimersByTime(200);
    expect(document.querySelector('.studio-dossier-name')).not.toBeNull();
    search.dispatchEvent(new Event('compositionend'));
    vi.advanceTimersByTime(120);
    expect(document.querySelector('.studio-dossier-name')).toBeNull();
    expect(document.querySelector('.clib-empty')).not.toBeNull();
    acts.libClearFilter();
    const selected = document.querySelector('[aria-current="true"][data-card]');
    expect(document.querySelector('.studio-zoom').dataset.card).toBe(selected.dataset.card);
    expect(document.querySelectorAll('#libGrid [aria-current="true"]')).toHaveLength(1);
  });
});
