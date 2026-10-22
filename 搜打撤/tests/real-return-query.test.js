// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
let observers, listeners, UI;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); observers = []; listeners = [];
  const Observer = MutationObserver;
  vi.stubGlobal('MutationObserver', class extends Observer { constructor(cb) { super(cb); observers.push(this); } });
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((...args) => { listeners.push([target, args]); add(...args); });
  }
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><button id="outside">map</button><div id="overlay" class="room-view" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
});
afterEach(() => {
  UI?._cancelPageBg?.(); observers.forEach(o => o.disconnect());
  listeners.forEach(([target,args]) => target.removeEventListener(...args));
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  delete window.SDT; document.body.replaceChildren(); document.body.className='';
  document.head.querySelectorAll('[data-interface-motion]').forEach(l=>l.remove());
});
it.each(['rules', 'settings'])('observes complete synchronous real %s returns including native focus twice', async kind => {
  const SDT = (await import('../game/src/core/sdt-facade.js')).default;
  ({ UI } = await import('../game/src/ui/ui.js'));
  SDT.Icons = { rich: value => value, img: () => '' }; SDT.Sound = { sfx() {} };
  SDT.Motion = { overlayIn() {}, reduceMotion: () => true }; SDT.game = { battleActive: true };
  UI._acts = {}; UI._overlayInerted = []; UI._roomActive = false; UI.init(); window.SDT = SDT; SDT.UI = UI;
  const original = UI.showOverlay;
  await import('../game/src/ui/interface-motion.js');
  expect(UI.showOverlay).not.toBe(original);
  const { createBattleDecisionPresenter, restoreCombatScene } = await import('../game/src/battle/view/battle.decision-shell.js');
  const show = createBattleDecisionPresenter({ UI, getSnapshot: () => ({ battleToken: 7, turn: 2, energy: 3, maxEnergy: 3, opts: {} }), R: () => ({ battleEnergy: 3 }) });
  let recording = false, counts;
  for (const proto of [Element.prototype, Document.prototype]) for (const method of ['querySelector','querySelectorAll']) {
    const originalQuery=proto[method];
    vi.spyOn(proto,method).mockImplementation(function(selector) {
      if (recording) {
        const key=`${proto===Document.prototype?'Document':'Element'}.${method}:${selector}`;
        counts[key]=(counts[key]||0)+1;
      }
      return originalQuery.call(this,selector);
    });
  }
  for (let repetition=0; repetition<2; repetition++) {
    UI.showOverlay('', '<div class="battle-stage sts"><button id="battleAction">end</button><div class="sts-hand">hand</div></div>', 'battle');
    const scene=UI.el.ovBody.firstElementChild; scene._battleToken=7;
    const button=scene.querySelector('button'); button.focus();
    show(kind, '<button data-act="btRulesBack">back</button>', 'settings');
    expect(scene.hasAttribute('inert')).toBe(true);
    const focus=vi.spyOn(button,'focus'); counts={}; recording=true;
    let restored;
    try { restored=restoreCombatScene(UI,7); } finally { recording=false; }
    console.log('REAL_RETURN_METRIC '+JSON.stringify({arm:process.env.QUERY_ARM,kind,repetition,counts}));
    expect(restored).toBe(true); expect(UI.el.ovBody.firstElementChild).toBe(scene);
    expect(scene.hasAttribute('inert')).toBe(false); expect(scene.hasAttribute('aria-hidden')).toBe(false);
    expect(scene.querySelector('.sts-hand').textContent).toBe('hand');
    expect(document.activeElement).toBe(button); expect(focus).toHaveBeenCalledWith({preventScroll:true});
    focus.mockRestore();
  }
});
