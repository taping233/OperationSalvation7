import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { overlayElements, resetEventGame, eventCardMocks, bindEventRoot, eventMapMocks, eventMapActions, eventUiMocks, eventCapacityPorts, eventSaveActions } from './helpers/environment-fixtures.js';
import { rollEventDice, flushEventActions } from './helpers/event-dice-async.js';
import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], uid: 0, slot: null, narrative: async () => null, random: () => 0.9 }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  ...eventMapMocks(H), ...eventSaveActions(H), getActiveSlot: () => H.slot, ...eventMapActions(H),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let flow, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  await connectSdtFixture({ ...eventCardMocks(H) });
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, ...eventUiMocks(() => UI),
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  await import('../game/src/run/game.run.altar.js');
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
  resetEventGame(H, () => scenes);
});
afterEach(() => { UI.hideOverlay({ immediate: true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

async function openEvent(id, rewards = []) {
  H.cards = [{ id, name: '生命周期事件', type: '事件' }, ...rewards];
  const opening = flow.runEventDeck(); await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
}
async function returnFromBag() { UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) await hook(); else H.game.state = 'idle'; await flushEventActions(); }

it('重编连续选取取消保留候选节点、焦点和滚动，只更新选择与提交状态', async () => {
  const moves = [1, 2, 3, 4].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
  H.game.ownedCards = moves.map((card, i) => ({ uid: `owned${i}`, card }));
  await openEvent('ev19-recode', moves); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
  const root = UI.el.ovBody.querySelector('.event-recode-scene');
  const list = UI.el.ovBody.querySelector('.reward-stage');
  const buttons = [...list.querySelectorAll('[data-act="eventRecodePick"]')];
  const go = UI.el.ovBody.querySelector('[data-act="eventRecodeGo"]');
  const show = vi.spyOn(UI, 'showOverlay');
  list.scrollTop = 140; buttons[0].focus();
  await UI._acts.eventRecodePick({ i: '0' }); await flushEventActions();
  expect(UI.el.ovBody.querySelector('.event-recode-scene')).toBe(root);
  expect(document.activeElement).toBe(buttons[0]); expect(list.scrollTop).toBe(140);
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true'); expect(go.disabled).toBe(true);
  await UI._acts.eventRecodePick({ i: '1' }); await flushEventActions();
  expect(go.disabled).toBe(false); expect(root.textContent).toContain('2/2');
  await UI._acts.eventRecodePick({ i: '2' }); await flushEventActions();
  expect(buttons[2].getAttribute('aria-pressed')).toBe('false');
  await UI._acts.eventRecodePick({ i: '0' }); await flushEventActions();
  expect(buttons[0].getAttribute('aria-pressed')).toBe('false'); expect(go.disabled).toBe(true);
  expect(root.textContent).toContain('1/2'); expect(show).not.toHaveBeenCalled();
  expect([...list.querySelectorAll('[data-act="eventRecodePick"]')]).toEqual(buttons);
});

it('离开再返回才重建候选，并保留选择且拒绝旧页面动作', async () => {
  const moves = [1, 2, 3].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
  H.game.ownedCards = moves.map((card, i) => ({ uid: `owned${i}`, card }));
  await openEvent('ev19-recode', moves); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
  const first = UI.el.ovBody.querySelector('[data-act="eventRecodePick"]');
  await UI._acts.eventRecodePick({ i: '0' }); await flushEventActions(); const oldPick = UI._acts.eventRecodePick;
  UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
  expect(UI.el.ovBody.querySelector('[data-act="eventRecodePick"]')).not.toBe(first);
  expect(UI.el.ovBody.querySelectorAll('[data-reward-selected="true"]')).toHaveLength(1);
  await oldPick({ i: '1' }); await flushEventActions(); expect(UI.el.ovBody.querySelectorAll('[data-reward-selected="true"]')).toHaveLength(1);
  await UI._acts.eventRecodePick({ i: '1' }); await flushEventActions(); expect(UI.el.ovBody.querySelectorAll('[data-reward-selected="true"]')).toHaveLength(2);
  await UI._acts.eventRecodeGo(); await flushEventActions(); await rollEventDice(UI);
  expect(UI.el.ovBody.querySelector('[data-event-recode-result]')).not.toBeNull();
  expect(first.isConnected).toBe(false);
});
