import { afterEach, describe, expect, it } from 'vitest';
import { createGameMenuController } from './helpers/menu-controller.js';

function openSettings() {
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  const ovBody = document.getElementById('ovBody');
  const acts = {};
  const UI = {
    el: { overlay, ovBody, ovTitle: document.getElementById('ovTitle') },
    act: (name, handler) => { acts[name] = handler; },
    showOverlay(_title, html) { ovBody.innerHTML = html; overlay.hidden = false; },
    hideOverlay() { overlay.hidden = true; },
    log() {},
  };
  const game = { state: 'title', toggles: { index: false }, devMode: false };
  const SDT = { Sound: {
    musicMuted: false, musicSource: 'scape', musicVolume: 0.7,
    sfxMuted: false, sfxVolume: 0.6,
    setMusicMuted() {}, setMusicSource() {}, setSfxMuted() {}, setMusicVolume() {}, setSfxVolume() {}, sfx() {},
  }, Notes: { clearAll() {} }, Cards: { clearAll() {} } };
  const controller = createGameMenuController({
    SDT, UI, game, runtime: { syncDevVisibility() {}, rebuildNotes() {} },
    clearAllSlots() {}, esc: value => value,
  });
  controller.openSettings();
  return { acts, game, UI };
}

afterEach(() => { document.body.innerHTML = ''; localStorage.clear(); });

describe('settings page layout and controls', () => {
  it('groups everyday, display, audio, records, credits and dangerous actions while retaining control hooks', () => {
    const { acts, UI } = openSettings();
    const root = UI.el.ovBody.querySelector('.settings-page');
    expect(root.querySelectorAll('.settings-group')).toHaveLength(6);
    for (const id of ['setIndex', 'setHint', 'setBanner', 'setDev', 'setShake', 'setReduceMotion', 'setMusic', 'setMusicVol', 'setSfx', 'setSfxVol']) {
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
