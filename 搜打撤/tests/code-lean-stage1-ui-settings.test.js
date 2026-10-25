import { describe, expect, it, vi } from 'vitest';
import { createMenuSettingsPage } from '../game/src/ui/menu-settings.js';

const { servicePorts, proxy } = vi.hoisted(() => {
  const servicePorts = {};
  return { servicePorts, proxy:names => Object.fromEntries(names.map(name => [name, (...args) => servicePorts[name](...args)])) };
});
vi.mock('../game/src/ui/settings-input.js', () => proxy(['inputSettingsHTML','bindInputSettings']));
vi.mock('../game/src/core/runtime-trace-stages.local.js', () => proxy(['beginRuntimeStage']));
vi.mock('../game/src/ui/performance-settings.js', () => proxy(['performanceSettingsHTML','bindPerformanceSettings']));
vi.mock('../game/src/ui/page-entry-cancellation.js', () => proxy(['cancelPendingPageEntries']));
vi.mock('../game/src/battle/battle-loader.js', () => proxy(['captureBattleContext']));
vi.mock('../game/src/core/storage.js', () => proxy(['storeGet','storeSet']));
vi.mock('../game/src/ui/settings-audio.js', () => proxy(['bindSettingsAudio']));
vi.mock('../game/src/ui/settings-navigation.js', () => proxy(['initSettingsNavigation','settingsLayoutHTML']));
vi.mock('../game/src/ui/home-linked-interactions.js', () => proxy(['linkedBackHTML']));

function exercise(enabled, hooks = {}) {
  document.body.className = '';
  document.body.innerHTML = '<div id="overlay"><div id="body"></div></div><input id="tglIndex">';
  const effects = [], actions = {}, storage = new Map();
  const record = name => (...args) => { effects.push([name, ...args]); };
  const ports = {
    inputSettingsHTML: () => '', performanceSettingsHTML: () => '',
    bindInputSettings: record('bindInput'), bindPerformanceSettings: () => {}, bindSettingsAudio: () => {},
    beginRuntimeStage: () => () => {}, cancelPendingPageEntries: record('cancel'), captureBattleContext: () => () => true,
    storeGet: () => enabled ? '1' : '0', storeSet: (key, value) => { storage.set(key, value); effects.push(['store', key, value]); hooks.store?.(key,value); },
    initSettingsNavigation: () => {}, settingsLayoutHTML: groups => Object.values(groups).join(''),
    linkedBackHTML: () => '<button data-act="closeSettings">返回</button>',
  };
  const sound = { musicMuted: enabled, sfxMuted: enabled, musicVolume: enabled ? .81 : .19, sfxVolume: enabled ? .45 : .63,
    setMusicMuted: record('musicMuted'), setSfxMuted: record('sfxMuted'), sfx: record('sfx'),
    setMusicVolume: record('musicVolume'), setSfxVolume: record('sfxVolume') };
  hooks.configureSound?.(sound);
  const game = { state:'idle', toggles:{ index:enabled }, devMode:enabled };
  let rawHTML;
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('body'), tglIndex:document.getElementById('tglIndex') },
    act: (name, action) => { actions[name] = action; },
    showOverlay: (title, html) => { rawHTML = html; UI.el.ovBody.innerHTML = html; }, hideOverlay:record('hide'),
    confirmAction:record('confirm'), log:record('log') };
  Object.assign(servicePorts, ports);
  const page = createMenuSettingsPage({ UI, game, document, getActiveSlot:() => 1,
    runtime:{ syncDevVisibility:record('dev'), rebuildNotes:record('notes') }, clearAllSlots:() => true,
    openSuggestionInbox:record('inbox'), openDataPageUi:record('data'), battleRestartHTML:() => '', bindBattleRestart:() => {},
    readCards:() => ({ clearAll:() => true }), readNotes:() => ({ clearAll:() => true }), readSound:() => { hooks.readSound?.(); return sound; },
    readMotion:() => ({ refreshReduceMotion:record('motion') }) });
  page.openSettings();
  const html = UI.el.ovBody.innerHTML;
  const initialControls = [...UI.el.ovBody.querySelectorAll('input[type="checkbox"]')].map(input => [input.id,input.checked]);
  const initialVolumeLabels = [...document.querySelectorAll('[id$="VolVal"]')].map(node => node.textContent);
  const initialVolumes = [...UI.el.ovBody.querySelectorAll('input[type="range"]')].map(input => [input.id,input.value]);
  effects.length = 0;
  hooks.beforeInputs?.();
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
  return { rawHTML, html, initialControls, initialVolumes, initialVolumeLabels, effects, storage:[...storage], bodyClass:document.body.className,
    game, volumeLabels:[...document.querySelectorAll('[id$="VolVal"]')].map(node => node.textContent), index:UI.el.tglIndex.checked };
}

describe('settings shared controls public behavior', () => {
  it.each([false,true])('renders ten switches and volume values for enabled=%s', enabled => {
    const result = exercise(enabled);
    expect(result.initialControls).toEqual([
      ['setIndex',enabled],['setHint',enabled],['setBanner',enabled],['setDev',enabled],
      ['setReadingLarge',enabled],['setEndTurnHold',enabled],['setShake',!enabled],
      ['setReduceMotion',enabled],['setMusic',!enabled],['setSfx',!enabled],
    ]);
    expect(result.initialVolumes).toEqual([['setMusicVol',enabled ? '81' : '19'],['setSfxVol',enabled ? '45' : '63']]);
    expect(result.html).toContain('role="switch"');
    expect(result.html).toContain('大字阅读（卡牌说明与词条）');
  });
  it('reads volume ports separately for the range and printed label', () => {
    let musicReads = 0, sfxReads = 0;
    const result = exercise(false, {configureSound:sound => {
      Object.defineProperty(sound,'musicVolume',{get:() => ++musicReads / 10});
      Object.defineProperty(sound,'sfxVolume',{get:() => ++sfxReads / 10});
    }});
    expect(result.initialVolumes).toEqual([['setMusicVol','10'],['setSfxVol','10']]);
    expect(result.initialVolumeLabels).toEqual(['20%','20%']);
    expect([musicReads,sfxReads]).toEqual([2,2]);
  });
  it('observes input changes made reentrantly by sound, volume and storage ports', () => {
    const result = exercise(false, {configureSound:sound => {
      sound.setMusicMuted = () => { document.getElementById('setMusic').checked = true; };
      sound.setMusicVolume = () => { document.getElementById('setMusicVol').value = '68'; };
    },store:key => { if (key === 'sdt-reading-large') document.getElementById('setReadingLarge').checked = true; }});
    expect(result.effects.filter(effect => effect[0] === 'sfx')).toHaveLength(3);
    expect(result.volumeLabels).toEqual(['68%','100%']);
    expect(result.bodyClass.split(' ')).toContain('reading-large');
  });
  it('resolves the sound service before reading range input values', () => {
    let interacting = false;
    const result = exercise(false, {beforeInputs:() => {interacting = true;},readSound:() => {
      if (interacting) document.getElementById('setMusicVol').value = '42';
    }});
    expect(result.effects.filter(effect => effect[0] === 'musicVolume')).toEqual([
      ['musicVolume',.42],['musicVolume',.42],['musicVolume',.42],
    ]);
  });
  it('keeps toggle, volume, invalid bubbled target and return receipts', () => {
    const result = exercise(false);
    expect(result.effects).toEqual([
      ['dev'],['dev'],
      ['store','sdt-hintbar','1'],['store','sdt-hintbar','0'],
      ['store','sdt-banner','1'],['store','sdt-banner','0'],
      ['store','sdt-dev','1'],['dev'],['store','sdt-dev','0'],['dev'],
      ['store','sdt-reading-large','1'],['store','sdt-reading-large','0'],
      ['store','sdt-end-turn-hold','1'],['store','sdt-end-turn-hold','0'],
      ['store','sdt-reduce-shake','0'],['store','sdt-reduce-shake','1'],
      ['store','sdt-reduce-motion','1'],['motion'],['store','sdt-reduce-motion','0'],['motion'],
      ['musicMuted',false],['musicMuted',true],['sfx','ding'],
      ['musicVolume',0],['musicVolume',.37],['musicVolume',1],
      ['sfxMuted',false],['sfx','ding'],['sfxMuted',true],['sfx','ding'],
      ['sfxVolume',0],['sfxVolume',.37],['sfxVolume',1],['sfx','ding'],['hide'],
    ]);
    expect(result.bodyClass.split(' ').sort()).toEqual(['no-banner','no-hintbar']);
    expect(result.game).toEqual({state:'idle',toggles:{index:false},devMode:false});
    expect(result.index).toBe(false);
    expect(result.volumeLabels).toEqual(['100%','100%']);
    expect(result.storage).toEqual([
      ['sdt-hintbar','0'],['sdt-banner','0'],['sdt-dev','0'],
      ['sdt-reading-large','0'],['sdt-end-turn-hold','0'],['sdt-reduce-shake','1'],['sdt-reduce-motion','0'],
    ]);
  });
});
