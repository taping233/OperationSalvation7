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
  ui = { el: { overlay, ovBody: body }, _acts: {}, helpTopics: {}, act(name, fn) { this._acts[name] = fn; }, log: vi.fn(), refresh: vi.fn(), helpBtn: id => `<button class="help-btn" data-help="${id}">?</button>`, registerHelp(id, def) { this.helpTopics[id] = def; },
    showOverlay(_title, html, mode) { document.getElementById('cardZoom')?.remove(); overlay.hidden = false; overlay.classList.remove('closing'); overlay.classList.toggle('bag-full', mode === 'bagpage'); body.innerHTML = html; },
    hideOverlay() { overlay.hidden = true; },
    showCardZoom(_card, options) { document.getElementById('cardZoom')?.remove(); const zoom = document.createElement('div'); zoom.id = 'cardZoom'; zoom.classList.toggle('inventory-zoom', options.presentation === 'inventory'); zoom.innerHTML = `<button class="cz-backdrop"></button><button class="cz-close"></button><div class="cz-card"></div><div class="cz-foot">${options.footer}</div>`; zoom.querySelector('.cz-backdrop').onclick = () => { zoom.remove(); options.returnFocus?.focus(); }; document.body.append(zoom); },
  };
  body.addEventListener('click', event => { const target = event.target.closest('[data-act]'); if (target && !target.disabled) ui._acts[target.dataset.act]?.({ ...target.dataset }); });
  window.SDT = { UI: ui, game: H.game, Base: { slot: 1, bagCap: () => 16 }, Icons: { rich: markup => markup }, Sound: { sfx: vi.fn() }, Cards: { SHA: { id: 'starter-attack', name: '初始攻击' }, cardHTML: card => `<span>${card.name}</span>`, cardBackHTML: () => '' } };
  frames = []; vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; }); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  document.elementFromPoint = vi.fn(() => null);
  bag = await import('../game/src/hub/game.bag.js'); drag = await import('../game/src/hub/game.bag.drag.js'); bag.showBackpack(true);
});
afterEach(() => { drag.resetBagDrag(); document.body.replaceChildren(); vi.unstubAllGlobals(); });
function inspect(name = potion.name) { document.querySelector(`[data-act="inspectStack"][data-name="${name}"]`).click(); }
function pointer(type, target, id = 1, x = 20) { const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { pointerId: id, button: 0, clientX: x, clientY: 20 }); target.dispatchEvent(event); }
function startDrag() { const source = document.querySelector('[data-stack="木材卡"]'); pointer('pointerdown', source); pointer('pointermove', window, 1, 200); frames.at(-1)(); return source; }
describe('背包旧详情/页面回调与正常返回', () => {
  it('神秘药水地图详情禁用，直接旧回调也不消费/回血/发金币', () => {
    const mystery = { id:'tt3-mystery-potion', name:'神秘药水', type:'道具', desc:'随机神秘效果。' };
    H.game.ownedCards = [{ uid:'mystery', card:mystery }];
    bag.showBackpack(true); inspect(mystery.name);
    const button = document.querySelector('[data-act="useDetailCard"]');
    expect(button.disabled).toBe(true); expect(button.textContent).toContain('仅战斗');
    ui._acts.useDetailCard();
    expect(H.game.ownedCards).toHaveLength(1); expect(H.game.coins).toBe(0);
    expect(H.game.heal).not.toHaveBeenCalled(); expect(H.save).not.toHaveBeenCalled();
  });

  it.each([['cmtn6bge52qt', 2, 0], ['cmtn6bge52qt', 2, 1], ['cmtn6bge52qt', 2, 3], ['tt-crystal', 3, 0], ['tt-crystal', 3, 1], ['tt-crystal', 3, 4]])('%s地图消耗区 %s上限/%s张时的详情按钮和执行守卫', (id, amount, count) => {
    const restore = { id, name: id === 'tt-crystal' ? '能源结晶' : '复原药水', type: '道具', rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount }] } } };
    H.game.ownedCards = [{ uid: 'restore', card: restore }];
    H.game.usedPocket = count ? [{ card: spell, count }] : [];
    bag.showBackpack(true); inspect(restore.name);
    expect(document.querySelector('[data-act="useDetailCard"]').disabled).toBe(count === 0);
    // Direct callback invocation also exercises the execution guard, independent of disabled UI.
    ui._acts.useDetailCard();
    expect(H.game.ownedCards.some(entry => entry.uid === 'restore')).toBe(count === 0);
    expect(H.game.ownedCards.filter(entry => entry.card.id === spell.id)).toHaveLength(Math.min(count, amount));
    expect(H.game.usedPocket.reduce((n, entry) => n + entry.count, 0)).toBe(Math.max(0, count - amount));
    expect(H.save).toHaveBeenCalledTimes(count ? 1 : 0);
  });
  it.each([false, true])('战斗中的通用背包入口拒绝打开/刷新（刷新=%s），不转发旧战斗背包命令', refresh => {
    ui.hideOverlay(); H.game.battleActive = true;
    const openBag = vi.fn(); window.SDT.Battle = { commands:{ openBag } };
    const before = ui.el.ovBody.innerHTML;
    bag.showBackpack(refresh);
    expect(ui.el.overlay.hidden).toBe(true);expect(ui.el.ovBody.innerHTML).toBe(before);
    expect(openBag).not.toHaveBeenCalled();expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('战斗中无法打开背包'), 'warn');
  });
  it('战斗已经接管时，旧背包详情和底层丢弃/跨区/排序入口不能变更卡牌', async () => {
    inspect(); const use = ui._acts.useDetailCard;
    H.game.battleActive = true;
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const before = JSON.stringify(H.game.ownedCards);
    use();expect(H.game.discardCard(potion.name)).toBe(false);
    bagSlots.moveStackSafe(potion.name, true);bagSlots.moveStackOrder(potion.name, spell.name);
    expect(JSON.stringify(H.game.ownedCards)).toBe(before);expect(H.game.heal).not.toHaveBeenCalled();expect(H.save).not.toHaveBeenCalled();
  });
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
  it('锦囊使用显式安全取消入口，与珍珠盒一样可由共享 Esc 返回背包', async () => {
    inspect('法师锦囊'); ui._acts.pouchStoreZoom();
    const { overlayMethods } = await import('../game/src/ui/overlay.js');
    ui._lastMode = undefined;
    ui._findCancelBtn = overlayMethods._findCancelBtn;
    const back = ui._findCancelBtn();
    expect(back.dataset.act).toBe('pouchBack'); expect(back.dataset.cancel).toBe('true');
    expect(overlayMethods.closeTopOverlayByEsc.call(ui)).toBe(true);
    expect(document.querySelector('.bag-view')).not.toBeNull();
  });
  it.each([['珍珠盒', 'pearl', 'wood'], ['法师锦囊', 'pouch', 'spell']])('%s真实入口共用面板，帮助折叠、详情不搬牌', (name, prefix, uid) => {
    inspect(name); ui._acts[`${prefix}StoreZoom`]();
    expect(document.querySelector('.battle-decision-unified.container-store')).not.toBeNull();
    expect(document.querySelector('.container-store-help').open).toBe(false);
    expect(document.querySelector(`[data-act="${prefix}Back"]`).dataset.cancel).toBe('true');
    const before = JSON.stringify(H.game.ownedCards);
    const button = document.querySelector(`[data-act="${prefix}Inspect"]`);
    ui._acts[`${prefix}Inspect`](button.dataset);
    expect(document.getElementById('cardZoom')).not.toBeNull();
    expect(JSON.stringify(H.game.ownedCards)).toBe(before);
    expect(H.game.ownedCards.find(x => x.uid === uid).stored).toBeUndefined();
  });
  it.each([['珍珠盒', 'pearl', resource, 9], ['法师锦囊', 'pouch', spell, 3]])('%s整叠超容量在动作旁显示原因且禁用', (name, prefix, card, limit) => {
    H.game.ownedCards.push(...Array.from({ length: limit }, (_, i) => ({ uid: `stored-${i}`, card, stored: 1, ...(prefix === 'pouch' ? { pouchOf: 'tt7-stratagem' } : {}) })));
    inspect(name); ui._acts[`${prefix}StoreZoom`]();
    expect(document.querySelector(`[data-act="${prefix}Put"]`).disabled).toBe(true);
    expect(document.querySelector('.container-store-blocked').textContent).toContain('放不下整叠');
    const before = JSON.stringify(H.game.ownedCards);
    ui._acts[`${prefix}Put`]({ name: card.name });
    expect(JSON.stringify(H.game.ownedCards)).toBe(before);
  });
  it.each([['珍珠盒', 'pearl', resource], ['法师锦囊', 'pouch', spell]])('%s连续存取保留滚动、说明展开及安全返回焦点', (name, prefix, card) => {
    inspect(name); ui._acts[`${prefix}StoreZoom`]();
    const body = ui.el.ovBody, help = body.querySelector('details');
    help.open = true; body.scrollTop = 120;
    body.querySelector('.battle-decision-content').scrollTop = 75;
    body.querySelector('.pearl-store-list').scrollTop = 35;
    const put = body.querySelector(`[data-act="${prefix}Put"][data-name="${card.name}"]`); put.focus(); put.click();
    expect(body.querySelector('details').open).toBe(true);
    expect(body.scrollTop).toBe(120); expect(body.querySelector('.pearl-store-list').scrollTop).toBe(35);
    expect(body.querySelector('.battle-decision-content').scrollTop).toBe(75);
    expect(document.activeElement.dataset.act).toBe(`${prefix}Back`);
    const take = body.querySelector(`[data-act="${prefix}Take"][data-name="${card.name}"]`); take.focus(); take.click();
    expect(body.querySelector('details').open).toBe(true);
    expect(document.activeElement.dataset.act).toBe(`${prefix}Back`);
  });
  it.each([['珍珠盒', 'pearl', resource], ['法师锦囊', 'pouch', spell]])('%s重绘后旧详情回调不能打开旧牌', (name, prefix, card) => {
    inspect(name); ui._acts[`${prefix}StoreZoom`]();
    const staleInspect = ui._acts[`${prefix}Inspect`];
    ui._acts[`${prefix}Put`]({ name:card.name });
    staleInspect({ i:'0' });
    expect(document.getElementById('cardZoom')).toBeNull();
    ui._acts[`${prefix}Inspect`]({ i:'0' });
    expect(document.getElementById('cardZoom')).not.toBeNull();
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
  it('招式不混入散装物资，全部保留物资和生物且不单设筛选入口', () => {
    H.game.inventory = [{ name: '口粮', count: 2, value: 3 }];
    H.game.ownedCards.push({ uid:'creature', card:{ id:'creature', name:'生物牌', type:'生物' } });
    bag.showBackpack(true);
    expect([...document.querySelectorAll('.bag-tools [data-act="bagFilter"]')].map(button => button.dataset.f)).toEqual(['all', 'move', '装备', '道具', '资源']);
    expect(document.querySelector('.bag-grid [data-supply]').dataset.supply).toBe('口粮');
    expect(document.querySelector('[data-stack="生物牌"]')).not.toBeNull();
    filter('move');
    expect([...document.querySelectorAll('.bag-grid [data-stack]')].map(el => el.dataset.stack)).toEqual(['法术']);
    expect(document.querySelector('.bag-grid [data-supply]')).toBeNull();
    filter('资源');
    expect([...document.querySelectorAll('.bag-grid [data-stack]')].map(el => el.dataset.stack)).toEqual(['木材卡']);
    expect(document.querySelector('.bag-grid [data-supply]')).toBeNull();
    filter('装备');
    expect(document.querySelector('.bag-empty2').textContent).toContain('该分类没有');
    document.querySelector('.bag-empty2 [data-f="all"]').click();
    expect(document.querySelector('[data-stack="法术"]')).not.toBeNull();
    expect(document.querySelector('[data-stack="生物牌"]')).not.toBeNull();
    expect(document.querySelector('.bag-grid [data-supply]').dataset.supply).toBe('口粮');
  });
  it('安全格和口袋显示真实容量张数与复原角标，伙伴及复原说明保留在帮助', () => {
    window.SDT.Base.carriedPet = () => ({ name: '旺财' });
    H.game.ownedCards[0].safe = true;
    H.game.usedPocket = [{ card: spell, count: 3 }, { card: { id: 'armor', name: '盔甲', type: '装备' }, count: 2 }];
    bag.showBackpack(true); document.querySelector('[data-zone="safe"].bag-rz').click();
    expect(document.querySelector('.bag-title h2').textContent).toContain('安全格');
    expect(document.querySelector('.bag-capchip').textContent).toMatch(/1\s*\/6 格/);
    expect(document.querySelector('.bag-count-summary').textContent).toMatch(/卡牌\s*1\s*张/);
    expect(document.querySelector('.bag-title .help-btn').dataset.help).toBe('bag');
    const help = document.createElement('section'); help.innerHTML = ui.helpTopics.bag.html;
    expect(help.textContent).toContain('由旺财看守');
    expect(help.textContent).toContain('只有安全格里的卡牌会被抢运回基地');
    expect(help.textContent).toContain('道具和装备不能在火堆复原');
    expect(help.textContent).toContain('能源结晶按消耗区顺序复原最多 3 张');
    expect(help.textContent).toContain('撤离时每张仅 1/3 概率带回基地消耗区');
    document.querySelector('[data-zone="pocket"].bag-rz').click();
    expect(document.querySelector('.bag-capchip').textContent).toContain('不限容量');
    expect(document.querySelector('.bag-capchip b').textContent).toBe('5');
    expect(document.querySelector('[data-stack="法术"] .bag-tct').textContent).toBe('×3');
    expect(document.querySelector('[data-stack="盔甲"] .bag-tct').textContent).toBe('×2');
    expect(document.querySelector('[data-stack="法术"] .bag-tstate').textContent).toBe('火堆可复原');
    expect(document.querySelector('[data-stack="盔甲"] .bag-tstate').textContent).toBe('火堆不可复原');
    expect(document.querySelectorAll('.bag-znote, .bag-disclosure')).toHaveLength(0);
  });
  it('按钮丢弃确认不误称拖拽，按反馈移除货币栏且排序按钮有名称', () => {
    H.game.fragments = 4; bag.showBackpack(true);
    expect(document.querySelector('.bag-cur')).toBeNull();
    expect(H.game.fragments).toBe(4);
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

describe('地图道具角标与详情用途一致', () => {
  const rule = use => ({ version: 1, bag: { use } });
  it.each([
    ['神秘药水', { id: 'tt3-mystery-potion' }, '战斗使用', true],
    ['剧毒药水', { rules: rule([{ op: 'curse', curse: 'poison', stacks: 1, target: 'allEnemies' }]) }, '战斗使用', true],
    ['治疗药', { rules: rule([{ op: 'heal', amount: 3 }]) }, '可用', false],
    ['复原药', { rules: rule([{ op: 'restoreConsumed', amount: 2 }]) }, '可用', false],
    ['通行证', { rules: rule([{ op: 'acquire', pool: { kind: 'legendary' }, n: 1 }]) }, '可用', false],
    ['觉醒药', { rules: rule([{ op: 'acquire', pool: { kind: 'classAbility' }, n: 1 }]) }, '可用', false],
    ['混合药', { rules: rule([{ op: 'heal', amount: 3 }, { op: 'energy', amount: 1 }]) }, '可用', false],
    ['旧文本药', { desc: '回复 3 点生命' }, '查看用法', false],
    ['未知用法', {}, '查看用法', false],
  ])('%s只描述已有地图用途，查看不消耗', (name, fields, label, disabled) => {
    const card = { id: `item-${name}`, name, type: '道具', ...fields };
    H.game.ownedCards = [{ uid: 'item', card }];
    const before = JSON.stringify(H.game.ownedCards);
    bag.showBackpack(true);
    expect(document.querySelector('.bag-tstate').textContent).toBe(label);
    inspect(name);
    const button = document.querySelector('#cardZoom [data-act="useDetailCard"]');
    expect(button.disabled).toBe(disabled);
    if (disabled) expect(button.textContent).toBe('仅战斗中使用');
    expect(JSON.stringify(H.game.ownedCards)).toBe(before);
    expect(H.game.hp).toBe(10);
    expect(H.save).not.toHaveBeenCalled();
  });

  it('战斗道具在安全格与消耗区仍优先显示原区域说明', async () => {
    const { tileHTML } = await import('../game/src/hub/game.bag.view2.js');
    const card = { id: 'tt3-mystery-potion', name: '神秘药水', type: '道具' };
    const tile = { card, name: card.name, type: card.type, count: 1 };
    expect(tileHTML({ ...tile, zone: 'safe', safe: true })).toContain('>押运</span>');
    expect(tileHTML({ ...tile, zone: 'pocket' })).toContain('>火堆不可复原</span>');
  });
});

describe('shared token crafting through live stack zoom', () => {
  const gold={id:'tt-token-gold',name:'员工通行证B',type:'道具'};
  const color={id:'tt-token-color',name:'员工通行证A',type:'道具'};
  const final={id:'cmtmvq6ss84l',name:'觉醒通行证',type:'道具'};
  function prepare(kind) {
    H.game.ownedCards=kind==='gold'?[1,2,3,4].map(i=>({uid:`g${i}`,card:gold})):[{uid:'a1',card:color},{uid:'a2',card:color,safe:true}];
    H.game.fragments=4;window.SDT.Cards.all=()=>[color,final];bag.showBackpack(true);
    inspect(kind==='gold'?gold.name:color.name);
    return ui._acts[kind==='gold'?'craftColorToken':'craftColorTokenByFragments'];
  }
  it.each(['gold','fragments'])('%s recipe allocates and saves exactly once; repeated old callback is inert', kind => {
    const act=prepare(kind);act();
    expect(H.uid).toBe(1);expect(H.save).toHaveBeenCalledOnce();
    expect(ui.log.mock.calls.filter(([,level])=>level==='loot')).toHaveLength(1);
    expect(H.game.ownedCards.map(o=>o.uid)).toEqual(kind==='gold'?['g4','new-1']:['a2','new-1']);
    expect(H.game.fragments).toBe(kind==='gold'?4:2);
    expect(H.game.ownedCards.at(-1).safe).toBeUndefined();
    expect(document.getElementById('cardZoom')).toBeNull();
    act();expect(H.uid).toBe(1);expect(H.save).toHaveBeenCalledOnce();
  });
  it.each(['gold','fragments'])('%s missing output never consumes, allocates, saves or logs success', kind => {
    const act=prepare(kind), before=structuredClone(H.game.ownedCards);window.SDT.Cards.all=()=>[];act();
    expect(H.game.ownedCards).toEqual(before);expect(H.game.fragments).toBe(4);expect(H.uid).toBe(0);expect(H.save).not.toHaveBeenCalled();
    expect(ui.log.mock.calls.some(([,level])=>level==='loot')).toBe(false);
  });
  it('live in-place material removal and fragment depletion are checked after opening', () => {
    let act=prepare('gold');H.game.ownedCards.splice(0,2);const remaining=H.game.ownedCards.slice();act();
    expect(H.game.ownedCards).toEqual(remaining);expect(H.save).not.toHaveBeenCalled();
    act=prepare('fragments');H.game.fragments=1;act();
    expect(H.game.ownedCards).toHaveLength(2);expect(H.game.fragments).toBe(1);expect(H.uid).toBe(0);expect(H.save).not.toHaveBeenCalled();
  });
});

describe('retained backpack pane across actions', () => {
  it.each(['safe','pearl'])('drag to %s retains unaffected cards/scroll and updates source state', destination => {
    const board=document.querySelector('.bag-board'),grid=document.querySelector('.bag-grid'),potionTile=document.querySelector('[data-stack="药剂"]');
    board.scrollTop=167;potionTile.focus();startDrag();
    document.elementFromPoint.mockReturnValue(document.querySelector(destination==='safe'?'.bag-rz[data-zone="safe"]':'[data-stack="珍珠盒"]'));
    pointer('pointerup',window,1,200);
    expect(document.querySelector('.bag-board')).toBe(board);expect(document.querySelector('.bag-grid')).toBe(grid);expect(document.querySelector('[data-stack="药剂"]')).toBe(potionTile);expect(board.scrollTop).toBe(167);expect(document.activeElement).toBe(potionTile);
    expect(document.querySelector('[data-stack="木材卡"]')).toBeNull();expect(H.game.ownedCards.find(o=>o.uid==='wood')[destination==='safe'?'safe':'stored']).toBeTruthy();expect(drag.bagDrag).toBeNull();
  });
  it('repeated retained-grid refresh binds keyboard and pointer once and reads replacement inventory', () => {
    const grid=document.querySelector('.bag-grid');for(let i=0;i<5;i++)bag.showBackpack(true);
    H.game.ownedCards=[...H.game.ownedCards];bag.showBackpack(true);expect(document.querySelector('.bag-grid')).toBe(grid);
    const zoom=vi.spyOn(ui,'showCardZoom'),tile=document.querySelector('[data-stack="药剂"]');tile.focus();tile.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));expect(zoom).toHaveBeenCalledOnce();document.querySelector('.cz-backdrop').click();
    window.SDT.Sound.sfx.mockClear();pointer('pointerdown',tile);expect(window.SDT.Sound.sfx.mock.calls.filter(([sound])=>sound==='pick')).toHaveLength(1);expect(drag.bagDrag).not.toBeNull();
  });
  it('refresh during drag clears old gesture and later pointerup cannot move inventory', () => {
    startDrag();const before=JSON.stringify(H.game.ownedCards);bag.showBackpack(true);
    expect(drag.bagDrag).toBeNull();expect(document.querySelector('.bag-ghost')).toBeNull();
    document.elementFromPoint.mockReturnValue(document.querySelector('.bag-rz[data-zone="safe"]'));pointer('pointermove',window,1,200);pointer('pointerup',window,1,200);
    expect(JSON.stringify(H.game.ownedCards)).toBe(before);expect(document.querySelector('.dragging')).toBeNull();
  });
  it('filter and sort refresh preserve control focus and correct visible cards',()=>{
    const board=document.querySelector('.bag-board'),filter=document.querySelector('[data-act="bagFilter"][data-f="move"]');filter.focus();filter.click();
    expect(document.querySelector('.bag-board')).toBe(board);expect(document.activeElement.dataset.f).toBe('move');expect(document.querySelector('[data-stack="法术"]')).not.toBeNull();expect(document.querySelector('[data-stack="药剂"]')).toBeNull();
    const sort=document.querySelector('[data-act="bagSortCycle"]');sort.focus();sort.click();expect(document.activeElement.dataset.act).toBe('bagSortCycle');expect(document.querySelector('[data-stack="法术"]')).not.toBeNull();
  });
});
