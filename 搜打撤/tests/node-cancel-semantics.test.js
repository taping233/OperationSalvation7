import { overlayElements, resetEventGame, eventCardMocks, bindEventRoot, eventMapMocks, eventUiMocks, eventCapacityPorts, eventSaveActions } from './helpers/environment-fixtures.js';
import { cancelLayerPassage } from '../game/src/ui/map-passage.js';
import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, begin: vi.fn(async () => ({ ok: false })), enter: vi.fn(), cards: [], saves: [], uid: 0, slot: null, narrative: async () => null, random: () => 0.9 }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  ...eventMapMocks(H), ...eventSaveActions(H), getActiveSlot: () => H.slot, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer: (...args) => { H.enter(...args); H.game.layerIdx = args[0]; }, exitToTitle() {},
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({ begin: (...args) => H.begin(...args) }), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let altar, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { ...eventCardMocks(H) };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, ...eventUiMocks(() => UI),
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  altar = await import('../game/src/run/game.run.altar.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { ...overlayElements() };
  bindEventRoot(() => UI); setBagReturnHook(null);
  bagSlots.organizeReward = options => openRewardCapacityOrganizer({ ...options, UI,
    ...eventCapacityPorts(H, options),
  });
  bagSlots.showBackpack = () => UI.showOverlay('背包', '<main>背包</main>', 'page');
  H.enter.mockClear(); H.begin.mockClear(); H.game.pendingExtraction = null; H.game.extractionPending = null;
  resetEventGame(H, () => scenes);
});
afterEach(() => { cancelLayerPassage(); UI.hideOverlay({ immediate: true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

function openDoor(reverse) {
  H.game.layerData = [0, 1].map(i => ({ name: `第${i + 1}层`, logical: [{ def: { type: 'door' } }] }));
  H.game.layerIdx = reverse ? 1 : 0; H.game.trackPos = 0;
  altar.openDoorModal({ pair: 'test-door', reverse, toLayer: reverse ? 0 : 1, arriveAt: 0 }, {});
}
function openExit(kind) {
  const layer = kind === 'emergency' ? 2 : 3;
  H.game.layerIdx = layer; H.game.trackPos = 0; H.game.bossKilled = kind === 'final';
  H.game.layerData = Array.from({ length: 4 }, () => ({ logical: [{ def: { type: kind === 'emergency' ? 'emergencyExit' : 'exit' } }] }));
  H.game.ownedCards = [1, 2, 3].map(i => ({ uid: `u${i}`, card: { id: `card${i}`, name: `测试牌${i}`, type: '武术' } }));
  altar.openEmergencyModal();
}

describe('节点取消语义：关闭不能跨层或开始撤离', () => {
  it.each([false, true])('正/反向闸门 reverse=%s 取消留在当前层，显式主按钮仍换层', reverse => {
    openDoor(reverse);
    const initialLayer = H.game.layerIdx;
    expect(UI._findCancelBtn()?.dataset.act).toBe('doorBack');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(H.enter).not.toHaveBeenCalled();
    expect(H.game.layerIdx).toBe(initialLayer);
    expect(H.game.state).toBe('idle');
    expect(takeBagReturnHook()).toBeNull();
    openDoor(reverse);
    UI.el.ovBody.querySelector('[data-act="goDoor"]').click();
    expect(document.querySelectorAll('.map-layer-passage')).toHaveLength(1);
    expect(document.querySelector('.page-visual-return')).toBeNull();
    expect(H.enter).toHaveBeenCalledExactlyOnceWith(reverse ? 0 : 1, 0, { glideCam: true });
    expect(H.game.layerIdx).toBe(reverse ? 0 : 1);
  });
  it.each(['emergency', 'final'])('%s 撤离页取消不献祭、不付款、不撤离', kind => {
    openExit(kind);
    const cards = [...H.game.ownedCards], coins = H.game.coins;
    expect(UI._findCancelBtn()?.dataset.act).toBe('stayHere');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(H.game.state).toBe('idle');
    expect(H.game.ownedCards).toEqual(cards);
    expect(H.game.coins).toBe(coins);
    expect(H.begin).not.toHaveBeenCalled();
    expect(UI.el.ovBody.querySelector('[data-act="sacConfirm"]')).toBeNull();
  });
  it.each(['insufficient', 'inactive', 'boss-locked'])('%s 撤离限制仍可取消且主操作限制保持', condition => {
    openExit(condition === 'boss-locked' ? 'final' : 'emergency');
    if (condition === 'insufficient') H.game.ownedCards = H.game.ownedCards.slice(0, 2);
    if (condition === 'inactive') { H.game.layerIdx = 1; H.game.layerData[1].logical[0].def.type = 'emergencyExit'; }
    if (condition === 'boss-locked') H.game.bossKilled = false;
    altar.openEmergencyModal();
    const pay = UI.el.ovBody.querySelector('[data-act="payExit"]');
    if (condition === 'insufficient') expect(pay.disabled).toBe(true);
    else expect(pay).toBeNull();
    expect(UI._findCancelBtn()?.dataset.act).toBe('stayHere');
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(H.game.state).toBe('idle');
    expect(H.begin).not.toHaveBeenCalled();
  });
  it('显式点击紧急撤离仍进入三张献祭选择，取消不损失牌', () => {
    openExit('emergency');
    const cards = [...H.game.ownedCards];
    UI.el.ovBody.querySelector('[data-act="payExit"]').click();
    expect(UI.el.ovTitle.textContent).toContain('选择要献祭的卡牌');
    expect(UI.el.ovBody.querySelectorAll('[data-act="sacPick"]')).toHaveLength(3);
    UI.el.ovBody.querySelector('[data-act="sacCancel"]').click();
    expect(H.game.ownedCards).toEqual(cards);
    expect(H.begin).not.toHaveBeenCalled();
  });
  it('显式点击终局撤离仍调用原撤离事务', async () => {
    openExit('final');
    UI.el.ovBody.querySelector('[data-act="payExit"]').click();
    for(let i=0;i<8;i++) await Promise.resolve();
    expect(H.begin).toHaveBeenCalledTimes(1);
  });
});
