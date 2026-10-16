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

it('coalesces warehouse image load bursts into one layout refresh and ignores departed pages', async () => {
  base.data.stash = [{card,count:2}];
  Object.assign(base,{stashUsed:()=>2,stashCap:()=>25});
  window.SDT.Cards.cardHTML=item=>item.name;
  const feature=await import('../game/src/hub/hub.warehouse.js');
  document.querySelector('.hub-page').innerHTML=feature.warehouseHTML();
  feature.bindWarehouse({ui,base,sound:{tick:vi.fn()}});
  const browser=document.querySelector('[data-card-browser]'), track=browser.querySelector('.card-browser-track');
  const width=vi.fn(()=>1000), frames=[];
  Object.defineProperty(track,'clientWidth',{get:width});
  vi.stubGlobal('requestAnimationFrame',fn=>{frames.push(fn);return frames.length;});
  const image=document.createElement('img'); track.firstElementChild.append(image);
  try {
    for(let i=0;i<100;i++)image.dispatchEvent(new Event('load'));
    expect(width).not.toHaveBeenCalled(); expect(frames).toHaveLength(1);
    frames[0]();expect(width).toHaveBeenCalledTimes(1);
    image.dispatchEvent(new Event('load'));expect(frames).toHaveLength(2);
    document.querySelector('.warehouse-v3').remove();
    frames[1]();expect(width).toHaveBeenCalledTimes(1);
  } finally {vi.unstubAllGlobals();}
});

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


it('基地材料入口不依赖标准资源卡存在，关闭后可再次查看并说明折入规则', () => {
  base.data.wood = 7; window.SDT.Cards.all = () => [];
  pages.openRawItem('wood');
  expect(document.querySelector('#cardZoom .cz-card').textContent).toBe('木材');
  expect(document.querySelector('#cardZoom .cz-foot').textContent).toContain('基地木材库存 7 份');
  expect(document.querySelector('#cardZoom .cz-foot').textContent).toContain('资源卡需在仓库详情使用');
  document.querySelector('#cardZoom .cz-backdrop').click();
  pages.openRawItem('wood'); expect(document.querySelector('#cardZoom')).not.toBeNull();
  expect(base.data.wood).toBe(7); expect(base.useStashMaterial).not.toHaveBeenCalled();
});


describe('仓库补给物品真实页脚入口', () => {
  const wood = { id: 'tt-wood', name: '木材', type: '资源', rarity: '古朴' };
  const egg = { id: 'egg', name: '宠物蛋', type: '道具', rarity: '稀有' };
  const pack = { id: 'tt-econpack', name: '经济卡包', type: '道具', rarity: '稀有' };
  it('材料真实使用1张入口折入库存，关闭后可重入并确认最后一张', () => {
    open(wood); base.data.wood = 0;
    base.useStashMaterial.mockImplementation((_name, all) => {
      const count = all ? base.data.stash[0].count : 1; base.data.wood += count;
      base.data.stash[0].count -= count; if (!base.data.stash[0].count) base.data.stash = [];
      return { ok: true, msg: '木材已折入' };
    });
    const stale = ui._acts.stashUseMat; button('stashUseMat').click();
    expect(base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('木材', false);
    expect(base.data.wood).toBe(1); expect(document.getElementById('cardZoom')).toBeNull();
    pages.openStashCardView(0); const current = document.getElementById('cardZoom'); stale();
    expect(base.useStashMaterial).toHaveBeenCalledTimes(1); expect(document.getElementById('cardZoom')).toBe(current);
    button('stashUseMat').click(); expect(button('stashUseMat').textContent).toBe('确认？');
    expect(base.data.wood).toBe(1); button('stashUseMat').click(); expect(base.data.wood).toBe(2);
    expect(base.data.stash).toEqual([]);
  });
  it('整堆按钮二次确认并绑定当前库存数量，数量变化后不能沿用旧确认', () => {
    open(wood); button('stashUseMatAll').click(); expect(base.useStashMaterial).not.toHaveBeenCalled();
    base.data.stash[0].count = 4; button('stashUseMatAll').click();
    expect(base.useStashMaterial).not.toHaveBeenCalled(); button('stashUseMatAll').click();
    expect(base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('木材', true);
  });
  it('孵化按钮显示成本且需再次确认，失败保留详情供重试', () => {
    open(egg); expect(button('stashHatch').textContent).toContain('50 储备币');
    button('stashHatch').click(); expect(base.hatchPet).not.toHaveBeenCalled();
    button('stashHatch').click(); expect(base.hatchPet).toHaveBeenCalledOnce();
    expect(document.getElementById('cardZoom')).not.toBeNull(); expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('不足 50'), 'warn');
    base.hatchPet.mockReturnValue({ ok: true, pet: { name: '旺财', desc: '伙伴' } });
    button('stashHatch').click(); button('stashHatch').click();
    expect(base.hatchPet).toHaveBeenCalledTimes(2); expect(document.getElementById('cardZoom')).toBeNull();
  });
  it('拆包真实按钮受五格空位限制，最后一包需二次确认且向既有命令传5张', () => {
    base.data.stash = [{ card: pack, count: 1 }]; base.stashRoom = () => 4; pages.openStashCardView(0);
    button('stashOpenPack').click(); button('stashOpenPack').click();
    expect(base.openCardPack).not.toHaveBeenCalled(); expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('空位不足 5 格'), 'warn');
    base.stashRoom = () => 5; button('stashOpenPack').click();
    expect(base.openCardPack).toHaveBeenCalledExactlyOnceWith('tt-econpack', expect.arrayContaining([expect.objectContaining({ count: 1 })]));
    expect(base.openCardPack.mock.calls[0][1]).toHaveLength(5); expect(document.getElementById('cardZoom')).toBeNull();
  });
  it.each([[wood, 'stashUseMat'], [egg, 'stashHatch'], [pack, 'stashOpenPack']])('同名/同ID异variant的%s不能误消耗另一堆', (item, action) => {
    base.data.stash = [{ card: { ...item, variantKey: 'first' }, count: 2 }, { card: { ...item, variantKey: 'second' }, count: 2 }];
    pages.openStashCardView(1); button(action).click(); if (action === 'stashHatch') button(action).click();
    expect(base.useStashMaterial).not.toHaveBeenCalled(); expect(base.hatchPet).not.toHaveBeenCalled(); expect(base.openCardPack).not.toHaveBeenCalled();
    expect(ui.log).toHaveBeenCalledWith('库存引用不唯一，请刷新仓库', 'warn');
  });
});
