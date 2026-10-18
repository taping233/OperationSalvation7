import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const st = vi.hoisted(() => ({ game:{}, saves:vi.fn(), tick:vi.fn(), hook:null }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP:{ rules:{} }, MODES:{}, game:st.game,
  bagCap:() => 100, usedSlots:() => st.game.ownedCards.length,
  curLayer:() => ({ logical:[{ def:{ type:'altar' } }] }),
  getActiveSlot:() => 'slot', enterLayer:vi.fn(), newUid:vi.fn(), saveGame:st.saves, scaledEnemy:x => x,
}));
vi.mock('../game/src/core/characters.js', () => ({ characterFor:() => null, characterName:() => '' }));
vi.mock('../game/src/core/motion.js', () => ({ reduceMotion:() => true }));
vi.mock('../game/src/ui/motion-transitions.js', () => ({}));
vi.mock('../game/src/ui/expedition-feedback.js', () => ({ installExpeditionFeedback:vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub:vi.fn() }));
vi.mock('../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:{ showBackpack:vi.fn() } }));
vi.mock('../game/src/hub/bag-return-hook.js', () => ({ setBagReturnHook:fn => { st.hook = fn; } }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx:{ tick:st.tick }, _set_cardPageOpen:vi.fn() }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle:vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage:{} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun:vi.fn(), readSettlementReceipt:vi.fn(), recoverSlot:vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  FIRE_RESTORABLE:() => true, consumeCurrentCell:vi.fn(), finishInstant:vi.fn(), grantEventCard:vi.fn(),
  openFixedRewardsOnCell:vi.fn(), openPocketRestore:vi.fn(), openShop:vi.fn(),
  nodeOpt:(act, title, sub, _tone, attrs = '') => `<button data-act="${act}" ${attrs}>${title}<span>${sub}</span></button>`,
  nodeShell:({ title, body, foot = '' }) => window.SDT.UI.showOverlay(title, `<section>${body}${foot}</section>`, 'scene'),
}));

let UI, openAltarRitual, showOverlay, focus;
const hand = () => document.querySelector('.sac-hand');
const button = uid => [...document.querySelectorAll('[data-act="sacPick"]')].find(el => el.dataset.uid === uid);
const selected = () => [...document.querySelectorAll('.sac-card.sel')].map(el => el.dataset.uid);
const clickAct = act => document.querySelector(`[data-act="${act}"]`).click();
function pick(uid, detail = 1) {
  // Native Enter/Space activation reaches the real UI click delegate with detail=0.
  // jsdom does not synthesize that default keyboard click, so dispatch its resulting event.
  button(uid).focus({ preventScroll:true });
  button(uid).dispatchEvent(new MouseEvent('click', { bubbles:true, detail }));
}
function expectStable(uid, scrollTop) {
  expect(hand().scrollTop).toBe(scrollTop);
  expect(document.activeElement).toBe(button(uid));
  expect(focus).toHaveBeenLastCalledWith({ preventScroll:true });
}

beforeAll(async () => {
  window.SDT = {
    Icons:{ rich:x => x }, Sound:{ sfx:vi.fn(), scene:vi.fn() },
    Meta:{ addXpToProgress:vi.fn() }, Cards:{ cardHTML:card => `<span>${card.name}</span>` }, Base:{},
  };
  ({ UI } = await import('../game/src/ui/ui.js'));
  ({ openAltarRitual } = await import('../game/src/run/game.run.altar.js'));
  showOverlay = UI.showOverlay;
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><div id="overlay" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  Object.assign(st.game, {
    state:'idle', seed:7, discoveredPairs:new Set(), layerData:[], layerIdx:0, trackPos:0,
    fragments:0, altarActivated:false, altarItemSacrificed:false, altarRewardPending:false,
    ownedCards:Array.from({ length:40 }, (_, i) => ({ uid:`card-${i}`, card:{ id:`card-${i}`, name:i === 0 ? '寻宝图' : i === 30 ? '三把钥匙' : `卡${i}`, type:'道具' } })),
    usedPocket:[{ card:{ id:'used', name:'已用招式', type:'武术' }, count:2 }],
  });
  st.saves.mockClear(); st.tick.mockClear(); st.hook = null;
  UI._acts = {}; UI._baseActs = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null;
  UI.init(); UI.refresh = vi.fn();
  UI.showOverlay = function (...args) {
    showOverlay.apply(this, args);
    // Geometry is a fixture from the parent's real five-column altar, not a jsdom layout claim.
    if (hand()) Object.defineProperties(hand(), { scrollHeight:{ value:1952 }, clientHeight:{ value:592 } });
  };
  focus = vi.spyOn(HTMLElement.prototype, 'focus');
  openAltarRitual(); clickAct('altarOn3');
});
afterEach(() => {
  UI.hideOverlay({ immediate:true });
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('同次献祭选牌的滚动与焦点', () => {
  it.each([['鼠标', 1], ['键盘激活回调', 0]])('%s选下排候选保留浮点滚动，延后焦点也不跳回首张', async (_input, detail) => {
    const cards = st.game.ownedCards;
    pick('card-0', detail);
    const previousHand = hand(); previousHand.scrollTop = 1229.899;
    pick('card-30', detail);
    expect(hand()).toBe(previousHand);
    expectStable('card-30', 1229.899);
    await vi.advanceTimersByTimeAsync(32);
    expectStable('card-30', 1229.899);
    expect(selected()).toEqual(['card-0', 'card-30']);
    expect(st.game.ownedCards).toBe(cards);
    expect(st.saves).not.toHaveBeenCalled();
  });

  it('接近底部多选、达到上限后再选、取消选择和补选均保位且仍按三张上限', () => {
    const bottom = hand().scrollHeight - hand().clientHeight - 0.5;
    hand().scrollTop = bottom;
    for (const uid of ['card-35', 'card-36', 'card-37']) {
      pick(uid); expectStable(uid, bottom);
    }
    expect(selected()).toEqual(['card-35', 'card-36', 'card-37']);
    expect(document.querySelector('[data-act="sacConfirm"]').disabled).toBe(false);
    pick('card-38', 0); expectStable('card-38', bottom);
    expect(button('card-38').getAttribute('aria-pressed')).toBe('false');
    expect(selected()).toHaveLength(3);
    pick('card-36', 0); expectStable('card-36', bottom);
    expect(document.querySelector('[data-act="sacConfirm"]').disabled).toBe(true);
    pick('card-39'); expectStable('card-39', bottom);
    expect(selected()).toEqual(['card-35', 'card-37', 'card-39']);
    expect(st.game.ownedCards).toHaveLength(40);
  });

  it('确认前跨区使重绘失效选择时仍保位，普通背包保护规则保持原状', () => {
    for (const uid of ['card-30', 'card-31', 'card-32']) pick(uid);
    hand().scrollTop = 1230.25;
    st.game.ownedCards[30].safe = true;
    clickAct('sacConfirm');
    expect(hand().scrollTop).toBe(1230.25);
    expect(button('card-30')).toBeUndefined();
    expect(selected()).toEqual(['card-31', 'card-32']);
    expect(document.querySelector('[data-act="sacConfirm"]').disabled).toBe(true);
    expect(st.game.ownedCards).toHaveLength(40);
    expect(st.game.altarActivated).toBe(false);
    expect(st.saves).not.toHaveBeenCalled();
  });

  it('单张道具献祭也保位并限制一张；取消重开另起会话从顶部且不继承选择', () => {
    clickAct('sacCancel'); clickAct('altarItemRestore');
    hand().scrollTop = 1359.75;
    pick('card-39', 0); expectStable('card-39', 1359.75);
    pick('card-38'); expectStable('card-38', 1359.75);
    expect(selected()).toEqual(['card-39']);
    const oldPick = UI._acts.sacPick;
    const oldConfirm = UI._acts.sacConfirm;
    const cards = st.game.ownedCards;
    clickAct('sacCancel'); clickAct('altarItemRestore');
    oldPick({ uid:'card-37' }); oldConfirm();
    expect(hand().scrollTop).toBe(0);
    expect(selected()).toEqual([]);
    expect(st.game.ownedCards).toBe(cards);
    expect(st.game.altarItemSacrificed).toBe(false);
    expect(st.saves).not.toHaveBeenCalled();
  });

  it('取消普通献祭后重开从顶部，旧会话不能改新选择或滚动', () => {
    hand().scrollTop = 1229.899; pick('card-30');
    const oldPick = UI._acts.sacPick, oldConfirm = UI._acts.sacConfirm;
    clickAct('sacCancel'); clickAct('altarOn3');
    expect(hand().scrollTop).toBe(0);
    expect(selected()).toEqual([]);
    hand().scrollTop = 800.5;
    oldPick({ uid:'card-31' }); oldConfirm();
    expect(hand().scrollTop).toBe(800.5);
    expect(selected()).toEqual([]);
    expect(st.game.ownedCards).toHaveLength(40);
  });
});
