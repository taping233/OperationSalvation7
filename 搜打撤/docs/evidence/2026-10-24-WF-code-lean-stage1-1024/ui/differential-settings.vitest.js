import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const filename = 'game/src/ui/menu-settings.js';
const oldFile = `node_modules/.cache/lean-stage1-1024/before/${filename}`;
// Run each real factory with identical service ports; only imported services are substituted.
function loadFactory(path, ports) {
  const source = fs.readFileSync(path, 'utf8').replace(/^import .+;\r?\n/gm, '').replace('export function', 'function');
  return new Function(...Object.keys(ports), `${source}\nreturn createMenuSettingsPage;`)(...Object.values(ports));
}
function exercise(path, enabled) {
  document.body.className = '';
  document.body.innerHTML = '<div id="overlay"><div id="body"></div></div><input id="tglIndex">';
  const effects = [], actions = {}, storage = new Map();
  const record = name => (...args) => { effects.push([name, ...args]); };
  const ports = {
    inputSettingsHTML: () => '', performanceSettingsHTML: () => '',
    bindInputSettings: record('bindInput'), bindPerformanceSettings: () => {}, bindSettingsAudio: () => {},
    beginRuntimeStage: () => () => {}, cancelPendingPageEntries: record('cancel'), captureBattleContext: () => () => true,
    storeGet: () => enabled ? '1' : '0', storeSet: (key, value) => { storage.set(key, value); effects.push(['store', key, value]); },
    initSettingsNavigation: () => {}, settingsLayoutHTML: groups => Object.values(groups).join(''),
    linkedBackHTML: () => '<button data-act="closeSettings">返回</button>',
  };
  const sound = { musicMuted: enabled, sfxMuted: enabled, musicVolume: enabled ? .81 : .19, sfxVolume: enabled ? .45 : .63,
    setMusicMuted: record('musicMuted'), setSfxMuted: record('sfxMuted'), sfx: record('sfx'),
    setMusicVolume: record('musicVolume'), setSfxVolume: record('sfxVolume') };
  const game = { state:'idle', toggles:{ index:enabled }, devMode:enabled };
  let rawHTML;
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('body'), tglIndex:document.getElementById('tglIndex') },
    act: (name, action) => { actions[name] = action; },
    showOverlay: (title, html) => { rawHTML = html; UI.el.ovBody.innerHTML = html; }, hideOverlay:record('hide'),
    confirmAction:record('confirm'), log:record('log') };
  const page = loadFactory(path, ports)({ UI, game, document, getActiveSlot:() => 1,
    runtime:{ syncDevVisibility:record('dev'), rebuildNotes:record('notes') }, clearAllSlots:() => true,
    openSuggestionInbox:record('inbox'), openDataPageUi:record('data'), battleRestartHTML:() => '', bindBattleRestart:() => {},
    readCards:() => ({ clearAll:() => true }), readNotes:() => ({ clearAll:() => true }), readSound:() => sound,
    readMotion:() => ({ refreshReduceMotion:record('motion') }) });
  page.openSettings();
  const html = UI.el.ovBody.innerHTML;
  effects.length = 0;
  for (const input of UI.el.ovBody.querySelectorAll('input')) {
    if (input.type === 'checkbox') {
      for (const checked of [true, false]) { input.checked = checked; input.dispatchEvent(new Event('change')); }
    } else {
      for (const value of ['0', '37', '100']) { input.value = value; input.dispatchEvent(new Event('input')); }
      input.dispatchEvent(new Event('change'));
    }
    const child = document.createElement('span'); input.append(child);
    child.dispatchEvent(new Event(input.type === 'checkbox' ? 'change' : 'input', { bubbles:true }));
  }
  actions.closeSettings();
  return { rawHTML, html, effects, storage:[...storage], bodyClass:document.body.className,
    game, volumeLabels:[...document.querySelectorAll('[id$="VolVal"]')].map(node => node.textContent), index:UI.el.tglIndex.checked };
}

describe('stage 1 settings controls against frozen source', () => {
  it.each([false, true])('preserves rendered DOM and every control receipt (enabled=%s)', enabled => {
    expect(exercise(filename, enabled)).toEqual(exercise(oldFile, enabled));
  });
});
