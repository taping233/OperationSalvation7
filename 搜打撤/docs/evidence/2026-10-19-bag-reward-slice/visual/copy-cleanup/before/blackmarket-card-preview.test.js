import { rollEventDice } from './helpers/event-dice.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], uid: 0, random: () => 0.9 }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal:10, fireClassCardChance:1, bossDeckSize:15, starterSha:5, battleStartDraw:5, battleTurnDraw:1, battleHandMax:8 }, monsters:{}, altar:{ bosses:[] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => null, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: async () => null }));

const prizes = [
  { id:'preview-equip', name:'元素符印', type:'装备', rarity:'古朴', desc:'装备规则完整文字' },
  { id:'preview-move', name:'致命穿刺', type:'武术', rarity:'古朴', desc:'招式规则完整文字' },
  { id:'preview-spell', name:'高端研发', type:'法术', rarity:'古朴', desc:'法术规则完整文字' },
];
let flow, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { game:H.game, Icons:{ rich:x => x }, Sound:{ sfx() {} }, Meta:{ track() {}, addXpToProgress() {} }, Base:{ bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' } } }, UiScale:{ rect:el => el.getBoundingClientRect() },
    Cards:{ DROP_WEIGHTS:{ 古朴:1 }, all:() => H.cards, classPool:() => [], sellPrice:() => 1, isRandomObtainable:() => true,
      cardHTML:(c, size = '') => `<div class="hs-card" data-card-id="${c.id}" data-size="${size}"><b>${c.name}</b><p class="hsc-desc">${c.desc || ''}</p></div>` } };
  const { UI: standardUI } = await import('../game/src/ui/ui.js');
  UI = window.SDT.UI = { ...standardUI, _acts:{}, _baseActs:{}, _roomActive:true, el:{},
    act:(name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody'), ovTitle:document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
  H.random = vi.fn(() => 0.9); H.saves = []; H.uid = 0;
  Object.assign(H.game, { seed:7, state:'idle', layerIdx:0, trackPos:1, hp:35, maxHp:35, visited:{}, ownedCards:[], usedPocket:[], myClass:'武', runActive:true, coins:18, fragments:0,
    altarActivated:false, altarRewardPending:false, nodeRewards:{}, entrySupply:null, discoveredPairs:new Set(),
    layerData:[{ logical:[{ def:{ type:'entrance' } }, { def:{ type:'event' } }] }],
    canReceiveCard:() => true, heal:n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
    grantCard:(card, opts) => scenes.grantEventCard(card, opts), bagCap:() => 9, usedSlots:() => H.game.ownedCards.length,
  });
});
afterEach(() => {
  document.getElementById('cardZoom')?._closeCardZoom?.(true);
  UI.hideOverlay({ immediate:true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
});
async function openBlackMarket() {
  H.cards = [{ id:'ev19-gamble', name:'地下商场黑市', type:'事件' }, ...prizes];
  const opening = flow.runEventDeck(); await vi.advanceTimersByTimeAsync(1000); await opening;
  UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
}
const readers = () => [...UI.el.ovBody.querySelectorAll('[data-act="eventGambleRead"]')];
function closeZoom(kind = 'escape') {
  const zoom = document.getElementById('cardZoom');
  if (kind === 'escape') zoom.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
  else zoom.querySelector(kind === 'button' ? '.cz-close' : '.cz-backdrop').click();
  vi.advanceTimersByTime(300);
  expect(document.getElementById('cardZoom')).toBeNull();
}

describe('黑市投入前卡牌详情', () => {
  it('三张原生按钮逐张打开共用远征大图，Esc/关闭/背景收回并归还来源焦点', async () => {
    await openBlackMarket();
    const buttons = readers(), page = UI.el.ovBody.firstElementChild;
    expect(buttons).toHaveLength(3);
    expect(buttons.map(button => button.querySelector('.hs-card').dataset.cardId).sort()).toEqual(prizes.map(card => card.id).sort());
    for (const [i, button] of buttons.entries()) {
      const expected = prizes.find(card => card.id === button.querySelector('.hs-card').dataset.cardId);
      expect(button.tagName).toBe('BUTTON'); expect(button.type).toBe('button'); expect(button.tabIndex).toBe(0);
      expect(button.getAttribute('aria-label')).toBe(`放大查看${expected.name}`);
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      UI.el.ovBody.querySelector('[data-act="eventGambleTry"]').focus();
      button.click();
      const zoom = document.getElementById('cardZoom');
      expect(zoom.getAttribute('role')).toBe('dialog'); expect(zoom.getAttribute('aria-modal')).toBe('true');
      expect(zoom.classList.contains('expedition-card-zoom')).toBe(true);
      expect(zoom.querySelector('.hs-card').dataset.cardId).toBe(expected.id);
      expect(zoom.querySelector('.hs-card').dataset.size).toBe('lg');
      expect(zoom.textContent).toContain(expected.desc);
      expect(zoom.querySelector('.cz-foot')).toBeNull(); expect(zoom.querySelector('.cz-note')).toBeNull();
      expect(UI.el.overlay.inert).toBe(true); expect(document.activeElement).toBe(zoom.querySelector('.cz-close'));
      closeZoom(['escape', 'button', 'background'][i]);
      expect(UI.el.overlay.inert).toBe(false); expect(document.activeElement).toBe(button);
      expect(UI.el.ovBody.firstElementChild).toBe(page); expect(readers()[i]).toBe(button);
    }
    expect(UI.el.ovBody.textContent).toContain('点击卡牌放大查看');
  });

  it('重复查看只读且不重建黑市，不扣币、不保存、不抽随机、不改变尝试数或候选', async () => {
    await openBlackMarket();
    const before = JSON.stringify(H.game), saves = H.saves.length, rolls = H.random.mock.calls.length;
    const buttons = readers(), render = vi.spyOn(UI, 'showOverlay');
    for (let i = 0; i < 9; i++) { buttons[i % 3].click(); closeZoom(); }
    expect(JSON.stringify(H.game)).toBe(before); expect(H.saves).toHaveLength(saves);
    expect(H.random).toHaveBeenCalledTimes(rolls); expect(render).not.toHaveBeenCalled();
    expect(readers()).toEqual(buttons); expect(UI.el.ovBody.textContent).toContain('已尝试 0/5');
    expect(H.game.coins).toBe(18); expect(H.game.ownedCards).toHaveLength(0);
  });

  it('四次失败后详情和背包返回仍保留保底，第五次只扣3币并保留原三张待领', async () => {
    await openBlackMarket();
    H.random.mockReturnValue(0.1);
    for (let i = 0; i < 4; i++) { readers()[i % 3].click(); closeZoom(); UI._acts.eventGambleTry(); rollEventDice(UI); }
    expect(H.game.coins).toBe(6); expect(UI.el.ovBody.textContent).toContain('已尝试 4/5');
    const oldRead = UI._acts.eventGambleRead;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); UI.hideOverlay(); takeBagReturnHook()();
    oldRead({ i:'0' }); expect(document.getElementById('cardZoom')).toBeNull();
    readers()[2].click(); closeZoom();
    expect(UI.el.ovBody.textContent).toContain('已尝试 4/5');
    expect(UI.el.ovBody.querySelector('[data-act="eventGambleTry"]').textContent).toContain('本次保底');
    const rolls = H.random.mock.calls.length, staleRead = UI._acts.eventGambleRead;
    UI._acts.eventGambleTry(); rollEventDice(UI);
    expect(H.game.coins).toBe(3); expect(H.game.ownedCards).toHaveLength(0);
    expect(H.random).toHaveBeenCalledTimes(rolls + 1);
    const pending = window.SDT.Chests.serialize(H.game);
    expect(pending.current.cards.map(c => c.id).sort()).toEqual(prizes.map(c => c.id).sort());
    staleRead({ i:'0' }); expect(document.getElementById('cardZoom')).toBeNull();
    expect(window.SDT.Chests.serialize(H.game)).toEqual(pending);
    expect(H.game.coins).toBe(3);
  });

  it.each(['leave', 'new-page', 'new-run', 'new-node'])('%s 后失效详情回调不能打开旧奖品或改变当前流程', async change => {
    await openBlackMarket();
    const read = UI._acts.eventGambleRead;
    if (change === 'leave') UI._acts.eventGambleLeave();
    if (change === 'new-page') UI.showOverlay('新页', '<main>新页</main>', 'page');
    if (change === 'new-run') H.game.discoveredPairs = new Set();
    if (change === 'new-node') H.game.trackPos = 2;
    const before = JSON.stringify(H.game), page = UI.el.ovBody.firstElementChild, rolls = H.random.mock.calls.length;
    read({ i:'0' });
    expect(document.getElementById('cardZoom')).toBeNull(); expect(UI.el.ovBody.firstElementChild).toBe(page);
    expect(JSON.stringify(H.game)).toBe(before); expect(H.random).toHaveBeenCalledTimes(rolls);
  });

  it('越界详情索引忽略，不影响有效卡牌详情或交易', async () => {
    await openBlackMarket();
    for (const i of ['-1', '3', '1.5', 'NaN', 'x']) UI._acts.eventGambleRead({ i });
    expect(document.getElementById('cardZoom')).toBeNull(); expect(H.game.coins).toBe(18);
    readers()[1].click(); closeZoom(); expect(H.game.coins).toBe(18);
  });
});
