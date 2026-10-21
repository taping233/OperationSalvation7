// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ports = vi.hoisted(() => ({ convert: vi.fn(), read: vi.fn(), refresh: vi.fn(), ding: vi.fn() }));
vi.mock('../game/src/hub/base.commands.js', () => ({ readBase: ports.read, readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
vi.mock('../game/src/home/home.presenter.js', () => { throw new Error('Retired Home presenter evaluated by warehouse'); });
vi.mock('../game/src/home/home.commands.js', () => { throw new Error('Retired Home commands evaluated by warehouse'); });
vi.mock('../game/src/home/home.catalog.js', () => { throw new Error('Retired furniture catalog evaluated by warehouse'); });
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
  ports.read.mockImplementation(() => ({ ok: true, value: structuredClone(base.data), revision: 4 }));
  ports.convert.mockResolvedValue({ ok: false, message: '保持库存' });
  base = {
    slot: 1, data: { stash: [], collection: {} }, PET_EGG_ID: 'egg',
    materialInfo: item => item.type === '资源' ? { kind: 'wood' } : null,
    isCollected: item => !!base.data.collection[item.id],
    collectToggle: vi.fn(item => {
      const record = base.data.collection[item.id];
      const protect = !(record && record.protected !== false);
      base.data.collection[item.id] = { ...record, name: item.name, protected: protect };
      return protect;
    }),
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
        if (action && !action.disabled) ui.lastAction = ui._acts[action.dataset.act]?.(action.dataset);
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
    open(growth); (await ui._acts.stashCollectOne()); const previous = ui._acts.stashCollectOne;
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
    (await ui._acts.stashCollectOne()); (await ui._acts.stashCollectOne());
    expect(ports.convert).toHaveBeenCalledWith(expect.objectContaining({ slotId: 1 }), { stackKey: 'card:growth', count: 1 });
  });
  it('同ID异variant归档必须扣当前预览的真实堆', async () => {
    base.data.stash = [{ card: { ...growth, variantKey: 'first' }, count: 9 }, { card: { ...growth, variantKey: 'second' }, count: 2 }];
    pages.openStashCardView(1); (await ui._acts.stashCollectOne()); (await ui._acts.stashCollectOne());
    expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth:second', count: 1 });
  });
  it('全部归档确认期间数量变化，要按当前数量重新确认', async () => {
    open(growth); (await ui._acts.stashCollectAll()); base.data.stash[0].count = 3; (await ui._acts.stashCollectAll());
    expect(ports.convert).not.toHaveBeenCalled(); expect(ui.log).toHaveBeenCalledWith('库存数量已变化，请重新确认', 'warn');
    expect(document.querySelector('.inspect-count').textContent).toContain('3');
    (await ui._acts.stashCollectAll()); expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth', count: 3 });
  });
  it('确认2.6秒过期后再点击只重新确认', async () => {
    open(growth); (await ui._acts.stashCollectOne()); vi.advanceTimersByTime(2601); (await ui._acts.stashCollectOne());
    expect(ports.convert).not.toHaveBeenCalled(); (await ui._acts.stashCollectOne()); expect(ports.convert).toHaveBeenCalledTimes(1);
  });
  it('异步保存重复确认只提交一次；失败后保留库存并可重试', async () => {
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    open(growth); (await ui._acts.stashCollectOne()); const writing = ui._acts.stashCollectOne(); ui._acts.stashCollectOne();
    expect(ports.convert).toHaveBeenCalledTimes(1); expect(button('stashCollectOne').disabled).toBe(true);
    finish({ ok: false, message: '写盘失败' }); await writing;
    expect(base.data.stash[0].count).toBe(2); expect(button('stashCollectOne').disabled).toBe(false);
    expect(ui.log).toHaveBeenCalledWith('写盘失败', 'warn');
    await ui._acts.stashCollectOne(); ui._acts.stashCollectOne(); expect(ports.convert).toHaveBeenCalledTimes(2);
  });
  it.each(['slot', 'replacement', 'leaving', 'view'])('异步返回发生在 %s 后不重绘或播报旧结果', async kind => {
    let finish; ports.convert.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const zoom = open(growth); (await ui._acts.stashCollectOne()); ui._acts.stashCollectOne();
    if (kind === 'slot') base.slot = 2;
    if (kind === 'replacement') ui.showCardZoom(card);
    if (kind === 'leaving') zoom.classList.add('cz-out');
    if (kind === 'view') document.querySelector('.hub-page').dataset.view = 'stash/pocket';
    finish({ ok: true }); await flush(); expect(ports.refresh).not.toHaveBeenCalled(); expect(ui.log).not.toHaveBeenCalled();
  });
  it('正常收藏刷新并保留卡牌与当前详情', async () => {
    const zoom = open(card); (await ui._acts.stashCollectToggle());
    expect(base.collectToggle).toHaveBeenCalledExactlyOnceWith(card); expect(base.data.stash[0].count).toBe(2);
    expect(document.getElementById('cardZoom')).toBe(zoom); expect(document.querySelector('.inspect-collection-state').textContent).toBe('图鉴已收录 · 已保护');
  });
  it('已收录未保护的重复卡固定有经验入口，不取消图鉴也不免费发经验', async () => {
    base.data.collection[growth.id] = { name: growth.name, protected: false };
    open(growth);
    expect(button('stashCollectOne').disabled).toBe(false);
    expect(button('stashCollectToggle').textContent).toBe('保护卡牌');
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('实际经验 +10');
    (await ui._acts.stashCollectOne()); (await ui._acts.stashCollectOne());
    expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth', count: 1 });
    expect(base.collectToggle).not.toHaveBeenCalled();
    expect(window.SDT.Meta.onCollect).not.toHaveBeenCalled();
  });
  it('旧收藏保护明确禁用经验入口，取消保护保留收录再允许转换', async () => {
    base.data.collection[growth.id] = { name: growth.name, ts: 1 };
    open(growth);
    expect(button('stashCollectOne').disabled).toBe(true);
    expect(button('stashCollectAll').disabled).toBe(true);
    (await ui._acts.stashCollectOne());
    expect(ports.convert).not.toHaveBeenCalled();
    (await clickAction(button('stashCollectToggle')));
    expect(base.data.collection[growth.id]).toMatchObject({ ts: 1, protected: false });
    expect(button('stashCollectOne').disabled).toBe(false);
  });
  it('满级未收录仅显示1张收录与经验0，已收录后不再允许转化', () => {
    base.data.characters = { wu: { lv: 10, xp: 0 } };
    open(growth);
    expect(button('stashCollectOne').textContent).toBe('仅收录图鉴 · 消耗 1 张');
    expect(button('stashCollectAll')).toBeNull();
    expect(button('stashCollectToggle')).toBeNull();
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('仅收录图鉴，经验 0，消耗 1 张');
    base.data.collection[growth.id] = { protected: false };
    pages.openStashCardView(0);
    expect(button('stashCollectOne').disabled).toBe(true);
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('不再消耗卡牌');
    expect(document.querySelector('#cardZoom .cz-foot').textContent).not.toContain('重复卡仍可转化经验');
  });
  it('批量确认预览与提交都限制为满级所需张数，并提前说明末张溢出', async () => {
    base.data.characters = { wu: { lv: 9, xp: 345 } };
    open(growth); base.data.stash[0].count = 9; pages.openStashCardView(0);
    expect(button('stashCollectAll').textContent).toBe('批量转化 · 3 张');
    (await clickAction(button('stashCollectAll')));
    expect(ports.convert).not.toHaveBeenCalled();
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('消耗【同名卡】×3');
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('实际经验 +25');
    expect(document.querySelector('[data-conversion-preview]').textContent).toContain('末张溢出 5 经验');
    (await clickAction(button('stashCollectAll')));
    expect(ports.convert).toHaveBeenCalledWith(expect.any(Object), { stackKey: 'card:growth', count: 3 });
  });
  it('确认期间人物经验或保护变化必须重看预览，不沿用已确认的收益', async () => {
    open(growth); (await ui._acts.stashCollectOne());
    base.data.characters = { wu: { lv: 1, xp: 40 } };
    (await ui._acts.stashCollectOne());
    expect(ports.convert).not.toHaveBeenCalled();
    (await ui._acts.stashCollectOne());
    expect(ports.convert).toHaveBeenCalledOnce();
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
  expect(document.querySelectorAll('.stash-cell')[1].getAttribute('aria-pressed')).toBe('true');
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
  expect(document.querySelector('#cardZoom .cz-foot').textContent).toContain('在仓库使用后计入');
  document.querySelector('#cardZoom .cz-backdrop').click();
  pages.openRawItem('wood'); expect(document.querySelector('#cardZoom')).not.toBeNull();
  expect(base.data.wood).toBe(7); expect(base.useStashMaterial).not.toHaveBeenCalled();
});


describe('仓库补给物品真实页脚入口', () => {
  const wood = { id: 'tt-wood', name: '木材', type: '资源', rarity: '古朴' };
  const egg = { id: 'egg', name: '宠物蛋', type: '道具', rarity: '稀有' };
  const pack = { id: 'tt-econpack', name: '经济卡包', type: '道具', rarity: '稀有' };
  it('材料真实使用1张入口折入库存，关闭后可重入并确认最后一张', async () => {
    open(wood); base.data.wood = 0;
    base.useStashMaterial.mockImplementation((_name, all) => {
      const count = all ? base.data.stash[0].count : 1; base.data.wood += count;
      base.data.stash[0].count -= count; if (!base.data.stash[0].count) base.data.stash = [];
      return { ok: true, msg: '木材已折入' };
    });
    const stale = ui._acts.stashUseMat; (await clickAction(button('stashUseMat')));
    expect(base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('木材', false);
    expect(base.data.wood).toBe(1); expect(document.getElementById('cardZoom')).toBeNull();
    pages.openStashCardView(0); const current = document.getElementById('cardZoom'); stale();
    expect(base.useStashMaterial).toHaveBeenCalledTimes(1); expect(document.getElementById('cardZoom')).toBe(current);
    (await clickAction(button('stashUseMat'))); expect(button('stashUseMat').textContent).toBe('确认？');
    expect(base.data.wood).toBe(1); (await clickAction(button('stashUseMat'))); expect(base.data.wood).toBe(2);
    expect(base.data.stash).toEqual([]);
  });
  it('整堆按钮二次确认并绑定当前库存数量，数量变化后不能沿用旧确认', async () => {
    open(wood); (await clickAction(button('stashUseMatAll'))); expect(base.useStashMaterial).not.toHaveBeenCalled();
    base.data.stash[0].count = 4; (await clickAction(button('stashUseMatAll')));
    expect(base.useStashMaterial).not.toHaveBeenCalled(); (await clickAction(button('stashUseMatAll')));
    expect(base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('木材', true);
  });
  it('孵化按钮显示成本且需再次确认，失败保留详情供重试', async () => {
    open(egg); expect(button('stashHatch').textContent).toContain('50 储备币');
    (await clickAction(button('stashHatch'))); expect(base.hatchPet).not.toHaveBeenCalled();
    (await clickAction(button('stashHatch'))); expect(base.hatchPet).toHaveBeenCalledOnce();
    expect(document.getElementById('cardZoom')).not.toBeNull(); expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('不足 50'), 'warn');
    base.hatchPet.mockReturnValue({ ok: true, pet: { name: '旺财', desc: '伙伴' } });
    (await clickAction(button('stashHatch'))); (await clickAction(button('stashHatch')));
    expect(base.hatchPet).toHaveBeenCalledTimes(2); expect(document.getElementById('cardZoom')).toBeNull();
  });
  it('拆包真实按钮受五格空位限制，最后一包需二次确认且向既有命令传5张', async () => {
    base.data.stash = [{ card: pack, count: 1 }]; base.stashRoom = () => 4; pages.openStashCardView(0);
    (await clickAction(button('stashOpenPack'))); (await clickAction(button('stashOpenPack')));
    expect(base.openCardPack).not.toHaveBeenCalled(); expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('空位不足 5 格'), 'warn');
    base.stashRoom = () => 5; (await clickAction(button('stashOpenPack')));
    expect(base.openCardPack).toHaveBeenCalledExactlyOnceWith('tt-econpack', expect.arrayContaining([expect.objectContaining({ count: 1 })]));
    expect(base.openCardPack.mock.calls[0][1]).toHaveLength(5); expect(document.getElementById('cardZoom')).toBeNull();
  });
  it.each([[wood, 'stashUseMat'], [egg, 'stashHatch'], [pack, 'stashOpenPack']])('同名/同ID异variant的%s不能误消耗另一堆', async (item, action) => {
    base.data.stash = [{ card: { ...item, variantKey: 'first' }, count: 2 }, { card: { ...item, variantKey: 'second' }, count: 2 }];
    pages.openStashCardView(1); (await clickAction(button(action))); if (action === 'stashHatch') (await clickAction(button(action)));
    expect(base.useStashMaterial).not.toHaveBeenCalled(); expect(base.hatchPet).not.toHaveBeenCalled(); expect(base.openCardPack).not.toHaveBeenCalled();
    expect(ui.log).toHaveBeenCalledWith('库存引用不唯一，请刷新仓库', 'warn');
  });
});

describe('基地容量与材料信息准确性', () => {
  it('建设明确永久扩建，并区分当前容量与扩建上限', async () => {
    const { MAP } = await import('../game/src/run/game.session.js');
    Object.assign(MAP.rules,{bagMax:30,stashMax:100,bagUpgradeWood:3,stashUpgradeWood:5,stashUpgradeSlots:2});
    Object.assign(base,{bagCap:()=>16,stashCap:()=>28,canUpgradeBag:()=>true,canUpgradeStash:()=>true});
    Object.assign(base.data,{wood:20,runes:[]});
    const before=JSON.stringify(base.data);
    const { facilitiesHTML, selectFacility }=await import('../game/src/hub/hub.facilities.js');
    selectFacility('bag'); document.querySelector('.hub-page').innerHTML=facilitiesHTML();
    expect(document.querySelector('.facility-v12-caption').textContent).toContain('永久增加出征背包容量，每次出征均生效');
    expect([...document.querySelectorAll('.facility-tile b')].map(el=>el.textContent)).toEqual(['当前 16 格 · 上限 30 格','当前 28 格 · 上限 100 格']);
    expect(JSON.stringify(base.data)).toBe(before);
  });
  it('仓库明确钥匙卡需使用，展示不自行折算库存', async () => {
    Object.assign(base,{stashUsed:()=>1,stashCap:()=>28});
    base.data.keys=0; base.data.stash=[{card:{id:'key',name:'一把钥匙',type:'资源'},count:1}];
    window.SDT.Cards.cardHTML=item=>item.name;
    const {warehouseHTML}=await import('../game/src/hub/hub.warehouse.js');
    document.querySelector('.hub-page').innerHTML=warehouseHTML();
    expect(document.querySelector('.warehouse-rules').textContent).toMatch(/单击木材[、／]口粮[、／]钥匙卡使用\s*(一|1)\s*张，折入基地库存/);
    expect(base.data.keys).toBe(0); expect(base.useStashMaterial).not.toHaveBeenCalled();
  });
  it.each([['木材',3],['口粮',2],['钥匙',4]])('材料详情按已有端口显示%s收益%i，不按名称猜数值', (label,amount) => {
    base.materialInfo=()=>({label}); base.materialAmount=vi.fn(()=>amount);
    const item={id:'custom-material',name:'重命名材料',type:'资源'};
    open(item);
    expect(button('stashUseMat').textContent).toBe(`使用 1 张 → ${label} +${amount}`);
    expect(base.materialAmount).toHaveBeenCalledWith(item);
    expect(base.useStashMaterial).not.toHaveBeenCalled();
  });
  it('材料端口缺失时保留通用说明，不虚构收益',()=>{
    base.materialInfo=()=>({label:'钥匙'}); open({id:'key',name:'钥匙',type:'资源'});
    expect(button('stashUseMat').textContent).toBe('使用 1 张 → 折入基地材料');
  });
});


it('仓库资源卡单击使用一张，刷新页面，旧页面不能再消费', async () => {
  const wood={id:'wood',name:'木材',type:'资源'};
  Object.assign(base,{stashUsed:()=>1,stashCap:()=>25,materialInfo:()=>({label:'木材'})});
  base.data.stash=[{card:wood,count:1}]; window.SDT.Cards.cardHTML=item=>item.name;
  const feature=await import('../game/src/hub/hub.warehouse.js');
  document.querySelector('.hub-page').innerHTML=feature.warehouseHTML();
  const refresh=vi.fn();
  feature.bindWarehouse({ui,base,sound:{tick:vi.fn()},refresh});
  const tile=document.querySelector('.stash-cell');tile.click(); await flush();
  expect(base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('木材',false);
  expect(refresh).toHaveBeenCalledOnce();expect(document.getElementById('cardZoom')).toBeNull();
  base.slot=2;tile.click();expect(base.useStashMaterial).toHaveBeenCalledTimes(1);
});

function clickAction(element) { ui.lastAction = undefined; element.click(); return ui.lastAction; }

it('仓库确认转换读取失败保留原错误文案与库存', async () => {
  open(growth);
  await ui._acts.stashCollectOne();
  const before = structuredClone(base.data);
  ports.read.mockReturnValue({ ok: false, code: 'SAVE_FAILED' });
  await ui._acts.stashCollectOne();
  expect(ui.log).toHaveBeenCalledWith('保存失败，原布局仍然保留。', 'warn');
  expect(ports.convert).not.toHaveBeenCalled();
  expect(base.data).toEqual(before);
});
