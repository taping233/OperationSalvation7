// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({ convert: vi.fn(), read: vi.fn(), refresh: vi.fn(), ding: vi.fn() }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: ports.read, readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ convertCollection: ports.convert, stackKeyOf: stack => stack.card.id, getCharacter: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ homeRequestId: () => 'rework-test', slots: { renderHub: ports.refresh } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: ports.ding } }));
vi.mock('../game/src/run/game.session.js', () => ({ MAP: { rules: {} } }));
const normal = { id: 'one', name: '甲', type: '武术', rarity: '古朴', desc: '攻击' };
const rare = { id: 'two', name: '乙', type: '法术', rarity: '稀有', desc: '恢复' };
let base, ui, cards;

beforeEach(() => {
  vi.resetModules(); ports.convert.mockReset(); ports.read.mockReset(); ports.refresh.mockReset(); ports.ding.mockReset();
  ports.read.mockReturnValue({ ok: true, value: {}, revision: 7 });
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const marked = new Set();
  base = {
    slot: 1, data: { wood: 0, rations: 0, coins: 0, stash: [{ card: normal, count: 2 }, { card: rare, count: 1 }], pocket: [] },
    PETS: [], PET_EGG_ID: 'egg', HATCH_COST: 50,
    stashUsed: () => base.data.stash.reduce((sum, stack) => sum + stack.count, 0), stashCap: () => 25,
    isCollected: card => marked.has(card.id), materialInfo: () => null,
    collectToggle: vi.fn(card => { if (marked.has(card.id)) { marked.delete(card.id); return false; } marked.add(card.id); return true; }),
    sellStashCards: vi.fn((name, count) => {
      const stack = base.data.stash.find(item => item.card.name === name);
      if (!stack || marked.has(stack.card.id) || stack.count < count) return { ok: false };
      stack.count -= count; base.data.coins += count * 2;
      base.data.stash = base.data.stash.filter(item => item.count > 0);
      return { ok: true, msg: `卖出${name}` };
    }),
  };
  ui = { _acts: {}, act: (id, handler) => { ui._acts[id] = handler; }, log: vi.fn(), showCardZoom: vi.fn((card, options) => {
    document.getElementById('cardZoom')?.remove();
    const zoom = document.createElement('section'); zoom.id = 'cardZoom';
    zoom.innerHTML = `<div class="cz-backdrop"></div><div class="cz-card">${cards.cardHTML(card)}</div><div class="cz-foot">${options.footer || ''}</div>`;
    zoom.addEventListener('click', event => {
      if (event.target.classList.contains('cz-backdrop')) { zoom.remove(); options.returnFocus?.focus(); return; }
      const button = event.target.closest('.cz-foot [data-act]');
      if (button && !button.disabled) ui._acts[button.dataset.act]?.(button.dataset);
    });
    document.body.append(zoom);
  }) };
  cards = { cardHTML: card => `<div class="hs-card">${card.name}</div>`, sellPrice: () => 2, all: () => base.data.stash.map(stack => stack.card) };
  window.SDT = { Base: base, Cards: cards, Icons: { rich: value => value, img: id => `<i>${id}</i>` }, UI: ui,
    Meta: { onCollect: vi.fn(), checkUnlocks: vi.fn() } };
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });

async function mount() {
  const feature = await import('../game/src/hub/hub.warehouse.js');
  const pages = await import('../game/src/hub/game.hub.pages.js');
  document.body.innerHTML = feature.warehouseHTML();
  const openCard = vi.fn((...args) => pages.openStashCardView(...args));
  feature.bindWarehouse({ ui, base, cards, sound: { tick: vi.fn(), ding: vi.fn() }, openCard });
  return { feature, pages, openCard };
}
const search = value => { const input = document.querySelector('[data-warehouse-filter="query"]'); input.value = value; input.dispatchEvent(new Event('input')); return input; };
const open = name => { const source = document.querySelector(`[data-name="${name}"]`); source.focus(); source.click(); return source; };
const footer = action => document.querySelector(`#cardZoom .cz-foot [data-act="${action}"]`);
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

// Browser selection is reversible; the original zoom footer owns every inventory mutation.
describe('仓库双排浏览与原特写事务边界', () => {
  it('无匹配可以清除筛选恢复全部卡牌，浏览不改变库存', async () => {
    await mount(); const before = JSON.stringify(base.data); search('没有');
    expect(document.querySelector('.warehouse-no-results').hidden).toBe(false);
    ui._acts.warehouseReset();
    expect(document.querySelector('[data-warehouse-filter="query"]').value).toBe('');
    expect(document.querySelector('.warehouse-no-results').hidden).toBe(true);
    expect([...document.querySelectorAll('.stash-cell')].filter(card => !card.hidden)).toHaveLength(2);
    expect(document.querySelector('[data-card-browser]').dataset.empty).toBe('false');
    expect(JSON.stringify(base.data)).toBe(before);
  });

  it('培养卡存在但搜索无匹配时不提示缺卡，重置搜索保留人物范围', async () => {
    base.data.stash = [{card:{id:'growth-one',name:'归档甲',type:'武术',rarity:'职业',cls:'侠客'},count:1}, {card:normal,count:1}];
    const feature = await import('../game/src/hub/hub.warehouse.js');
    feature.focusWarehouseForCharacter('wu');
    await mount();
    search('不存在');
    expect(document.querySelector('.warehouse-no-results h3').textContent).toBe('没有匹配的卡牌');
    expect(document.querySelector('.warehouse-no-results').textContent).not.toContain('撤离');
    ui._acts.warehouseReset();
    expect(document.querySelector('.warehouse-purpose').hidden).toBe(false);
    expect(document.querySelector('[data-name="归档甲"]').hidden).toBe(false);
    expect(document.querySelector('[data-name="甲"]').hidden).toBe(true);
  });

  it('筛选后的卡牌以真实库存索引和来源委派特写，浏览不执行出售', async () => {
    const { openCard } = await mount(); const before = JSON.stringify(base.data); search('乙');
    expect(document.querySelector('[data-name="甲"]').hidden).toBe(true);
    const from = open('乙');
    expect(openCard).toHaveBeenCalledWith(1, { from });
    expect(ui.showCardZoom).toHaveBeenLastCalledWith(rare, expect.objectContaining({ from, returnFocus: from }));
    expect(JSON.stringify(base.data)).toBe(before);
    expect(footer('stashSellOne')).toBeNull();
    expect(base.sellStashCards).not.toHaveBeenCalled();
    expect(base.data.coins).toBe(0);
    expect(base.data.stash).toEqual([{ card: normal, count: 2 }, { card: rare, count: 1 }]);
  });

  it('重新打开另一张卡时收藏操作只作用于新卡', async () => {
    const { pages } = await mount(); open('甲');
    expect(footer('stashCollectToggle')).not.toBeNull();
    pages.openStashCardView(1, { from: document.querySelector('[data-name="乙"]') });
    footer('stashCollectToggle').click();
    expect(base.collectToggle).toHaveBeenCalledExactlyOnceWith(rare);
    expect(base.sellStashCards).not.toHaveBeenCalled();
    expect(base.data.stash[0].count).toBe(2);
  });

  it('普通收藏保留原卡堆，特写刷新显示收藏状态且取消后恢复', async () => {
    await mount(); open('甲'); footer('stashCollectToggle').click();
    expect(base.collectToggle).toHaveBeenCalledWith(normal);
    expect(base.data.stash[0].count).toBe(2);
    expect(window.SDT.Meta.onCollect).toHaveBeenCalledWith(normal, true);
    expect(document.querySelector('#cardZoom .inspect-collection-state').textContent).toBe('已收藏');
    expect(footer('stashCollectToggle').textContent).toBe('取消收藏');
    expect(base.sellStashCards).not.toHaveBeenCalled();
    footer('stashCollectToggle').click();
    expect(document.querySelector('#cardZoom .inspect-collection-state').textContent).toBe('仓库卡牌');
    expect(footer('stashCollectToggle').textContent).toBe('收藏卡牌');
    expect(base.data.stash[0].count).toBe(2);
  });

  it('归档培养先确认；保存未完成时重复点击只能提交一次', async () => {
    base.data.stash = [{ card: { ...normal, cls: '侠客', rarity: '职业' }, count: 2 }];
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await mount(); open('甲'); footer('stashCollectOne').click();
    expect(ports.convert).not.toHaveBeenCalled();
    footer('stashCollectOne').click(); footer('stashCollectOne').click();
    expect([...document.querySelectorAll('#cardZoom .cz-foot button')].every(button => button.disabled)).toBe(true);
    expect(ports.convert).toHaveBeenCalledTimes(1);
    expect(ports.convert).toHaveBeenCalledWith(expect.objectContaining({ slotId: 1, expectedRevision: 7 }), { stackKey: 'one', count: 1 });
    finish({ ok: false, message: '写盘失败' }); await tick();
    expect(base.data.stash[0].count).toBe(2);
    expect(footer('stashCollectOne').disabled).toBe(false);
  });

  it('归档保存失败提示原因、保留库存并允许再次确认重试', async () => {
    base.data.stash = [{ card: { ...normal, cls: '侠客', rarity: '职业' }, count: 2 }];
    ports.convert.mockResolvedValue({ ok: false, message: '写盘失败' });
    await mount(); open('甲'); footer('stashCollectOne').click(); footer('stashCollectOne').click(); await tick();
    expect(ui.log).toHaveBeenCalledWith('写盘失败', 'warn');
    expect(base.data.stash[0].count).toBe(2);
    expect(ports.refresh).not.toHaveBeenCalled();
    footer('stashCollectOne').click(); footer('stashCollectOne').click(); await tick();
    expect(ports.convert).toHaveBeenCalledTimes(2);
    expect(base.data.stash[0].count).toBe(2);
  });

  it('归档响应到达前换档，不重绘新档位、改变新搜索或播报旧档成功', async () => {
    base.data.stash = [{ card: { ...normal, cls: '侠客', rarity: '职业' }, count: 2 }];
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    await mount(); open('甲'); footer('stashCollectOne').click(); footer('stashCollectOne').click();
    base.slot = 2; base.data.stash = [{ card: rare, count: 1 }]; await mount();
    expect(document.querySelector('[data-warehouse-filter="query"]').value).toBe('');
    search('乙'); ui.log.mockClear(); ports.refresh.mockClear();
    finish({ ok: true }); await tick();
    expect(ports.refresh).not.toHaveBeenCalled();
    expect(ui.log).not.toHaveBeenCalled();
    expect(document.querySelector('[data-warehouse-filter="query"]').value).toBe('乙');
    expect(document.querySelector('[data-name="乙"]').hidden).toBe(false);
    expect(base.data.stash).toEqual([{ card: rare, count: 1 }]);
  });

  it('归档保存抛错仍给失败反馈、释放禁用态且不改变库存', async () => {
    base.data.stash = [{ card: { ...normal, cls: '侠客', rarity: '职业' }, count: 2 }];
    ports.convert.mockRejectedValue(new Error('disk offline'));
    await mount(); open('甲'); footer('stashCollectOne').click(); footer('stashCollectOne').click(); await tick();
    expect(ui.log).toHaveBeenCalledWith('归档未保存，请重试', 'warn');
    expect(footer('stashCollectOne').disabled).toBe(false);
    expect(base.data.stash[0].count).toBe(2);
    expect(ports.refresh).not.toHaveBeenCalled();
  });

  it('关闭特写返回来源，筛选和浏览保持且不产生库存写入', async () => {
    await mount(); search('乙'); const before = JSON.stringify(base.data), from = open('乙');
    document.querySelector('#cardZoom .cz-backdrop').click();
    expect(document.activeElement).toBe(from);
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(document.querySelector('[data-warehouse-filter="query"]').value).toBe('乙');
    expect(document.querySelector('[data-name="甲"]').hidden).toBe(true);
    expect(JSON.stringify(base.data)).toBe(before);
    expect(ports.refresh).not.toHaveBeenCalled();
  });
});

it('同一仓库分页或资源更新保留基地壳与资源栏，跳转不同房间创建独立页', async () => {
  const { presentHub } = await import('../game/src/hub/hub.presentation.js');
  const html = (room, view, coins) => `<div id="hubMain" class="base-camp" data-page="${room}"><header class="hub-head"><span class="hub-slot-label">01</span><span class="hub-res">${coins}</span></header><main class="hub-page" data-view="${room}/${view}">${view}</main></div>`;
  ui.showOverlay = vi.fn((_title, value) => { document.body.innerHTML = value; });
  presentHub(ui, html('stash', 'cards', 0), window.SDT.Icons);
  const root = document.getElementById('hubMain'), head = root.querySelector('header'), resources = root.querySelector('.hub-res');
  presentHub(ui, html('stash', 'pocket', 4), window.SDT.Icons);
  expect(document.getElementById('hubMain')).toBe(root);
  expect(root.querySelector('header')).toBe(head);
  expect(root.querySelector('.hub-res')).toBe(resources); expect(resources.textContent).toBe('4');
  expect(ui.showOverlay).toHaveBeenCalledTimes(1);
  presentHub(ui, html('shop', 'goods', 4), window.SDT.Icons);
  expect(document.getElementById('hubMain')).not.toBe(root);
  expect(document.getElementById('hubMain').dataset.page).toBe('shop');
  expect(ui.showOverlay).toHaveBeenCalledTimes(2);
});
