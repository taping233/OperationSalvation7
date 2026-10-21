import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRuntimeStages } from '../game/src/core/runtime-trace-stages.local.js';

const observed = vi.hoisted(() => ({ handStates: [], snapshots: 0, captures: 0, begins: 0, snapshotError: null, handError: null, ready: true }));
vi.mock('../game/src/battle/core/battle.core.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, getSnapshot(...args) { observed.snapshots++; if (observed.snapshotError) throw observed.snapshotError; return actual.getSnapshot(...args); } };
});
vi.mock('../game/src/core/runtime-trace-stages.local.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual,
    captureRuntimeStageContext() { observed.captures++; return actual.captureRuntimeStageContext(); },
    beginRuntimeStage(...args) { observed.begins++; return actual.beginRuntimeStage(...args); },
  };
});
vi.mock('../game/src/battle/view/battle.layers.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, updateHand(...args) {
    if (observed.handError) throw observed.handError;
    return actual.updateHand(...args);
  } };
});
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => observed.ready }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}),
  play() {}, setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
vi.mock('../game/src/battle/view/battle.hand-hit.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createHandHitController(...args) {
    const controller = actual.createHandHitController(...args), sync = controller.sync;
    controller.sync = (token, snapshot) => { observed.handStates.push({ token, snapshot }); return sync(token, snapshot); };
    return controller;
  } };
});

const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
let onOverlay = null;
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) {
    this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode;
    const hook = onOverlay; onOverlay = null; hook?.();
  },
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
const originalRaf = window.requestAnimationFrame, originalAnimate = Element.prototype.animate;
let frames, game, disconnect;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const snapshot = () => BattleSession.getSnapshot();
const node = selector => stage().querySelector(selector);
function flush() { for (let i = 0; frames.length && i < 50; i++) frames.shift()(performance.now()); }
function start({ many = true, suffix = '', flushFrames = true } = {}) {
  const ids = ['tt3-magic-lamp', 'tt3-treasure-hunt', 'tt3sp-bloodstorm'];
  if (many) ids.push(...catalog.filter(card => ['武术', '法术'].includes(card.type) && !ids.includes(card.id)).slice(0, 8).map(card => card.id));
  game = {
    ownedCards: ids.map(id => ({ uid: id + suffix, card: catalog.find(card => card.id === id) })),
    inventory: [], usedPocket: [], hp: 80, maxHp: 80, atk: 4, spellPower: 0, coins: 0,
    myClass: '法师', state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `persistent-foe-${i}`, name: `常驻舞台靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  if (flushFrames) flush();
}
function bodyFixture() {
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
}
beforeEach(() => {
  frames = []; onOverlay = null; observed.handStates.length = 0; vi.clearAllMocks();
  observed.snapshotError = observed.handError = null; observed.ready = true;
  Random.reseed('battle-persistent-stage');
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  bodyFixture();
});
afterEach(() => {
  disconnect?.(); disconnect = null; observed.snapshotError = observed.handError = null; observed.ready = true;
  onOverlay = null; clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  flush(); frames = []; actions.clear();
  window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
  vi.restoreAllMocks();
});


function collect() {
  const rows = [], context = { interaction: 1 };
  disconnect = connectRuntimeStages({
    capture: () => context,
    begin(stage, captured) {
      const row = { stage, context: captured, finished: false }; rows.push(row);
      return () => { expect(row.finished).toBe(false); row.finished = true; };
    },
  });
  observed.captures = observed.begins = 0;
  return { rows, context };
}
const labels = rows => rows.map(row => row.stage);
const finished = rows => rows.every(row => row.finished);

describe('opt-in synchronous battle render phases', () => {
  it('does not call timing APIs without a captured diagnostic context', () => {
    start({ many: false }); observed.captures = observed.begins = 0;
    render();
    expect(observed.captures).toBe(1); expect(observed.begins).toBe(0);
  });
  it('keeps the exact readiness promise while closing all phases before returning', () => {
    start({ many: false }); const { rows, context } = collect();
    const readiness = new Promise(() => {}); observed.ready = readiness;
    expect(render()).toBe(readiness);
    expect(labels(rows)).toEqual(['battle-render-sync', 'battle-shell-sync', 'battle-hand-sync']);
    expect(finished(rows)).toBe(true); expect(rows.every(row => row.context === context)).toBe(true);
    expect(observed.captures).toBe(1);
  });
  it('includes snapshot acquisition and closes the total on its original exception', () => {
    start({ many: false }); const { rows } = collect();
    const error = new Error('snapshot failed'); observed.snapshotError = error;
    expect(() => render()).toThrow(error);
    expect(labels(rows)).toEqual(['battle-render-sync']); expect(finished(rows)).toBe(true);
  });
  it('closes an early departed-snapshot invocation without fabricating subphases', () => {
    start({ many: false }); const stale = { ...snapshot(), battleToken: -123 }; const { rows } = collect();
    expect(render(stale)).toBeUndefined();
    expect(labels(rows)).toEqual(['battle-render-sync']); expect(finished(rows)).toBe(true);
  });
  it.each(['shell', 'hand'])('closes measured intervals when %s throws', phase => {
    start({ many: false });
    const error = new Error('phase failed');
    if (phase === 'shell') { UI.showOverlay('cold', '<p>cold</p>', 'settings'); onOverlay = () => { throw error; }; }
    else observed.handError = error;
    const { rows } = collect(); expect(() => render()).toThrow(error);
    expect(labels(rows)).toEqual(phase === 'shell'
      ? ['battle-render-sync', 'battle-shell-sync']
      : ['battle-render-sync', 'battle-shell-sync', 'battle-hand-sync']);
    expect(finished(rows)).toBe(true);
  });
  it('shares context with recursive background refresh and emits only one outer total', () => {
    start({ many: false }); const { rows, context } = collect();
    render({ ...snapshot(), choosing: { cardName: 'choice', options: ['one'] } });
    expect(labels(rows)).toEqual(['battle-render-sync', 'battle-shell-sync', 'battle-hand-sync']);
    expect(observed.captures).toBe(1); expect(rows.every(row => row.context === context)).toBe(true);
    expect(finished(rows)).toBe(true);
    expect(UI.el.ovBody.querySelector('.battle-decision')).not.toBeNull();
  });
  it('retains independent overlapping totals for genuinely reentrant renders', () => {
    start({ many: false }); UI.showOverlay('cold', '<p>cold</p>', 'settings');
    const { rows } = collect(); onOverlay = () => { set$energy(4); render(); };
    render();
    expect(labels(rows)).toEqual(['battle-render-sync', 'battle-shell-sync', 'battle-render-sync', 'battle-shell-sync', 'battle-hand-sync']);
    expect(observed.captures).toBe(2); expect(finished(rows)).toBe(true);
    expect(node('.sts-energy b').textContent).toBe('4');
  });
});
