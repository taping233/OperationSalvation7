import { afterEach, expect, it, vi } from 'vitest';
import { createEventCardChoiceController } from '../game/src/run/event-card-choice.js';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function fixture() {
  document.body.innerHTML = '<div id="overlay"><main id="ovBody"><section>事件入口</section></main></div>';
  const acts = {}, card = { id:'potion', name:'测试药水', type:'道具', rarity:'古朴' };
  const game = { seed:1, state:'modal', layerIdx:0, trackPos:2, nodeRewards:{}, ownedCards:[], visited:{},
    canReceiveCard:() => true, usedSlots:() => 0, bagCap:() => 20 };
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') }, _overlayRevision:0,
    act:(name, handler) => { acts[name] = handler; }, showOverlay:(_title, html) => { UI._overlayRevision++; UI.el.ovBody.innerHTML = html; },
    hideOverlay:vi.fn(() => { UI._overlayRevision++; UI.el.ovBody.replaceChildren(); }), log:vi.fn(), refresh:vi.fn(), showCardReward:vi.fn() };
  let save = () => true;
  const close = vi.fn(() => { UI.hideOverlay(); game.state = 'idle'; return true; });
  const controller = createEventCardChoiceController({ game, UI, SDT:{ Cards:{ all:() => [card], cardHTML:() => '' } },
    saveGame:() => save(), getActiveSlot:() => 1, nodeShell:spec => UI.showOverlay('', `<section><h2>${spec.title || ''}</h2>${spec.body || ''}${spec.foot || ''}</section>`),
    grantEventCard:received => { game.ownedCards.push({ uid:'received', card:received }); return true; },
    consumeCurrentCell:() => { game.visited['0,2'] = 1; }, captureContext:() => () => true, close });
  const replace = () => { UI.showOverlay('', '<section id="replacement">系统菜单</section>'); return UI.el.ovBody.firstElementChild; };
  return { controller, game, UI, card, acts, close, replace, setSave:fn => { save = fn; } };
}

it.each([true, false])('event choice opening save=%s preserves a replacement page', async saved => {
  const h = fixture(), gate = deferred(); h.setSave(() => gate.promise);
  const opening = h.controller.open('ev19-potions', [h.card]);
  const page = h.replace(); gate.resolve(saved); await opening;
  expect(h.UI.el.ovBody.firstElementChild).toBe(page);
  expect(h.game.nodeRewards['0,2'].taken).toBeNull();
});

it.each([true, false])('event choice claim save=%s preserves a replacement page and received card', async saved => {
  const h = fixture(); await h.controller.open('ev19-potions', [h.card]);
  const gate = deferred(); h.setSave(() => gate.promise);
  const claiming = h.acts.eventCardPick({ i:0 });
  const page = h.replace(); gate.resolve(saved); await claiming;
  expect(h.UI.el.ovBody.firstElementChild).toBe(page);
  expect(h.close).not.toHaveBeenCalled();
  expect(h.UI.showCardReward).not.toHaveBeenCalled();
  expect(h.game.ownedCards).toHaveLength(1);
  expect(h.game.nodeRewards['0,2'].taken).toBe(0);
  if (!saved) { h.controller.resume(); expect(h.UI.el.ovBody.textContent).toContain('尚未保存'); }
});

it.each([true, false])('event choice retry save=%s preserves a replacement page', async saved => {
  const h = fixture(); await h.controller.open('ev19-potions', [h.card]);
  h.setSave(() => false); await h.acts.eventCardPick({ i:0 });
  const gate = deferred(); h.setSave(() => gate.promise);
  const retrying = h.acts.eventCardSaveRetry();
  const page = h.replace(); gate.resolve(saved); await retrying;
  expect(h.UI.el.ovBody.firstElementChild).toBe(page);
  expect(h.close).not.toHaveBeenCalled();
  expect(h.game.ownedCards).toHaveLength(1);
});
