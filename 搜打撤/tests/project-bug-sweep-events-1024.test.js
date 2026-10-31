import { afterEach, expect, it, vi } from 'vitest';
import { createRunEventController } from '../game/src/run/game.run.events.js';
import { createEventCommands } from '../game/src/run/event-commands.js';
import { eventOptionHTML } from '../game/src/ui/event-option-state.js';
import { eventPresentationPorts } from './helpers/event-presentation-ports.js';
import { createEventDiceController } from '../game/src/ui/event-dice.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

async function fixture(id, { bound = true, open = true } = {}) {
  const host = document.createElement('main'); document.body.append(host);
  const acts = {}, card = { id, name:'测试事件', type:'事件' };
  const game = { state:'modal', seed:1, layerIdx:0, trackPos:1, hp:20, maxHp:35,
    nodeRewards:bound ? { '0,1':{ version:1, type:'event', eventId:id } } : {}, visited:{}, ownedCards:[], coins:20 };
  let save = () => true;
  const UI = { el:{ ovBody:host, overlay:host }, _overlayRevision:0, act:(name, action) => { acts[name] = action; },
    showOverlay:(_title, html) => { UI._overlayRevision++; host.innerHTML = html; },
    hideOverlay:vi.fn(() => { UI._overlayRevision++; host.replaceChildren(); }),
    refresh:vi.fn(), log:vi.fn() };
  const diceOpen = vi.fn(() => true);
  const controller = createRunEventController({ ...eventPresentationPorts, game, UI, dom:document, getCards:() => ({ all:() => [card],
    cardHTML:() => '', isRandomObtainable:() => true }), sound(){}, serializeReward:() => null,
    eventCommands:createEventCommands({ state:game }), createDice:() => ({ open:diceOpen }),
    getActiveSlot:() => null, saveGame:() => save(), pick:cards => cards[0],
    nodeShell:spec => UI.showOverlay('', `<section>${spec.body || ''}${spec.foot || ''}</section>`),
    nodeOpt:act => `<button data-act="${act}">继续</button>`, enterNode:async () => true,
    consumeCurrentCell:() => { game.visited['0,1'] = 1; }, setBagReturnHook(){}, setCardPageOpen(){},
    createCardChoice:() => ({ resume:() => false }), captureRunContext:() => () => true,
    eventNarrative:async () => null, eventOptionHTML,
  });
  if (open) await controller.runEventDeck();
  return { host, acts, game, UI, diceOpen, controller, setSave:fn => { save = fn; } };
}

it.each([true, false])('first event draw checkpoint=%s cannot replace a system menu opened while saving', async saved => {
  const h = await fixture('tt6-mystery', { bound:false, open:false }), gate = deferred();
  h.setSave(() => gate.promise);
  const opening = h.controller.runEventDeck(); await flush();
  expect(h.game.nodeRewards['0,1'].eventId).toBe('tt6-mystery');
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  gate.resolve(saved); await opening;
  expect(h.host.firstElementChild).toBe(menu);
  expect(h.acts.evtChoice).toBeUndefined();
  expect(h.game.nodeRewards['0,1'].eventId).toBe('tt6-mystery');
});

it.each([true, false])('event dice choice checkpoint=%s cannot hide or replace a system menu', async saved => {
  const h = await fixture('tt6-mystery'), gate = deferred();
  h.setSave(() => gate.promise); h.acts.evtChoice({ i:0 });
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  gate.resolve(saved); await flush();
  expect(h.host.firstElementChild).toBe(menu);
  expect(h.UI.hideOverlay).not.toHaveBeenCalled();
  expect(h.diceOpen).not.toHaveBeenCalled();
  expect(h.game.visited).toEqual({});
  expect(h.game.coins).toBe(20);
  if (saved) {
    expect(h.game.nodeRewards['0,1'].actionChoice).toBe(0);
    await h.controller.runEventDeck();
    expect(h.diceOpen).toHaveBeenCalledOnce();
  }
});

it('legacy retry after a synchronous failure preserves a system menu opened before the result resumes', async () => {
  const h = await fixture('custom-event');
  h.UI.log.mockImplementationOnce(() => { throw new Error('temporary event presentation failure'); });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const settling = h.acts.evtNext();
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  await settling; await flush();
  expect(h.host.firstElementChild).toBe(menu);
  expect(h.game.nodeRewards['0,1'].settled).toBeUndefined();
  expect(h.game.visited).toEqual({});
});

it.each([true, false])('the subsequent dice initialization checkpoint=%s cannot take over a menu', async saved => {
  const h = await fixture('tt6-mystery'), gate = deferred();
  h.diceOpen.mockImplementation(options => createEventDiceController({
    UI:h.UI, SDT:{}, save:() => gate.promise,
    show:spec => h.UI.showOverlay('', `<section>${spec.body}</section>`),
    bind:() => () => true, onLeave:() => h.UI.hideOverlay(),
  }).open(options));
  const choosing = h.acts.evtChoice({ i:0 });
  await flush();
  expect(h.diceOpen).toHaveBeenCalledOnce();
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  h.UI.hideOverlay.mockClear();
  gate.resolve(saved); await choosing;
  expect(h.host.firstElementChild).toBe(menu);
  expect(h.UI.hideOverlay).not.toHaveBeenCalled();
  expect(h.game.visited).toEqual({});
});

it('legacy single-button event can retry a rejected settlement without reopening the node', async () => {
  const h = await fixture('custom-event');
  h.UI.log.mockImplementationOnce(() => { throw new Error('temporary event presentation failure'); });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  await h.acts.evtNext(); await flush();
  expect(h.host.textContent).toContain('本次事件尚未完成');
  expect(h.game.nodeRewards['0,1'].settled).toBeUndefined();
  expect(h.game.visited).toEqual({});
  await h.acts.evtNext(); await flush();
  expect(h.game.nodeRewards['0,1'].settled).toBe(true);
  expect(h.game.visited['0,1']).toBe(1);
  expect(warning).toHaveBeenCalledOnce();
});
