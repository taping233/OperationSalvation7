// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const ports = vi.hoisted(() => ({ read: vi.fn(), select: vi.fn() }));
let harness;
beforeEach(() => { ports.read.mockReset(); ports.select.mockReset(); ports.read.mockReturnValue({ ok:true, revision:1 }); });
afterEach(() => { harness?.runtime.closeBase(); harness = null; vi.restoreAllMocks(); document.body.replaceChildren(); });
async function createBrowsingHarness() {
  vi.resetModules();
  let activeSlot = 1;
  const stored = new Map();
  const freshData = () => ({ appearance: {}, wood: 1, rations: 0, coins: 100, keys: 0, stash: [], pocket: [] });
  const host = document.createElement('div'); host.id = 'overlay';
  document.body.replaceChildren(host);
  const ui = {
    el: { overlay: host, ovBody:host }, _acts: {},
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
    keyCount: () => 0, pocketKeyCost: stack => stack.count || 1, stashUsed: () => 0, stashCap: () => 25, stashRoom: () => 25,
    ownedPets: () => [], bagCap:() => 16, canUpgradeBag:() => false, canUpgradeStash:() => false,
    restore: vi.fn(() => true), upgradeBag: vi.fn(() => true), upgradeStash: vi.fn(() => true),
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
    MAP: { rules: { bagMax:30, stashMax:100, bagUpgradeWood:2, stashUpgradeWood:2, stashUpgradeSlots:3, safeStart:2, safeMax:6 }, items: { wood: { name: '木材' }, rations: { name: '口粮' } } },
    game: { state: '' }, getActiveSlot: () => activeSlot,
    startNewGame: vi.fn(), setLobby: vi.fn(),
  }));
  vi.doMock('../game/src/hub/game.cardslib.js', () => ({
    Sfx: { ding: vi.fn(), tick: vi.fn() }, configureCardNavigation: vi.fn(), _set_cardPageOpen: vi.fn(),
  }));
  vi.doMock('../game/src/hub/base.commands.js', () => ({ readBase: ports.read, readBaseReceipt: vi.fn(), commitBase: vi.fn() }));
  vi.doMock('../game/src/hub/collection.commands.js', () => ({
    convertCollection: vi.fn(), getCharacter: vi.fn(), getCollection: vi.fn(), selectSkin: ports.select, stackKeyOf: stack => `card:${stack.card.id}${stack.card.variantKey ? ':' + stack.card.variantKey : ''}`,
  }));
  for (const retired of ['home/home.commands', 'home/home.presenter', 'home/home.catalog', 'home/home.scene', 'home/home.visuals', 'hub/game.hub.home-scene']) {
    vi.doMock(`../game/src/${retired}.js`, () => { throw new Error(`Retired module evaluated: ${retired}`); });
  }
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


describe('伙伴升级回执', () => {
  it('升级未随行伙伴时按目标伙伴显示容量前后和实际口粮消费', async () => {
    harness = await createBrowsingHarness();
    const robot = {id:'robot',name:'机器人'};let level=1;
    Object.assign(harness.base, {
      petById: id => id==='robot'?robot:null, petLevel: () => level, petUpCost: () => 2,
      safeCap: () => 2, upgradePet: vi.fn(() => {level=2;return true;}),
    });
    harness.runtime.openBaseHub('stash');(await harness.ui._acts.upPet({id:'robot'}));
    expect(harness.ui.log).toHaveBeenLastCalledWith(expect.stringContaining('携带时安全格 2 → <b>3</b> 格（口粮 −2）'), 'ok');
    expect(harness.host.textContent).toContain('机器人 Lv.1 → Lv.2 · 安全格 2 → 3 · 口粮 −2');
  });
  it('升级未保存时不展示成功成长或消费', async () => {
    harness = await createBrowsingHarness();
    Object.assign(harness.base, {
      petById: () => ({id:'robot',name:'机器人'}),petLevel: () => 1,petUpCost: () => 2,
      upgradePet: vi.fn(() => false),
    });
    harness.runtime.openBaseHub('stash');(await harness.ui._acts.upPet({id:'robot'}));
    expect(harness.host.textContent).toContain('还需 2 口粮，补充后可培养。');
    expect(harness.host.textContent).not.toContain('机器人 Lv.');
  });
});

describe('基地恢复、扩建与外观旧动作', () => {
  const pocketCard = { id:'audit-pocket', name:'待复原测试', type:'法术', rarity:'古朴' };
  it.each(['restoreCard', 'upBag', 'upStash'])('换档之后旧%s不能调用新档业务命令', async action => {
    harness = await createBrowsingHarness(); harness.base.data.pocket = [{ card:pocketCard, count:2 }];
    harness.runtime.openBaseHub('stash'); const previous = harness.ui._acts[action];
    harness.useSlot(2); harness.base.data.pocket = [{ card:pocketCard, count:2 }];
    (await previous({ name:pocketCard.name }));
    expect(harness.base.restore).not.toHaveBeenCalled(); expect(harness.base.upgradeBag).not.toHaveBeenCalled(); expect(harness.base.upgradeStash).not.toHaveBeenCalled();
  });
  it('关基地后旧扩建回调不能再调用命令或重开基地', async () => {
    harness = await createBrowsingHarness(); harness.runtime.openBaseHub('stash'); const previous = harness.ui._acts.upStash;
    harness.runtime.closeBase(); (await previous()); expect(harness.base.upgradeStash).not.toHaveBeenCalled(); expect(harness.host.querySelector('#hubMain')).toBeNull();
  });
  it('合法复原仍调用真实当前索引；后续旧回调不能重复提交同名新堆', async () => {
    harness = await createBrowsingHarness(); harness.base.pocketKeyCost = stack => stack.count;
    harness.base.data.pocket = [{ card:pocketCard, count:2 }]; harness.runtime.openBaseHub('stash');
    harness.ui.showCardZoom(pocketCard); const previous = harness.ui._acts.restoreCard; (await previous({ name:pocketCard.name }));
    expect(harness.base.restore).toHaveBeenCalledExactlyOnceWith(0);
    (await previous({ name:pocketCard.name })); expect(harness.base.restore).toHaveBeenCalledTimes(1);
  });
  it.each(['slot', 'room', 'closed'])('外观保存晚到%s之后不能播报旧选择或重绘', async kind => {
    harness = await createBrowsingHarness(); let finish;
    ports.select.mockImplementation(() => new Promise(resolve => { finish=resolve; }));
    harness.runtime.openBaseHub('stash'); const pending=harness.ui._acts.selectCharacterSkin({ character:'wu', skin:'casual' });
    if (kind==='slot') harness.useSlot(2);
    if (kind==='room') harness.runtime.openBaseHub('upgrade');
    if (kind==='closed') harness.runtime.closeBase();
    harness.ui.log.mockClear(); finish({ ok:true, value:{ assetFallback:false } }); await pending;
    expect(harness.ui.log).not.toHaveBeenCalled(); if(kind==='closed') expect(harness.host.querySelector('#hubMain')).toBeNull();
  });
  it('合法当前外观保存仍播报结果', async () => {
    harness = await createBrowsingHarness(); ports.select.mockResolvedValue({ ok:true, value:{ assetFallback:false } });
    harness.runtime.openBaseHub('stash'); await harness.ui._acts.selectCharacterSkin({ character:'wu', skin:'casual' });
    expect(harness.host.textContent).toContain('人物外观已保存。');
  });
});


it('复原稳定引用在索引移动之后只提交预览的ID和variant堆', async () => {
  harness=await createBrowsingHarness(); harness.base.pocketKeyCost=stack=>stack.count;
  const first={card:{id:'same-id',variantKey:'first',name:'同名'},count:9};
  const second={card:{id:'same-id',variantKey:'second',name:'同名'},count:2};
  harness.base.data.pocket=[first,second]; harness.runtime.openBaseHub('stash');
  harness.ui.showCardZoom(harness.base.data.pocket.at(-1).card);
  (await harness.ui._acts.restoreCard({stackKey:'card:same-id:second',count:'2',name:'同名',i:'0'}));
  expect(harness.base.restore).toHaveBeenCalledExactlyOnceWith(1);
});
it('预览以后数量改变不会按更新整堆意外扣钥匙', async () => {
  harness=await createBrowsingHarness(); harness.base.data.pocket=[{card:{id:'card',name:'复原'},count:3}]; harness.runtime.openBaseHub('stash');
  harness.ui.showCardZoom(harness.base.data.pocket[0].card);
  (await harness.ui._acts.restoreCard({stackKey:'card:card',count:'2',name:'复原',i:'0'}));
  expect(harness.base.restore).not.toHaveBeenCalled(); expect(harness.ui.log).toHaveBeenCalledWith('待复原数量已变化，请重新选择卡牌。','warn');
});
it('基地复原用支付前的卡面与钥匙费用演出，结束后才重绘且不重复提交',async()=>{
  vi.useFakeTimers();
  try{
    harness=await createBrowsingHarness();
    harness.base.pocketKeyCost=stack=>stack.count;
    harness.base.data.pocket=[{card:{id:'receipt-card',name:'恢复样本'},count:2}];
    harness.runtime.openBaseHub('stash');
    harness.ui.el.ovBody=harness.host;
    harness.ui.el.ovBody.firstElementChild.animate=vi.fn();
    harness.ui.showCardZoom(harness.base.data.pocket[0].card);
    const action=harness.ui._acts.restoreCard;
    const result=action({stackKey:'card:receipt-card',count:'2',name:'恢复样本',i:'0'});
    await Promise.resolve();await Promise.resolve();
    expect(document.querySelector('.outcome-feedback').textContent).toContain('钥匙 −2');
    expect(document.querySelector('.outcome-feedback').textContent).toContain('已回到仓库');
    await action({stackKey:'card:receipt-card',count:'2',name:'恢复样本',i:'0'});
    expect(harness.base.restore).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(900);await result;
    expect(document.querySelector('.outcome-feedback')).toBeNull();
    expect(harness.base.restore).toHaveBeenCalledOnce();
  }finally{vi.clearAllTimers();vi.useRealTimers();}
});
it('同页重绘后最新扩建handler仍能正常提交，旧handler已失效', async () => {
  harness=await createBrowsingHarness(); harness.runtime.openBaseHub('stash'); const previous=harness.ui._acts.upStash;
  (await previous()); expect(harness.base.upgradeStash).toHaveBeenCalledTimes(1); (await previous()); expect(harness.base.upgradeStash).toHaveBeenCalledTimes(1);
  (await harness.ui._acts.upStash()); expect(harness.base.upgradeStash).toHaveBeenCalledTimes(2);
});
it('合法外观保存抛错给失败反馈并允许重新提交', async () => {
  harness=await createBrowsingHarness(); harness.runtime.openBaseHub('stash'); ports.select.mockRejectedValueOnce(new Error('disk'));
  await harness.ui._acts.selectCharacterSkin({character:'wu',skin:'casual'});
  expect(harness.host.textContent).toContain('人物外观未保存，请重试。');
  ports.select.mockResolvedValue({ok:true,value:{assetFallback:false}});
  await harness.ui._acts.selectCharacterSkin({character:'wu',skin:'casual'}); expect(ports.select).toHaveBeenCalledTimes(2);
});

it('当前返回基地动作仍到出发主页；换档后的旧返回不抢新页', async () => {
  harness=await createBrowsingHarness(); harness.runtime.openBaseHub('stash'); const previous=harness.ui._acts.hubHome;
  const root=harness.host.querySelector('#hubMain'); harness.useSlot(2); (await previous()); expect(harness.host.querySelector('#hubMain')).toBe(root);
  harness.runtime.openBaseHub('stash'); (await harness.ui._acts.hubHome()); expect(harness.host.querySelector('#hubMain').dataset.page).toBe('deploy');
});

it('现行皮肤选择读取失败仍使用原错误文案且不调用选择命令', async () => {
  harness = await createBrowsingHarness();
  harness.runtime.openBaseHub('stash');
  ports.read.mockReturnValue({ ok: false, code: 'STALE_REVISION' });
  await harness.ui._acts.selectCharacterSkin({ character: 'wu', skin: 'casual' });
  expect(harness.host.textContent).toContain('基地资料已变化，请刷新后重试。');
  expect(ports.select).not.toHaveBeenCalled();
});
