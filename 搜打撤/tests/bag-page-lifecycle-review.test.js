import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const H = vi.hoisted(() => ({ game: {}, save: vi.fn(), uid: 0 }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { items: {} }, game: H.game, bagCap: () => 16, safeCap: () => 6, newUid: () => `new-${++H.uid}`, safeUsed: () => 0, usedSlots: () => 0, saveGame: H.save,
  cardStacks: safe => {
    const stacks = new Map(); for (const owned of H.game.ownedCards.filter(item => !!item.safe === !!safe && !item.stored)) {
      const name = owned.card.name; if (!stacks.has(name)) stacks.set(name, { card: owned.card, count: 0, uids: [] });
      stacks.get(name).count++; stacks.get(name).uids.push(owned.uid);
    } return [...stacks.values()];
  },
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen: vi.fn() }));
vi.mock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins: vi.fn(), resumeBattleRewards: vi.fn() }));
const potion = { id: 'potion', name: '药剂', type: '道具', desc: '回复 3 点生命' };
const spell = { id: 'spell', name: '法术', type: '法术' };
const resource = { id: 'wood', name: '木材卡', type: '资源' };
let bag, drag, ui, frames;
beforeEach(async () => {
  vi.resetModules(); H.save.mockReset(); H.uid = 0;
  Object.assign(H.game, { seed: 'run-1', discoveredPairs: new Set(), runActive: true, nestActive: false, state: 'idle', myClass: '法师', battleActive: false,
    inventory: [], ownedCards: [{ uid: 'potion', card: potion }, { uid: 'spell', card: spell }, { uid: 'wood', card: resource }, { uid: 'pearl', card: { id: 'tt2-pearlbox', name: '珍珠盒' } }, { uid: 'pouch', card: { id: 'tt7-stratagem', name: '法师锦囊' } }],
    usedPocket: [], cardOrder: [], hp: 10, maxHp: 30, coins: 0, fragments: 0, stackCapOf: () => 3, heal: vi.fn(n => { H.game.hp += n; }) });
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
  ui = { el: { overlay, ovBody: body }, _acts: {}, helpTopics: {}, act(name, fn) { this._acts[name] = fn; }, log: vi.fn(), refresh: vi.fn(), helpBtn: () => '', registerHelp(id, def) { this.helpTopics[id] = def; },
    showOverlay(_title, html, mode) { document.getElementById('cardZoom')?.remove(); overlay.hidden = false; overlay.classList.remove('closing'); overlay.classList.toggle('bag-full', mode === 'bagpage'); body.innerHTML = html; },
    hideOverlay() { overlay.hidden = true; },
    showCardZoom(_card, options) { document.getElementById('cardZoom')?.remove(); const zoom = document.createElement('div'); zoom.id = 'cardZoom'; zoom.classList.toggle('inventory-zoom', options.presentation === 'inventory'); zoom.innerHTML = `<button class="cz-backdrop"></button><button class="cz-close"></button><div class="cz-card"></div><div class="cz-foot">${options.footer}</div>`; zoom.querySelector('.cz-backdrop').onclick = () => { zoom.remove(); options.returnFocus?.focus(); }; document.body.append(zoom); },
  };
  body.addEventListener('click', event => { const target = event.target.closest('[data-act]'); if (target && !target.disabled) ui._acts[target.dataset.act]?.({ ...target.dataset }); });
  window.SDT = { UI: ui, game: H.game, Base: { slot: 1, bagCap: () => 16 }, Sound: { sfx: vi.fn() }, Cards: { SHA: { id: 'starter-attack', name: '初始攻击' }, cardHTML: card => `<span>${card.name}</span>`, cardBackHTML: () => '' } };
  frames = []; vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; }); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  document.elementFromPoint = vi.fn(() => null);
  bag = await import('../game/src/hub/game.bag.js'); drag = await import('../game/src/hub/game.bag.drag.js'); bag.showBackpack(true);
});
afterEach(() => { drag.resetBagDrag(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function inspect(name = potion.name) { document.querySelector(`[data-act="inspectStack"][data-name="${name}"]`).click(); }
function pointer(type, target, id = 1, x = 20) { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: id, button: 0, clientX: x, clientY: 20 }); target.dispatchEvent(event); }
function startDrag() { const source = document.querySelector('[data-stack="木材卡"]'); pointer('pointerdown', source); pointer('pointermove', window, 1, 200); frames.at(-1)(); return source; }
describe('背包旧详情/页面回调与正常返回', () => {
  it.each(['slot', 'seed', 'owned-instance', 'same-seed-run', 'page', 'zoom'])('%s变化后旧道具详情不能使用新卡或关闭新详情', change => {
    inspect(); const oldUse = ui._acts.useDetailCard;
    if (change === 'slot') window.SDT.Base.slot = 2;
    if (change === 'seed') H.game.seed = 'run-2';
    if (change === 'owned-instance') H.game.ownedCards = structuredClone(H.game.ownedCards);
    if (change === 'same-seed-run') H.game.discoveredPairs = new Set();
    if (change === 'page') ui.showOverlay('', '<div id="newPage">新页</div>');
    if (change === 'zoom') ui.showCardZoom(spell, { footer: '' });
    const currentZoom = document.getElementById('cardZoom'), before = JSON.stringify(H.game.ownedCards); oldUse();
    expect(JSON.stringify(H.game.ownedCards)).toBe(before); expect(H.game.heal).not.toHaveBeenCalled(); expect(H.save).not.toHaveBeenCalled();
    if (currentZoom) expect(document.getElementById('cardZoom')).toBe(currentZoom);
    if (change === 'page') expect(document.getElementById('newPage')).not.toBeNull();
  });
  it.each(['珍珠盒', '法师锦囊'])('退出%s后旧存入和返回不改卡、不抢页面', container => {
    inspect(container); ui._acts[container === '珍珠盒' ? 'pearlStoreZoom' : 'pouchStoreZoom']();
    const put = ui._acts[container === '珍珠盒' ? 'pearlPut' : 'pouchPut'], back = ui._acts[container === '珍珠盒' ? 'pearlBack' : 'pouchBack'];
    ui.showOverlay('', '<div id="newPage">新页</div>'); const before = JSON.stringify(H.game.ownedCards);
    put({ name: container === '珍珠盒' ? resource.name : spell.name }); back();
    expect(JSON.stringify(H.game.ownedCards)).toBe(before); expect(document.getElementById('newPage')).not.toBeNull(); expect(H.save).not.toHaveBeenCalled();
  });
  it('旧丢弃确认换局后不丢新局同名卡', async () => {
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js'); bagSlots.showDiscardConfirm(potion.name, false); const confirm = ui._acts.confirmDragDiscard;
    H.game.discoveredPairs = new Set(); H.game.ownedCards = structuredClone(H.game.ownedCards); const before = JSON.stringify(H.game.ownedCards); confirm();
    expect(JSON.stringify(H.game.ownedCards)).toBe(before); expect(H.save).not.toHaveBeenCalled();
  });
  it('帮助正常返回有效，离开帮助后旧返回不抢新页面', () => {
    const help = ui.helpTopics.bag; ui.showOverlay('', '<div class="help-body">帮助</div>'); help.back(); expect(document.querySelector('.bag-view')).not.toBeNull();
    const latest = ui.helpTopics.bag; ui.showOverlay('', '<div id="newPage">新页</div>'); latest.back(); expect(document.getElementById('newPage')).not.toBeNull();
  });
  it('正常使用与当前容器连续存取/返回保持可用', () => {
    inspect(); ui._acts.useDetailCard(); expect(H.game.hp).toBe(13);
    inspect('法师锦囊'); ui._acts.pouchStoreZoom(); ui._acts.pouchPut({ name: spell.name }); expect(H.game.ownedCards.find(item => item.card.id === 'spell').stored).toBe(1);
    ui._acts.pouchTake({ name: spell.name }); expect(H.game.ownedCards.find(item => item.card.id === 'spell').stored).toBeUndefined(); ui._acts.pouchBack(); expect(document.querySelector('.bag-view')).not.toBeNull();
  });
});
describe('背包pointer拖动取消/会话身份', () => {
  it('pointercancel释放全部浮影，随后pointerup不会落账', () => {
    startDrag(); vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('.bag-rz[data-zone="safe"]'));
    pointer('pointercancel', window); pointer('pointerup', window);
    expect(H.game.ownedCards.some(item => item.safe)).toBe(false); expect(H.save).not.toHaveBeenCalled(); expect(document.querySelector('.bag-ghost')).toBeNull(); expect(drag.bagDrag).toBeNull();
  });
  it('别的pointerup不结束当前拖动，原pointer正常落入安全格', () => {
    startDrag(); vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('.bag-rz[data-zone="safe"]'));
    pointer('pointerup', window, 2); expect(drag.bagDrag).not.toBeNull(); pointer('pointerup', window, 1);
    expect(H.game.ownedCards.find(item => item.card.id === 'wood').safe).toBe(true);
  });
  it.each(['slot', 'owned-instance', 'same-seed-run', 'page'])('%s变化后拖动释放不改新会话', change => {
    startDrag(); if (change === 'slot') window.SDT.Base.slot = 2; if (change === 'owned-instance') H.game.ownedCards = structuredClone(H.game.ownedCards); if (change === 'same-seed-run') H.game.discoveredPairs = new Set(); if (change === 'page') ui.showOverlay('', '<div id="newPage">新页</div>');
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(document.querySelector('.bag-rz[data-zone="safe"]')); const before = JSON.stringify(H.game.ownedCards); pointer('pointerup', window);
    expect(JSON.stringify(H.game.ownedCards)).toBe(before); expect(H.save).not.toHaveBeenCalled(); if (change === 'page') expect(document.getElementById('newPage')).not.toBeNull();
  });
});


describe('新号背包真实入口反馈', () => {
  const filter = value => document.querySelector(`[data-act="bagFilter"][data-f="${value}"]`).click();
  it('招式与物资按钮使用实际键值筛选，不将散装物资混入招式', () => {
    H.game.inventory = [{ name: '口粮', count: 2, value: 3 }]; bag.showBackpack(true);
    filter('move');
    expect([...document.querySelectorAll('.bag-grid [data-stack]')].map(el => el.dataset.stack)).toEqual(['法术']);
    expect(document.querySelector('.bag-grid [data-supply]')).toBeNull();
    filter('supply');
    expect(document.querySelector('.bag-grid [data-supply]').dataset.supply).toBe('口粮');
    expect(document.querySelector('.bag-grid [data-stack]')).toBeNull();
    H.game.inventory = []; filter('supply');
    expect(document.querySelector('.bag-empty2').textContent).toContain('该分类没有');
    document.querySelector('.bag-empty2 [data-f="all"]').click();
    expect(document.querySelector('[data-stack="法术"]')).not.toBeNull();
  });
  it('安全格标题容量和伙伴名称跟随分区，口袋区分火堆可复原类型与张数', () => {
    window.SDT.Base.carriedPet = () => ({ name: '旺财' });
    H.game.ownedCards[0].safe = true;
    H.game.usedPocket = [{ card: spell, count: 3 }, { card: { id: 'armor', name: '盔甲', type: '装备' }, count: 2 }];
    bag.showBackpack(true); document.querySelector('[data-zone="safe"].bag-rz').click();
    expect(document.querySelector('.bag-title h2').textContent).toContain('安全格');
    expect(document.querySelector('.bag-capchip').textContent).toMatch(/1\s*\/6 格/);
    expect(document.querySelector('.bag-znote').textContent).toContain('旺财');
    document.querySelector('[data-zone="pocket"].bag-rz').click();
    expect(document.querySelector('.bag-capchip').textContent).toContain('不限容量');
    expect(document.querySelector('.bag-znote').textContent).toContain('火堆可复原 3 张／不可复原 2 张');
    expect(document.querySelector('[data-stack="盔甲"] .bag-tstate').textContent).toBe('火堆不可复原');
  });
  it('按钮丢弃确认不误称拖拽，碎片库存与门槛分列且排序按钮有名称', () => {
    H.game.fragments = 4; bag.showBackpack(true);
    expect(document.querySelector('.bag-cur').textContent).toContain('4 枚');
    expect(document.querySelector('.bag-cur').textContent).toContain('每次需 2 枚');
    expect(document.querySelector('[data-act="bagSortCycle"]').getAttribute('aria-label')).toBeTruthy();
    inspect(); ui._acts.detailDiscard();
    expect(document.getElementById('ovBody').textContent).toContain('永久丢弃');
    expect(document.getElementById('ovBody').textContent).not.toContain('拖到了');
  });
  it('通行证B结构化使用获取传说且保留棱彩与禁随机排除规则', () => {
    const token = { id: 'tt-token-gold', name: '员工通行证B', type: '道具', rules: { bag: { use: [{ op: 'acquire', pool: { kind: 'legendary' } }] } } };
    const legend = { id: 'legend', name: '传说牌', rarity: '传说', type: '法术' };
    window.SDT.Cards.all = () => [{ ...legend, id: 'prism', rarity: '棱彩' }, { ...legend, id: 'blocked' }, legend];
    window.SDT.Cards.isRandomObtainable = c => c.id !== 'blocked';
    H.game.ownedCards = [{ uid: 'token', card: token }]; bag.showBackpack(true);
    inspect(token.name); ui._acts.useDetailCard();
    expect(H.game.ownedCards.map(item => item.card.id)).toEqual(['legend']);
    expect(document.querySelector('[role="status"]').textContent).toContain('获得传说卡【传说牌】');
    expect(H.save).toHaveBeenCalledOnce();
  });
  it('结晶使用回执保留复原名单与容量剩余，并保留装备可被结晶复原的规则', () => {
    H.game.ownedCards = [{ uid: 'crystal', card: { id: 'tt-crystal', name: '能源结晶', type: '道具', rules: { bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } } } }];
    H.game.usedPocket = [{ card: { id: 'armor', name: '盔甲', type: '装备' }, count: 1 }, { card: spell, count: 3 }];
    bag.showBackpack(true); inspect('能源结晶'); ui._acts.useDetailCard();
    expect(H.game.ownedCards.map(item => item.card.name)).toEqual(['盔甲', '法术', '法术']);
    expect(document.querySelector('[role="status"]').textContent).toContain('3 张卡牌：盔甲、法术、法术');
    filter('move'); expect(document.querySelector('[role="status"]').textContent).toContain('盔甲');
    H.game.ownedCards = []; bag.showBackpack(true); expect(document.querySelector('[role="status"]')).toBeNull();
  });
});


describe('背包键盘查看与分区焦点', () => {
  it('随身详情接入完整阅读栏并在注册后捕获当前动作，不改卡牌或存档', () => {
    const longText = '回复 3 点生命。' + '获得护甲并保留完整说明。'.repeat(20);
    H.game.ownedCards[0].card = { ...potion, desc: longText };
    const before = JSON.stringify(H.game.ownedCards); bag.showBackpack(true); inspect();
    const zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('.inventory-zoom-rules').textContent).toBe(longText);
    expect(zoom.querySelector('.inventory-zoom-info .cz-foot [data-act="useDetailCard"]')).not.toBeNull();
    expect(zoom.querySelector('.inventory-zoom-info .cz-close')).not.toBeNull();
    expect(zoom._inventoryActions.useDetailCard).toBe(ui._acts.useDetailCard);
    expect(JSON.stringify(H.game.ownedCards)).toBe(before); expect(H.save).not.toHaveBeenCalled();
    zoom._inventoryActions.useDetailCard(); expect(H.game.hp).toBe(13);
  });
  it('安全格与消耗区也保留全文阅读，安全格移回按钮与消耗区限制保持原语义', () => {
    H.game.ownedCards[0].safe = true; H.game.ownedCards[0].card = { ...potion, desc: '回复 3 点生命' };
    H.game.usedPocket = [{ card: { id: 'armor', name: '盔甲', type: '装备', desc: '获得 4 点护甲' }, count: 2 }];
    bag.showBackpack(true); document.querySelector('.bag-rz[data-zone="safe"]').click(); inspect();
    let zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('.inventory-zoom-rules').textContent).toBe('回复 3 点生命');
    expect(zoom._inventoryActions.zoomMoveToBag).toBe(ui._acts.zoomMoveToBag);
    expect(zoom.querySelector('[data-act="useDetailCard"]')).toBeNull();
    zoom.querySelector('.cz-backdrop').click(); document.querySelector('.bag-rz[data-zone="pocket"]').click(); inspect('盔甲');
    zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('.inventory-zoom-rules').textContent).toBe('获得 4 点护甲');
    expect(zoom.querySelector('.inventory-zoom-info .cz-foot').textContent).toContain('火堆不可复原；能源结晶');
    expect(zoom.querySelector('.cz-foot [data-act]')).toBeNull();
  });
  it.each(['Enter', ' '])('%s 查看详情再关闭返回来源卡格，不重复触发', key => {
    const tile = document.querySelector('[data-stack="药剂"]'); tile.focus();
    expect(tile.getAttribute('role')).toBe('button'); expect(tile.getAttribute('aria-label')).toContain('查看药剂');
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); tile.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(document.querySelectorAll('#cardZoom')).toHaveLength(1);
    document.querySelector('#cardZoom .cz-backdrop').click(); expect(document.activeElement).toBe(tile);
  });
  it('分区切换保留当前分区按钮焦点，口袋卡可键盘查看但不能拖动或使用', () => {
    H.game.usedPocket = [{ card: { id: 'armor', name: '盔甲', type: '装备' }, count: 2 }]; bag.showBackpack(true);
    document.querySelector('.bag-rz[data-zone="pocket"]').click();
    expect(document.activeElement).toBe(document.querySelector('.bag-rz[data-zone="pocket"]'));
    expect(document.activeElement.getAttribute('aria-pressed')).toBe('true');
    const tile = document.querySelector('[data-stack="盔甲"]'); pointer('pointerdown', tile); expect(drag.bagDrag).toBeNull();
    tile.focus(); tile.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(document.querySelector('#cardZoom').textContent).toContain('火堆不可复原；能源结晶');
    expect(document.querySelector('#cardZoom [data-act="useDetailCard"]')).toBeNull();
    document.querySelector('#cardZoom .cz-backdrop').click(); expect(document.activeElement).toBe(tile);
  });
  it('卡格去掉卡面内部重复Tab停靠，不嵌套焦点控件', () => {
    window.SDT.Cards.cardHTML = card => `<div><div tabindex="0">${card.name}</div></div>`; bag.showBackpack(true);
    expect(document.querySelector('.bag-tile [tabindex]')).toBeNull();
  });
});
