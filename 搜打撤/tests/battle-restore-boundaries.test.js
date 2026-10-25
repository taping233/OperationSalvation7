import { afterAll, expect, it, vi } from 'vitest';
import { connectRuntimeStages } from '../game/src/core/runtime-trace-stages.local.js';
const observed = vi.hoisted(() => ({ rows: [], profiles: [], captures: 0, begins: 0 }));
vi.mock('../game/src/core/runtime-trace-stages.local.js', async original => {
  const actual = await original();
  return { ...actual, beginRuntimeStage(...args) { observed.begins++; return actual.beginRuntimeStage(...args); } };
});
vi.mock('../game/src/ui/page-motion-profiles.js', async original => {
  const actual = await original();
  return { ...actual, pageMotionProfile(...args) {
    observed.profiles.push(observed.rows.filter(row => !row.finished).map(row => row.stage));
    return actual.pageMotionProfile(...args);
  } };
});
let UI, disconnect;
afterAll(() => { disconnect?.(); UI?._cancelPageBg?.(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('measures real installed show wrapper and unshield/focus with ownership, errors and context controls', async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><button id="outside">map</button><div id="overlay" class="room-view" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  const SDT = (await import('../game/src/core/sdt-facade.js')).default;
  ({ UI } = await import('../game/src/ui/ui.js'));
  SDT.Icons = { rich: value => value, img: () => '' }; SDT.Sound = { sfx() {} };
  SDT.Motion = { overlayIn() {}, reduceMotion: () => true }; SDT.game = { battleActive: true };
  UI._acts = {}; UI._overlayInerted = []; UI._roomActive = false; UI.init(); window.SDT = SDT; SDT.UI = UI;
  await import('../game/src/ui/interface-motion.js');
  expect(document.body.classList.contains('interface-motion')).toBe(true);
  const { createBattleDecisionPresenter, restoreCombatScene: restore } = await import('../game/src/battle/view/battle.decision-shell.js');
  const show = createBattleDecisionPresenter({ UI, getSnapshot: () => ({ battleToken: 7, turn: 2, energy: 3, maxEnergy: 3, opts: {} }), R: () => ({ battleEnergy: 3 }) });
  const context = { interaction: 1 }, newer = { interaction: 2 };
  let latest = context, scene, button;
  const labels = () => observed.rows.map(row => row.stage);
  const reset = () => { observed.rows.length = observed.profiles.length = 0; observed.captures = observed.begins = 0; };
  const setup = () => {
    UI.showOverlay('', '<div class="battle-stage sts"><button id="battleAction">end</button><div class="sts-hand"></div></div>', 'battle');
    scene = UI.el.ovBody.firstElementChild; scene._battleToken = 7;
    button = scene.querySelector('button'); button.focus();
    show('rules', '<button data-act="btRulesBack">back</button>', 'discover'); reset();
  };
  disconnect = connectRuntimeStages({
    capture() { observed.captures++; return latest; },
    begin(stage, captured) {
      const row = { stage, context: captured, finished: false }; observed.rows.push(row);
      return () => { expect(row.finished).toBe(false); row.finished = true; };
    },
  });
  setup();
  const focus = vi.spyOn(button, 'focus');
  focus.mockImplementation(() => {
    expect(scene.hasAttribute('inert')).toBe(false); expect(scene.hasAttribute('aria-hidden')).toBe(false);
    expect(scene._secondaryReturnFocus).toBeUndefined();
    expect(observed.rows.map(row => row.finished)).toEqual([true, false]);
  });
  document.addEventListener('sdt-overlay-mode', () => { latest = newer; }, { once: true });
  expect(restore(UI, 7, { traceContext: context })).toBe(true);
  expect(labels()).toEqual(['battle-restore-show-sync', 'battle-restore-focus-sync']);
  expect(observed.profiles).toEqual([]); // Retained combat does not rerun page profiling.
  expect(observed.rows.every(row => row.finished && row.context === context)).toBe(true);
  expect(observed.captures).toBe(0); expect(focus).toHaveBeenCalledWith({ preventScroll: true }); focus.mockRestore();
  expect(UI.el.ovBody.firstElementChild).toBe(scene);

  // No layer and wrong token never start a child interval.
  reset(); expect(restore(UI, 7, { traceContext: context })).toBe(false); expect(observed.begins).toBe(0);
  setup(); expect(restore(UI, 8, { traceContext: context })).toBe(false); expect(observed.begins).toBe(0);
  expect(scene.hasAttribute('inert')).toBe(true);

  // A synchronous replacement makes ownership fail between show and focus.
  setup();
  document.addEventListener('sdt-overlay-mode', () => { scene._battleToken = 8; }, { once: true });
  expect(restore(UI, 7, { traceContext: context })).toBe(false);
  expect(labels()).toEqual(['battle-restore-show-sync']); expect(observed.rows[0].finished).toBe(true);
  expect(scene.hasAttribute('inert')).toBe(true);

  // Original thrown values escape unchanged, but each started interval closes.
  setup(); const showError = new Error('show error');
  const showSpy = vi.spyOn(UI, 'showOverlay').mockImplementation(() => { throw showError; });
  expect(() => restore(UI, 7, { traceContext: context })).toThrow(showError);
  expect(labels()).toEqual(['battle-restore-show-sync']); expect(observed.rows[0].finished).toBe(true); showSpy.mockRestore();
  setup(); const focusError = new Error('focus error');
  const focusSpy = vi.spyOn(button, 'focus').mockImplementation(() => { throw focusError; });
  expect(() => restore(UI, 7, { traceContext: context })).toThrow(focusError);
  expect(labels()).toEqual(['battle-restore-show-sync', 'battle-restore-focus-sync']);
  expect(observed.rows.every(row => row.finished)).toBe(true); focusSpy.mockRestore();

  // Missing diagnostic context starts no timer even with a connected sink/latest input.
  setup(); expect(restore(UI, 7)).toBe(true); expect(observed.begins).toBe(0); expect(observed.captures).toBe(0);
});
