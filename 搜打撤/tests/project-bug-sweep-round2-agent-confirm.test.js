import { afterEach, expect, it, vi } from 'vitest';
import { collectUiActions } from '../game/src/agent/agent.surface.js';
import { invokeUiAction } from '../game/src/ui/action-dispatch.js';
import { makeRuntimeBattleGame } from './helpers/battle-fixtures.js';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}), play() {},
  setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _acts: {},
  act(name, fn) { this._acts[name] = fn; },
  showOverlay(title, html, mode, options = {}) {
    if (options.battleBody) options.battleBody(rich(html));
    else this.el.ovBody.innerHTML = rich(html);
    this.el.overlay.hidden = false; this._lastMode = mode;
  },
  hideOverlay() { this.el.overlay.hidden = true; },
  hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 10, bossDeckSize: 15, starterSha: 0, battleStartDraw: 1, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
window.SDT.Cards.ensureSha();

afterEach(() => {
  if (window.SDT.game?.battleActive) BattleSession.commands.flee();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('an observed first withdrawal click cannot become confirmation after the same real button arms', async () => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  UI._acts = {};
  const game = makeRuntimeBattleGame([window.SDT.Cards.all().find(card => card.id === 'sha')]);
  game.onBattleEnd = vi.fn();
  window.SDT.game = game;
  BattleSession.start(game, [{ id:'confirm-foe', name:'确认靶子', hp:100, atk:1 }], { isBoss:false });
  render();
  await vi.advanceTimersByTimeAsync(1000);
  render();
  // Exercise the retained confirmation contract through an explicit fixture control.
  const button=document.createElement('button');button.dataset.act='btFlee';button.className='ov-btn ghost';button.textContent='撤离（判负）';
  UI.el.ovBody.querySelector('.sts-tactics').append(button);
  expect(button?.disabled, JSON.stringify(BattleSession.getSnapshot())).toBe(false);
  const oldAction = collectUiActions().find(action => action.name === 'btFlee');
  expect(oldAction).toBeTruthy();
  expect(invokeUiAction(UI, button, { expected:oldAction }).ok).toBe(true);
  expect(button.dataset.confirm).toBe('1');
  expect(game.battleActive).toBe(true);
  expect(invokeUiAction(UI, button, { expected:oldAction })).toEqual({ ok:false, reason:'unavailable' });
  expect(game.onBattleEnd).not.toHaveBeenCalled();
  const freshAction = collectUiActions().find(action => action.name === 'btFlee');
  expect(freshAction.params.confirm).toBe('1');
  expect(invokeUiAction(UI, button, { expected:freshAction }).ok).toBe(true);
  expect(game.battleActive).toBe(false);
  expect(game.onBattleEnd).toHaveBeenCalledOnce();
});
