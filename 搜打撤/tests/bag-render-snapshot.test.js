import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game:{}, stacks:vi.fn(), save:vi.fn(), uid:0, session:null }));
vi.mock('../game/src/run/game.session.kernel.js', () => ({ game:H.game }));
vi.mock('../game/src/run/game.session.modes.js', () => ({ modeCfg:() => ({}) }));
vi.mock('../game/src/run/game.session.js', async () => {
  const actual = await import('../game/src/run/game.session.bag.js');
  H.session = actual;
  H.stacks.mockImplementation(actual.cardStacks);
  return { ...actual, game:H.game, MAP:{ items:{} }, cardStacks:H.stacks,
    saveGame:H.save, newUid:() => `new-${++H.uid}` };
});
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen:vi.fn() }));
vi.mock('../game/src/hub/game.bag.settle.js', () => ({ bindBagMixins:vi.fn(), resumeBattleRewards:vi.fn() }));

const spell = { id:'spell', name:'法术A', type:'法术', cost:2 };
const equipment = { id:'equipment', name:'装备B', type:'装备', cost:1 };
const crystal = { id:'tt-crystal', name:'能源结晶', type:'道具', rules:{ version:1, bag:{ use:[{ op:'restoreConsumed', amount:3 }] } } };
let bag, drag, ui;
function mixedCards() {
  return [
    ...Array.from({ length:7 }, (_, i) => ({ uid:`spell-${i}`, card:spell })),
    ...Array.from({ length:3 }, (_, i) => ({ uid:`equipment-${i}`, card:equipment, equipped:i === 0 })),
    { uid:'safe', card:{ id:'safe', name:'资源C', type:'资源' }, safe:true },
    { uid:'stored', card:{ id:'stored', name:'盒内D', type:'资源' }, stored:true },
    { uid:'crystal', card:crystal },
  ];
}
function tiles() {
  return [...document.querySelectorAll('.bag-grid [data-stack]')].map(el => ({
    name:el.dataset.stack, count:Number(el.querySelector('.bag-tct')?.textContent.slice(1) || 1),
    safe:el.dataset.safe === '1', pocket:el.dataset.pocket === '1',
  }));
}
function click(selector) { document.querySelector(selector).click(); }

beforeEach(async () => {
  vi.resetModules(); H.stacks.mockClear(); H.save.mockReset(); H.uid = 0;
  Object.assign(H.game, { seed:'snapshot-run', discoveredPairs:new Set(), runActive:true, state:'idle',
    myClass:'法师', battleActive:false, nestActive:false, ownedCards:mixedCards(),
    inventory:[{ name:'木材', count:5, value:3 }], usedPocket:[{ card:spell, count:2 }],
    cardOrder:['装备B', '过期卡'], coins:20, fragments:2, hp:10, maxHp:30 });
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
  ui = { el:{ overlay, ovBody:body }, acts:{}, log:vi.fn(), refresh:vi.fn(), registerHelp:vi.fn(),
    helpBtn:() => '<button>?</button>', act(name, fn) { this.acts[name] = fn; },
    showOverlay(_title, html) { document.getElementById('cardZoom')?.remove(); overlay.hidden = false; body.innerHTML = html; },
    hideOverlay() { overlay.hidden = true; },
    showCardZoom(_card, options) {
      const zoom = document.createElement('div'); zoom.id = 'cardZoom';
      zoom.innerHTML = `<button class="cz-backdrop"></button><div class="cz-card"></div><div class="cz-foot">${options.footer}</div>`;
      zoom.querySelector('.cz-backdrop').onclick = () => zoom.remove(); document.body.append(zoom);
    },
  };
  body.addEventListener('click', event => {
    const target = event.target.closest('[data-act]');
    if (target && !target.disabled) ui.acts[target.dataset.act]?.({ ...target.dataset });
  });
  window.SDT = { UI:ui, game:H.game, Base:{ slot:1, bagCap:() => 24, safeCap:() => 6 },
    Sound:{ sfx:vi.fn() }, Cards:{ SHA:{ id:'sha', name:'初始攻击' }, all:() => [],
      cardHTML:card => `<span>${card.name}</span>`, cardBackHTML:() => '' } };
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  bag = await import('../game/src/hub/game.bag.js'); drag = await import('../game/src/hub/game.bag.drag.js');
  H.stacks.mockImplementation(H.session.cardStacks);
});
afterEach(() => { drag?.resetBagDrag(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('背包单次渲染堆快照', () => {
  it.each([['main', 5], ['safe', 4], ['pocket', 4]])('%s 每次仅向会话请求两区各一份堆，保留实时容量查询', (zone, totalGroupings) => {
    const visits = vi.spyOn(H.game.ownedCards, 'forEach');
    bag.showBackpackSection(zone);
    expect(H.stacks.mock.calls).toEqual([[false], [true]]);
    expect(visits).toHaveBeenCalledTimes(totalGroupings);
    H.stacks.mockClear(); visits.mockClear();
    bag.showBackpack(true);
    expect(H.stacks.mock.calls).toEqual([[false], [true]]);
    expect(visits).toHaveBeenCalledTimes(totalGroupings);
  });

  it('保留同名多堆、装备逐张、原有顺序、物资拆格与两区张数', () => {
    bag.showBackpack(true);
    expect(tiles().map(({ name, count }) => [name, count])).toEqual([
      ['装备B', 1], ['装备B', 1], ['装备B', 1], ['法术A', 3], ['法术A', 3], ['法术A', 1], ['能源结晶', 1],
    ]);
    expect(document.querySelectorAll('.bag-grid [data-supply]')).toHaveLength(2);
    expect(document.querySelector('.bag-count-summary').textContent).toContain('卡牌 11 张');
    expect(document.querySelector('.bag-count-summary').textContent).toContain('散装物资 5 件');
    expect(document.querySelector('.bag-capchip').textContent).toContain('/24 格');
    expect(H.game.cardOrder).toEqual(['装备B', '法术A', '能源结晶', '资源C']);
    expect(tiles().some(x => x.name === '盒内D')).toBe(false);
    click('.bag-rz[data-zone="safe"]');
    expect(tiles()).toEqual([{ name:'资源C', count:1, safe:true, pocket:false }]);
    click('.bag-rz[data-zone="pocket"]');
    expect(tiles()).toEqual([{ name:'法术A', count:2, safe:false, pocket:true }]);
  });

  it.each([['move', ['法术A', '法术A', '法术A']], ['装备', ['装备B', '装备B', '装备B']], ['道具', ['能源结晶']], ['资源', []]])('筛选 %s 保留原有堆顺序和容量数字', (filter, names) => {
    bag.showBackpack(true);
    const capacity = document.querySelector('.bag-capchip').textContent;
    H.stacks.mockClear(); click(`[data-act="bagFilter"][data-f="${filter}"]`);
    expect(tiles().map(x => x.name)).toEqual(names);
    expect(document.querySelectorAll('.bag-grid [data-supply]')).toHaveLength(0);
    expect(document.querySelector('.bag-capchip').textContent).toBe(capacity);
    expect(H.stacks.mock.calls).toEqual([[false], [true]]);
  });

  it('空背包、空安全格和空消耗区都可刷新', () => {
    H.game.ownedCards = []; H.game.inventory = []; H.game.usedPocket = [];
    for (const section of ['main', 'safe', 'pocket']) {
      H.stacks.mockClear();
      if (section === 'main') bag.showBackpackSection(section);
      else click(`.bag-rz[data-zone="${section}"]`);
      expect(tiles()).toEqual([]); expect(document.querySelector('.bag-empty2')).not.toBeNull();
      expect(H.stacks.mock.calls).toEqual([[false], [true]]);
    }
    expect(H.game.cardOrder).toEqual([]);
  });

  it('卡牌和分区标记原地变更后，下次刷新立即重新分堆', () => {
    bag.showBackpack(true);
    H.game.ownedCards.push({ uid:'spell-7', card:spell });
    H.game.ownedCards.find(x => x.uid === 'crystal').safe = true;
    H.game.ownedCards.find(x => x.uid === 'stored').stored = false;
    bag.showBackpack(true);
    expect(tiles().filter(x => x.name === '法术A').map(x => x.count)).toEqual([3, 3, 2]);
    expect(tiles().some(x => x.name === '能源结晶')).toBe(false);
    expect(tiles().some(x => x.name === '盒内D')).toBe(true);
    click('.bag-rz[data-zone="safe"]');
    expect(tiles().map(x => x.name)).toEqual(['能源结晶', '资源C']);
  });

  it('上限时显示实时复原禁用原因；详情打开后容量改变仍执行实时守卫', () => {
    // Three crystals share one slot, so consuming one cannot free a slot.
    H.game.ownedCards = Array.from({ length:3 }, (_, i) => ({ uid:`crystal-${i}`, card:crystal }));
    bag.showBackpack(true); click('[data-act="inspectStack"]');
    expect(document.querySelector('[data-act="useDetailCard"]').disabled).toBe(false);
    const use = ui.acts.useDetailCard;
    H.game.inventory.push({ name:'新增物资', count:69, value:1 });
    const cards = JSON.stringify(H.game.ownedCards), pocket = JSON.stringify(H.game.usedPocket);
    use();
    expect(JSON.stringify(H.game.ownedCards)).toBe(cards);
    expect(JSON.stringify(H.game.usedPocket)).toBe(pocket);
    expect(ui.log).toHaveBeenCalledWith(expect.stringContaining('背包空间不足'), 'warn');
    expect(H.save).not.toHaveBeenCalled();
    bag.showBackpack(true);
    expect(document.querySelector('.bag-tstate').title).toContain('背包空间不足');
    click('[data-act="inspectStack"]');
    expect(document.querySelector('[data-act="useDetailCard"]').disabled).toBe(true);
  });
});
