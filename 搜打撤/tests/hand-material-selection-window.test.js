import { battleViewMocks, overlayElements, inventoryFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));

const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode, options = {}) {
    this._overlayRevision = (this._overlayRevision || 0) + 1;
    if (options.battleBody) { if (!options.battleBody(rich(html))) return; }
    else this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 9, 99, 5, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
await import('../game/src/battle/view/battle.view.js');
const { createHandMaterialSelection } = await import('../game/src/battle/view/battle.hand-material-selection.js');
const { nextHandSelectionId } = await import('../game/src/battle/core/battle.hand-selection.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const bar = () => stage()?.querySelector('[data-infusion-workspace]') || stage()?.querySelector(':scope > .bt-infuse');
const material = uid => stage()?.querySelector(`.sts-hand .bt-card[data-uid="${uid}"]`);
const snapshot = () => BattleSession.getSnapshot();
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!snapshot().busy && !snapshot().actionQueueLength) { flush(); return; }
  }
  throw new Error('Infusion action did not settle');
}
function start({ name = '血蝠风暴', potion = false, cardId = 'tt3sp-bloodstorm' } = {}) {
  const infusion = { ...Cards.all().find(card => card.id === cardId), name };
  game = {
    ownedCards: [
      { uid: 'infusion', card: infusion }, { uid: 'fuel-a', card: Cards.SHA }, { uid: 'fuel-b', card: Cards.SHA },
      ...(potion ? [{ uid: 'potion', card: Cards.all().find(card => card.id === 'tt3-iceheart-potion') }] : []),
    ],
    ...inventoryFields(30, 30, 0, null), log: vi.fn(), heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `foe-${i}`, name: `靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  frames = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { ...overlayElements() };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  Aim.cancelAim(); Aim.cancelClickSelection();
  clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
  vi.unstubAllGlobals();
});

describe('hand consumption uses the shared material workspace', () => {
  it('payment stages and withdraws exact copies, then pays only on confirmation', async () => {
    start({ cardId:'tt7-thundergrudge' });
    BattleSession.commands.playCard('infusion', 0); flush();
    const before = snapshot();
    expect(before.infusing).toBeNull(); expect(before.handSelecting.act).toBe('payment');
    expect(bar().getAttribute('aria-label')).toBe('选择消耗代价');
    expect(bar().querySelector('[data-act="btInfuseDirect"]')).toBeNull();
    expect(bar().querySelector('[data-act="btInfuseCancel"]')).toBeNull();
    material('fuel-a').click(); flush(); material('fuel-b').querySelector('.hs-card').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); flush();
    expect(snapshot().energy).toBe(before.energy); expect(snapshot().hand).toEqual(before.hand);
    expect(snapshot().handSelecting.selectedUids).toEqual([]);
    expect(bar().querySelectorAll('.infusion-selected-card')).toHaveLength(2);
    bar().querySelector('[data-act="btInfuseRemove"][data-uid="fuel-a"]').click(); flush();
    expect(bar().querySelectorAll('.infusion-selected-card')).toHaveLength(1);
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    material('fuel-a').click(); flush(); bar().querySelector('[data-act="btInfuseGo"]').click();
    await settle();
    expect(snapshot().handSelecting).toBeNull(); expect(snapshot().infuseFuels).toBe(before.infuseFuels);
    expect(snapshot().consumed.filter(uid => ['fuel-a','fuel-b'].includes(uid)).sort()).toEqual(['fuel-a','fuel-b']);
    expect(snapshot().energy).toBe(before.energy - 1);
  });

  it('canonical armor payment offers equipment including cards forbidden as infusion fuel', async () => {
    start({ cardId:'tt2-turtlearmor' });
    for (const uid of ['fuel-a','fuel-b']) game.ownedCards.find(entry => entry.uid === uid).card = {
      id:'qa-gear', name:'禁注能装备', type:'装备', cost:0, desc:'无法作为注能材料。',
    };
    BattleSession.commands.playCard('infusion', 'self'); flush();
    expect(snapshot().handSelecting).toMatchObject({ act:'payment', type:'装备' });
    expect(material('fuel-a').classList.contains('off')).toBe(false);
    material('fuel-a').click(); flush();
    expect(snapshot().pdef.armor).toBe(0);
    bar().querySelector('[data-act="btInfuseGo"]').click(); await settle();
    expect(snapshot().pdef.armor).toBe(10); expect(snapshot().hand).toContain('fuel-b');
  });

  it('effect consume uses a draft and queued lethal reactions settle each selected UID once', async () => {
    start();
    game.ownedCards[0].card = { id:'qa-consume', name:'选择消耗', type:'武术', cost:0, desc:'消耗 2 张武术牌，+10甲。' };
    game.ownedCards[1].card = { id:'qa-lethal', name:'终战材料', type:'武术', cost:0, desc:'',
      rules:{ version:1, triggers:{ onConsume:[{ op:'damage', amount:1000, target:'allEnemies' }] } } };
    BattleSession.commands.playCard('infusion', 'self'); await settle();
    expect(bar().getAttribute('aria-label')).toBe('选择消耗手牌');
    const before = snapshot();
    material('fuel-a').click(); flush(); material('fuel-b').click(); flush();
    expect(snapshot().consumed).toEqual(before.consumed);
    game.onBattleEnd = vi.fn();
    bar().querySelector('[data-act="btInfuseGo"]').click(); await settle();
    expect(game.battleActive).toBe(false);
    const consumed = game.onBattleEnd.mock.calls[0][3];
    expect(consumed).toEqual(['fuel-a', 'fuel-b']);
  });
});

function draftFixture(act = 'payment') {
  const source = { id:'source', name:'同名源牌', type:'武术', cost:1, desc:'' };
  const entries = new Map(['a','b'].map(uid => [uid,{ uid, card:{ id:'fuel', name:'同名材料', type:'武术', cost:0, desc:'' } }]));
  let state = { battleToken:44, phase:'player', hand:['source','a','b'], handSelecting:{
    selectionId:nextHandSelectionId(), act, n:2, candidateUids:['a','b'], canCancel:act === 'consume',
    selectedUids:[], ...(act === 'payment' ? { payment:{ uid:'source', card:source } } : { srcCard:source }),
  } };
  const commands = { pickHandSelect:vi.fn(), skipHandSelect:vi.fn() };
  const controller = createHandMaterialSelection({ getSnapshot:() => state, commands, findCard:uid => entries.get(uid), requestRender:vi.fn() });
  return { controller, commands, entries, get state() { return state; }, set state(value) { state = value; } };
}

describe('material draft ownership and validation', () => {
  it('does not mutate selectedUids, and stale same-name payment callbacks cannot submit', () => {
    const f = draftFixture(); const accepted = Object.freeze(['prior']);
    f.state.handSelecting.selectedUids = accepted;
    const view = f.controller.project(f.state); view.toggle('a'); view.toggle('b');
    expect(accepted).toEqual(['prior']);
    f.state.handSelecting = { ...f.state.handSelecting, selectionId:nextHandSelectionId() };
    view.confirm(); expect(f.commands.pickHandSelect).not.toHaveBeenCalled();
  });
  it.each(['leave','transform'])('rejects the whole draft when a selected card changes: %s', kind => {
    const f = draftFixture(), view = f.controller.project(f.state); view.toggle('a'); view.toggle('b');
    if (kind === 'leave') f.state.hand = ['source','b']; else f.entries.get('a').card.cost = 3;
    view.confirm(); expect(f.commands.pickHandSelect).not.toHaveBeenCalled();
  });
  it('only optional effect selection can skip; no resources are paid by draft cancellation', () => {
    const payment = draftFixture(); expect(payment.controller.project(payment.state).cancel()).toBe(false);
    const effect = draftFixture('consume'), view = effect.controller.project(effect.state); view.toggle('a');
    expect(view.cancel()).toBe(true); expect(effect.commands.skipHandSelect).toHaveBeenCalledOnce();
    expect(effect.commands.pickHandSelect).not.toHaveBeenCalled();
  });
  it.each(['new-selection','new-battle'])('never submits remaining effect choices into %s', kind => {
    const f = draftFixture('consume'), view = f.controller.project(f.state); view.toggle('a'); view.toggle('b');
    f.commands.pickHandSelect.mockImplementation(() => {
      f.state = { ...f.state, ...(kind === 'new-battle' ? { battleToken:45 } : {}),
        handSelecting:{ ...f.state.handSelecting, selectionId:nextHandSelectionId(), n:1 } };
    });
    view.confirm(); expect(f.commands.pickHandSelect).toHaveBeenCalledExactlyOnceWith('a');
  });
});

