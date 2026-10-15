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
    showCardZoom(_card, options) { document.getElementById('cardZoom')?.remove(); const zoom = document.createElement('div'); zoom.id = 'cardZoom'; zoom.innerHTML = `<button class="cz-backdrop"></button>${options.footer}`; zoom.querySelector('.cz-backdrop').onclick = () => zoom.remove(); document.body.append(zoom); },
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
