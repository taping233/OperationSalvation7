// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({ convert: vi.fn(), read: vi.fn(), refresh: vi.fn(), ding: vi.fn() }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: ports.read, readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/home/home.presenter.js', () => ({ homeErrorMessage: result => result.message }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ convertCollection: ports.convert, stackKeyOf: stack => `card:${stack.card.id}${stack.card.variantKey ? ':' + stack.card.variantKey : ''}`, getCharacter: vi.fn() }));
vi.mock('../game/src/hub/game.hub.bridge.js', () => ({ homeRequestId: () => 'inventory-audit', slots: { renderHub: ports.refresh } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: ports.ding } }));
vi.mock('../game/src/run/game.session.js', () => ({ MAP: { rules: {} } }));
let base, ui, pages;
const card = { id: 'normal', name: '同名卡', type: '法术', rarity: '古朴', desc: '测试' };
const growth = { ...card, id: 'growth', cls: '侠客', rarity: '职业' };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const button = act => document.querySelector(`#cardZoom [data-act="${act}"]`);
const open = item => {
  base.data.stash = [{ card: item, count: 2 }];
  pages.openStashCardView(0);
  return document.getElementById('cardZoom');
};

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  for (const port of Object.values(ports)) port.mockReset();
  ports.read.mockReturnValue({ ok: true, revision: 4 });
  ports.convert.mockResolvedValue({ ok: false, message: '保持库存' });
  base = {
    slot: 1, data: { stash: [], collection: {} }, PET_EGG_ID: 'egg',
    materialInfo: item => item.type === '资源' ? { kind: 'wood' } : null,
    isCollected: item => !!base.data.collection[item.id],
    collectToggle: vi.fn(item => { base.data.collection[item.id] = { name: item.name }; return true; }),
    useStashMaterial: vi.fn(() => ({ ok: true, msg: '已使用' })),
    hatchPet: vi.fn(() => ({ ok: false, why: 'poor' })),
    stashRoom: () => 10,
    openCardPack: vi.fn(() => ({ ok: true })),
  };
  ui = {
    _acts: {}, act(name, handler) { this._acts[name] = handler; }, log: vi.fn(),
    showCardZoom(item, options = {}) {
      document.getElementById('cardZoom')?.remove();
      const zoom = document.createElement('section'); zoom.id = 'cardZoom';
      zoom.innerHTML = `<div class="cz-backdrop"></div><div class="cz-card">${item.name}</div><div class="cz-foot">${options.footer || ''}</div>`;
      zoom.addEventListener('click', event => {
        if (event.target.closest('.cz-backdrop')) { zoom.remove(); return; }
        const action = event.target.closest('.cz-foot [data-act]');
        if (action && !action.disabled) ui._acts[action.dataset.act]?.(action.dataset);
      });
      document.body.append(zoom);
    },
  };
  document.body.innerHTML = '<main id="hubMain" data-page="stash"><section class="hub-page" data-view="stash/cards"></section></main>';
  window.SDT = { Base: base, UI: ui, Cards: { all: () => [card, growth], isRandomObtainable: () => true },
    Meta: { onCollect: vi.fn(), checkUnlocks: vi.fn() } };
  pages = await import('../game/src/hub/game.hub.pages.js');
});
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('仓库特写操作上下文', () => {
  it.each(['stashCollectToggle', 'stashUseMat', 'stashUseMatAll', 'stashHatch', 'stashOpenPack'])('换档后旧 %s 不接触新档同名库存', action => {
    open(card); const previous = ui._acts[action];
    base.slot = 2; base.data = { stash: [{ card, count: 2 }], collection: {} };
    const before = JSON.stringify(base.data); previous();
    expect(base.collectToggle).not.toHaveBeenCalled(); expect(base.useStashMaterial).not.toHaveBeenCalled();
    expect(base.hatchPet).not.toHaveBeenCalled(); expect(base.openCardPack).not.toHaveBeenCalled();
    expect(JSON.stringify(base.data)).toBe(before); expect(ports.refresh).not.toHaveBeenCalled();
  });
  it('换档后旧已确认归档动作不发起新档转换', async () => {
    open(growth); ui._acts.stashCollectOne(); const previous = ui._acts.stashCollectOne;
    base.slot = 2; base.data = { stash: [{ card: growth, count: 2 }], collection: {} };
    previous(); await flush();
    expect(ports.read).not.toHaveBeenCalled(); expect(ports.convert).not.toHaveBeenCalled();
  });
  it.each(['closed', 'replacement', 'leaving', 'view'])('详情 %s 后旧收藏不执行或影响更新的页面', kind => {
    const zoom = open(card), previous = ui._acts.stashCollectToggle;
    if (kind === 'closed') zoom.remove();
    if (kind === 'replacement') { pages.openRawItem('wood'); ui.showCardZoom(card); }
    if (kind === 'leaving') zoom.classList.add('cz-out');
    if (kind === 'view') document.querySelector('.hub-page').dataset.view = 'stash/pocket';
    const current = document.getElementById('cardZoom'); previous();
    expect(base.collectToggle).not.toHaveBeenCalled(); expect(ports.refresh).not.toHaveBeenCalled();
    expect(document.getElementById('cardZoom')).toBe(current);
  });
  it('卡名相同但ID不同，旧详情不收藏已不持有的卡', () => {
    open(card); const previous = ui._acts.stashCollectToggle;
    base.data.stash = [{ card: { ...card, id: 'replacement' }, count: 2 }]; previous();
    expect(base.collectToggle).not.toHaveBeenCalled(); expect(base.data.collection).toEqual({});
  });
  it('同名异ID归档必须扣当前预览的真实堆', async () => {
    base.data.stash = [{ card: { ...growth, id: 'other' }, count: 9 }, { card: growth, count: 2 }];
    pages.openStashCardView(1);
    expect(document.querySelector('.inspect-count').textContent).toContain('2');
    ui._acts.stashCollectOne(); ui._acts.stashCollectOne();
    expect(ports.convert).toHaveBeenCalledWith(expect.objectContaining({ slotId: 1 }), { stackKey: 'card:growth', count: 1 });
  });
  it('同ID异variant归档必须扣当前预览的真实堆', async () => {
    base.data.stash = [{ card: { ...growth, variantKey: 'first' }, count: 9 }, { card: { ...growth, variantKey: 'second' }, count: 2 }];
    pages.openStashCardView(1); ui._acts.stashCollectOne(); ui._acts.stashCollectOne();
    expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth:second', count: 1 });
  });
  it('全部归档确认期间数量变化，要按当前数量重新确认', async () => {
    open(growth); ui._acts.stashCollectAll(); base.data.stash[0].count = 3; ui._acts.stashCollectAll();
    expect(ports.convert).not.toHaveBeenCalled(); expect(ui.log).toHaveBeenCalledWith('库存数量已变化，请重新确认', 'warn');
    expect(document.querySelector('.inspect-count').textContent).toContain('3');
    ui._acts.stashCollectAll(); expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth', count: 3 });
  });
  it('确认2.6秒过期后再点击只重新确认', () => {
    open(growth); ui._acts.stashCollectOne(); vi.advanceTimersByTime(2601); ui._acts.stashCollectOne();
    expect(ports.convert).not.toHaveBeenCalled(); ui._acts.stashCollectOne(); expect(ports.convert).toHaveBeenCalledTimes(1);
  });
  it('异步保存重复确认只提交一次；失败后保留库存并可重试', async () => {
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    open(growth); ui._acts.stashCollectOne(); ui._acts.stashCollectOne(); ui._acts.stashCollectOne();
    expect(ports.convert).toHaveBeenCalledTimes(1); expect(button('stashCollectOne').disabled).toBe(true);
    finish({ ok: false, message: '写盘失败' }); await flush();
    expect(base.data.stash[0].count).toBe(2); expect(button('stashCollectOne').disabled).toBe(false);
    expect(ui.log).toHaveBeenCalledWith('写盘失败', 'warn');
    ui._acts.stashCollectOne(); ui._acts.stashCollectOne(); expect(ports.convert).toHaveBeenCalledTimes(2);
  });
  it.each(['slot', 'replacement', 'leaving', 'view'])('异步返回发生在 %s 后不重绘或播报旧结果', async kind => {
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const zoom = open(growth); ui._acts.stashCollectOne(); ui._acts.stashCollectOne();
    if (kind === 'slot') base.slot = 2;
    if (kind === 'replacement') ui.showCardZoom(card);
    if (kind === 'leaving') zoom.classList.add('cz-out');
    if (kind === 'view') document.querySelector('.hub-page').dataset.view = 'stash/pocket';
    finish({ ok: true }); await flush(); expect(ports.refresh).not.toHaveBeenCalled(); expect(ui.log).not.toHaveBeenCalled();
  });
  it('正常收藏刷新并保留卡牌与当前详情', () => {
    const zoom = open(card); ui._acts.stashCollectToggle();
    expect(base.collectToggle).toHaveBeenCalledExactlyOnceWith(card); expect(base.data.stash[0].count).toBe(2);
    expect(document.getElementById('cardZoom')).toBe(zoom); expect(document.querySelector('.inspect-collection-state').textContent).toBe('已收藏');
  });
});


describe('基地口袋复原数量与整堆命令一致', () => {
  async function mountPocket({ count = 2, keys = 2, room = 2 } = {}) {
    Object.assign(base.data, { pocket: [{ card, count }], keys });
    Object.assign(base, { stashUsed: () => 0, stashCap: () => 25, stashRoom: () => room, pocketKeyCost: stack => stack.count });
    window.SDT.Cards.cardHTML = item => `<span>${item.name}</span>`;
    const feature = await import('../game/src/hub/hub.warehouse.js');
    document.querySelector('.hub-page').innerHTML = feature.warehouseHTML('pocket');
    feature.bindWarehouse({ ui, base, sound: { tick: vi.fn() } });
    document.querySelector('[data-browser-key]').click();
    // 点卡仅选中浏览（2026-10-15 新契约）；特写页脚经「查看详情」打开
    ui._acts.warehousePick(document.querySelector('[data-act="warehousePick"]').dataset);
    return button('restoreCard');
  }
  it('按钮明确整堆2张/2钥匙，而不是承诺仅复原1张', async () => {
    const restore = await mountPocket(); expect(restore.textContent).toContain('复原 2 张');
    expect(restore.textContent).toContain('2 钥匙'); expect(restore.disabled).toBe(false);
  });
  it('只剩1格时不能按可复原2张显示为可用', async () => {
    const restore = await mountPocket({ room: 1 }); expect(restore.disabled).toBe(true);
    expect(document.querySelector('.pocket-zoom-actions').textContent).toContain('仓库空位不足');
  });
  it('整堆钥匙不足时保留缺口提示和禁用态', async () => {
    const restore = await mountPocket({ keys: 1 }); expect(restore.disabled).toBe(true);
    expect(document.querySelector('.pocket-zoom-actions').textContent).toContain('还需 1 把钥匙');
  });
});

it.each([[false, 'variant'], [true, 'variant'], [false, 'id'], [true, 'id']])('真实仓库点击同名第二堆必须预览该堆（pocket=%s identity=%s）', async (pocket, identity) => {
  const first = { card:identity === 'variant' ? {...growth,variantKey:'first'} : {...growth,id:'first'}, count:9 };
  const second = { card:identity === 'variant' ? {...growth,variantKey:'second'} : {...growth,id:'second'}, count:2 };
  Object.assign(base.data, { stash:pocket ? [] : [first,second], pocket:pocket ? [first,second] : [], keys:20 });
  Object.assign(base,{stashUsed:()=>0,stashCap:()=>25,stashRoom:()=>25,pocketKeyCost:stack=>stack.count});
  window.SDT.Cards.cardHTML=item=>`<span>${item.id}</span>`;
  const feature=await import('../game/src/hub/hub.warehouse.js');
  document.querySelector('.hub-page').innerHTML=feature.warehouseHTML(pocket ? 'pocket' : 'cards');
  feature.bindWarehouse({ui,base,sound:{tick:vi.fn()},openCard:pages.openStashCardView});
  document.querySelectorAll('.stash-cell')[1].click();
  const selected=document.querySelector('.warehouse-selection-v12'); expect(selected.textContent).toContain('2 张');
  // 点卡仅选中浏览（2026-10-15 新契约）；预览该堆走「查看详情」入口
  ui._acts.warehousePick(document.querySelector('[data-act="warehousePick"]').dataset);
  if(pocket) expect(button('restoreCard').dataset.stackKey).toBe(identity === 'variant' ? 'card:growth:second' : 'card:second');
  else expect(document.querySelector('.inspect-count').textContent).toContain('2');
});

it('旧仓库DOM点卡在换档后不能打开新档详情', async () => {
  Object.assign(base.data,{stash:[{card,count:2}],pocket:[]}); Object.assign(base,{stashUsed:()=>2,stashCap:()=>25});
  window.SDT.Cards.cardHTML=item=>item.name;
  const feature=await import('../game/src/hub/hub.warehouse.js');
  document.querySelector('.hub-page').innerHTML=feature.warehouseHTML();
  feature.bindWarehouse({ui,base,sound:{tick:vi.fn()},openCard:pages.openStashCardView});
  const oldTile=document.querySelector('.stash-cell'); base.slot=2; oldTile.click();
  expect(document.getElementById('cardZoom')).toBeNull();
});
