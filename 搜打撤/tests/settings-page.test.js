import { installRuntimeTrace } from '../game/src/core/runtime-trace.local.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from './helpers/menu-controller.js';

function openSettings({ mounted = () => {} } = {}) {
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  const acts = {};
  const UI = {
    el: { overlay, ovBody, ovTitle: document.getElementById('ovTitle') },
    act: (name, handler) => { acts[name] = handler; },
    showOverlay(_title, html) { ovBody.innerHTML = html; overlay.hidden = false; mounted(ovBody); },
    hideOverlay() { overlay.hidden = true; },
    log() {},
  };
  const game = { state: 'title', toggles: { index: false }, devMode: false };
  const SDT = { Sound: {
    musicMuted: false, musicSource: 'scape', musicVolume: 0.7,
    sfxMuted: false, sfxVolume: 0.6,
    setMusicMuted() {}, setMusicSource() {}, setSfxMuted() {}, setMusicVolume() {}, setSfxVolume() {}, sfx() {},
  }, Notes: { clearAll() {} }, Cards: { clearAll() {} } };
  const clearAllSlots = vi.fn();
  const controller = createGameMenuController({
    SDT, UI, game, runtime: { syncDevVisibility() {}, rebuildNotes() {} },
    clearAllSlots, esc: value => value,
  });
  controller.openSettings();
  return { acts, game, UI, SDT, controller, clearAllSlots };
}

afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('settings page layout and controls', () => {
  it('mounts the final hidden panels and switch wrappers without reparenting controls', () => {
    let controls, parents, observer;
    const { UI } = openSettings({ mounted(body) {
      expect(body.querySelectorAll('.settings-nav [role="tab"]')).toHaveLength(5);
      expect(body.querySelectorAll('.settings-panel')).toHaveLength(5);
      expect(body.querySelectorAll('.settings-panel[hidden]')).toHaveLength(4);
      expect(body.querySelectorAll('.settings-row-copy')).toHaveLength(8);
      expect(body.querySelectorAll('input[type="checkbox"][role="switch"]')).toHaveLength(8);
      controls = [...body.querySelectorAll('input, select')]; parents = controls.map(node => node.parentElement);
      observer = new MutationObserver(() => {}); observer.observe(body, { childList:true, subtree:true });
    } });
    expect([...UI.el.ovBody.querySelectorAll('input, select')]).toEqual(controls);
    expect(controls.map(node => node.parentElement)).toEqual(parents);
    expect(observer.takeRecords()).toEqual([]); observer.disconnect();
  });

  it('reopens with fresh persisted, game and audio values and resets danger confirmation', () => {
    vi.useFakeTimers();
    const { acts, game, UI, SDT, controller, clearAllSlots } = openSettings();
    const oldInput = UI.el.ovBody.querySelector('#setHint');
    oldInput.checked = false; oldInput.dispatchEvent(new Event('change', { bubbles:true }));
    acts.wipeSave(); expect(clearAllSlots).not.toHaveBeenCalled();
    expect(UI.el.ovBody.querySelector('[data-act="wipeSave"]').dataset.confirm).toBe('1');
    acts.closeSettings();
    localStorage.setItem('sdt-banner','0'); localStorage.setItem('sdt-reduce-shake','1');
    game.toggles.index = true; game.devMode = true; SDT.Sound.musicMuted = true; SDT.Sound.musicVolume = .25;
    controller.openSettings();
    expect(UI.el.ovBody.querySelector('#setHint')).not.toBe(oldInput);
    for (const id of ['setHint','setBanner','setShake','setMusic']) expect(UI.el.ovBody.querySelector('#'+id).checked).toBe(false);
    for (const id of ['setIndex','setDev']) expect(UI.el.ovBody.querySelector('#'+id).checked).toBe(true);
    expect(UI.el.ovBody.querySelector('#setMusicVol').value).toBe('25');
    expect(UI.el.ovBody.querySelector('[data-act="wipeSave"]').dataset.confirm).toBeUndefined();
    acts.wipeSave(); expect(clearAllSlots).not.toHaveBeenCalled();
    acts.wipeSave(); expect(clearAllSlots).toHaveBeenCalledOnce();
    acts.closeSettings(); expect(game.state).toBe('title');
  });

  it('keeps Home/End/wrap focus, per-category scroll, and control identity', () => {
    const { UI } = openSettings(); const body = UI.el.ovBody;
    const tabs = body.querySelectorAll('[role="tab"]'), content = body.querySelector('.settings-content');
    const input = body.querySelector('#setIndex'); content.scrollTop = 61;
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key:'End', bubbles:true }));
    expect(document.activeElement).toBe(tabs[4]); expect(content.scrollTop).toBe(0);
    content.scrollTop = 23;
    tabs[4].dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
    expect(document.activeElement).toBe(tabs[0]); expect(content.scrollTop).toBe(61);
    tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowUp', bubbles:true }));
    expect(document.activeElement).toBe(tabs[4]); expect(content.scrollTop).toBe(23);
    tabs[4].dispatchEvent(new KeyboardEvent('keydown', { key:'Home', bubbles:true }));
    expect(document.activeElement).toBe(tabs[0]); expect(body.querySelector('#setIndex')).toBe(input);
  });

  it('reads both marker dimensions before either marker style write', () => {
    const { UI } = openSettings(); const tab = UI.el.ovBody.querySelector('#settings-tab-display');
    const order = [];
    Object.defineProperty(tab, 'offsetTop', { get() { order.push('top'); return 84; } });
    Object.defineProperty(tab, 'offsetHeight', { get() { order.push('height'); return 74; } });
    const style = UI.el.ovBody.querySelector('.settings-nav').style;
    const original = style.setProperty.bind(style);
    vi.spyOn(style, 'setProperty').mockImplementation((name, ...args) => { order.push(name); return original(name,...args); });
    tab.click();
    expect(order).toEqual(['top','height','--settings-marker-top','--settings-marker-height']);
  });

  it('records actual overlay and navigation boundaries once per open', () => {
    const { UI } = openSettings();
    window.history.replaceState({}, '', '/?runtimeTrace=1');
    const trace = installRuntimeTrace();
    try {
      UI.el.ovBody.querySelector('[data-act="closeSettings"]').click();
      openSettings();
      expect(trace.read().records.filter(row => row.kind === 'stage').map(row => row.stage))
        .toEqual(['settings-overlay-sync', 'settings-navigation-sync']);
    } finally { trace.destroy(); window.history.replaceState({}, '', '/'); }
  });

  it('groups everyday, display, audio, records, credits and dangerous actions while retaining control hooks', () => {
    const { acts, UI } = openSettings();
    const root = UI.el.ovBody.querySelector('.settings-page');
    expect(root.querySelectorAll('.settings-group')).toHaveLength(6);
    for (const id of ['setIndex', 'setHint', 'setBanner', 'setDev', 'setShake', 'setReduceMotion', 'setQuality', 'setFrameLimit', 'setMusic', 'setMusicVol', 'setMusicStatus', 'setMusicRetry', 'setSfx', 'setSfxVol']) {
      expect(root.querySelector(`#${id}`), `missing #${id}`).not.toBeNull();
    }
    expect(root.querySelector('#setMusicSource')).toBeNull(); // 配乐固定使用已实装原创曲库。
    expect(root.querySelector('.settings-danger [data-act="wipeSave"]')).not.toBeNull();
    expect(root.querySelector('.settings-records [data-act="openInbox"]')).not.toBeNull();
    expect(root.querySelector('.settings-records [data-act="openDataPageUi"]')).not.toBeNull();
    for (const name of ['closeSettings', 'wipeNotes', 'wipeCards', 'wipeSave', 'openInbox', 'openDataPageUi']) {
      expect(acts[name], `missing action ${name}`).toBeTypeOf('function');
    }
  });

  it('keeps close behavior and immediate preference controls wired', () => {
    const { acts, game, UI } = openSettings();
    UI.el.ovBody.querySelector('#setHint').checked = false;
    UI.el.ovBody.querySelector('#setHint').dispatchEvent(new Event('change', { bubbles: true }));
    expect(localStorage.getItem('sdt-hintbar')).toBe('0');
    expect(document.body.classList.contains('no-hintbar')).toBe(true);
    acts.closeSettings();
    expect(UI.el.overlay.hidden).toBe(true);
    expect(game.state).toBe('title');
  });

  it('switches categories by click and keyboard without losing preference state', () => {
    const { UI } = openSettings();
    const root = UI.el.ovBody;
    const tabs = root.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(5);
    expect(root.querySelector('#settings-panel-general').hidden).toBe(false);
    expect(root.querySelector('#settings-panel-data').hidden).toBe(true);
    tabs[2].click();
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('#settings-panel-audio').hidden).toBe(false);
    const music = root.querySelector('#setMusic');
    music.checked = false;
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(root.querySelector('#settings-panel-audio').hidden).toBe(true);
    expect(root.querySelector('#settings-panel-data').hidden).toBe(false);
    expect(document.activeElement).toBe(tabs[3]);
    expect(root.querySelector('#settings-panel-data [data-act="wipeSave"]')).not.toBeNull();
    tabs[2].click();
    expect(root.querySelector('#setMusic')).toBe(music);
    expect(music.checked).toBe(false);
  });
});
