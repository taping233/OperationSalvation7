// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountCombatOverlay, restoreCombatScene } from '../game/src/battle/view/battle.secondary-overlay.js';
import { renderExpeditionPanel } from '../game/src/run/expedition.view.js';
import { registerRuntimeTracePanel } from '../game/src/core/runtime-trace-panel.local.js';
import { connectRuntimeStages } from '../game/src/core/runtime-trace-stages.local.js';
window.SDT ||= {};
const SDT = window.SDT;
const { overlayMethods } = await import('../game/src/ui/overlay.js');
let UI, scene, trigger, unregisterPanel, disconnectTrace;
beforeEach(() => {
  vi.useFakeTimers();
  Object.assign(SDT, { Icons: { rich: html => html, img: () => '' }, Sound: { sfx() {}, scene() {} }, Motion: { overlayIn() {}, reduceMotion: () => true }, game: { battleActive: true } });
  document.body.className = 'interface-motion';
  document.body.innerHTML = '<main id="viewport"><button id="outside">地图</button><aside id="sidebar"><div id="routePanel"></div></aside><div id="overlay" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><button id="ovCloseX">×</button><div id="ovBody"></div></div></div></main><aside id="untrusted"><button id="external">外部</button></aside>';
  UI = { ...overlayMethods, _overlayInerted: [], _acts: {}, _roomActive: false, _overlayRevision: 0, el: Object.fromEntries(['overlay', 'ovTitle', 'ovBody', 'ovCloseX'].map(id => [id, document.getElementById(id)])) };
  UI.showOverlay('', '<div class="battle-stage"><button id="battleAction">结束回合</button><div class="sts-hand">手牌</div></div>', 'battle');
  scene = UI.el.ovBody.firstElementChild; scene._battleToken = 7;
  scene._battleRenderCurrent = () => true;
  trigger = document.getElementById('battleAction'); trigger.focus();
});
afterEach(() => {
  unregisterPanel?.(); unregisterPanel = null; disconnectTrace?.(); disconnectTrace = null;
  UI._cancelPageBg?.(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  document.body.replaceChildren(); document.body.className = '';
});
const show = (html = '<button id="back" data-cancel="true">返回</button>', mode = 'discover') => mountCombatOverlay(UI, '规则', html, mode, scene);

it.each(['rules', 'settings', 'discover'])('%s stays continuously connected, shielded at both mode hooks, fully covered, and synchronously restores focus', kind => {
  const marker = document.createElement('i'); scene.append(marker);
  const observer = new MutationObserver(() => {}); observer.observe(UI.el.ovBody, { childList: true, subtree: true });
  const events = [];
  const onMode = event => events.push({ mode: event.detail, connected: scene.isConnected && marker.isConnected, inert: scene.hasAttribute('inert'), hidden: scene.getAttribute('aria-hidden') });
  document.addEventListener('sdt-overlay-mode', onMode);
  try {
    for (let i = 0; i < 3; i++) {
      expect(show(`<section class="${kind === 'settings' ? 'bt-settings' : ''}"><button id="back" data-cancel="true">返回</button></section>`)).toBe(true);
      expect(UI._hasBattleStage).toBe(true);
      expect(UI.el.ovBody.parentElement.classList.contains('battle')).toBe(true);
      expect(document.body.classList.contains('page-covered')).toBe(true);
      vi.runOnlyPendingTimers(); expect(document.activeElement.id).toBe('back');
      expect(UI._overlayFocusable()).not.toContain(trigger);
      expect(restoreCombatScene(UI, 7)).toBe(true);
      // No requestAnimationFrame/timer flush may be required for return focus.
      expect(document.activeElement).toBe(trigger);
      expect(scene.hasAttribute('inert')).toBe(false);
      expect(scene.hasAttribute('aria-hidden')).toBe(false);
      expect(UI.el.ovBody.children).toHaveLength(1);
    }
  } finally { document.removeEventListener('sdt-overlay-mode', onMode); }
  const removed = observer.takeRecords().flatMap(record => [...record.removedNodes]); observer.disconnect();
  expect(removed.some(node => node === scene || node.contains?.(scene) || node === marker)).toBe(false);
  expect(events).toHaveLength(6);
  expect(events.every(event => event.connected && event.inert && event.hidden === 'true')).toBe(true);
  expect(events.map(event => event.mode)).toEqual(['discover', 'battle', 'discover', 'battle', 'discover', 'battle']);
});

it('secondary body selectors never consume retained scene explicit focus, background assets, or sound nodes', () => {
  trigger.dataset.initialFocus = '';
  scene.insertAdjacentHTML('beforeend', '<div class="node-pg sc-old" data-asset-key="old" data-music-scene="old"></div>');
  const background = vi.spyOn(UI, '_checkPageBg'); const sound = vi.spyOn(SDT.Sound, 'scene');
  expect(show('<button>普通</button><button id="explicit" data-initial-focus>指定</button>')).toBe(true);
  vi.runOnlyPendingTimers(); expect(document.activeElement.id).toBe('explicit');
  expect(background.mock.calls.at(-1)[0]).toBe(document.querySelector('.battle-secondary-layer'));
  expect(sound).toHaveBeenLastCalledWith(null, '', { mode: 'discover' });
  expect(restoreCombatScene(UI, 7)).toBe(true);
  expect(background.mock.calls.at(-1)[0].querySelector('[data-asset-key]')).toBeNull();
  expect(sound).toHaveBeenLastCalledWith(null, '', { mode: 'battle' });
});

it('transparent layer blocks background pointerdown and blank click but leaves action clicks and Escape available', () => {
  show(); const pointer = vi.fn(), clicks = vi.fn(), back = vi.fn();
  UI.el.ovBody.addEventListener('pointerdown', pointer); UI.el.ovBody.addEventListener('click', clicks);
  const layer = document.querySelector('.battle-secondary-layer');
  layer.dispatchEvent(new Event('pointerdown', { bubbles: true })); layer.click();
  expect(pointer).not.toHaveBeenCalled(); expect(clicks).not.toHaveBeenCalled();
  document.getElementById('back').addEventListener('click', back);
  expect(UI.closeTopOverlayByEsc()).toBe(true); expect(back).toHaveBeenCalledOnce(); expect(clicks).toHaveBeenCalledOnce();
});

it.each(['pre-mount', 'mode'])('%s reentrant ordinary overlay wins title, content, coverage and battle flags', hook => {
  const replacement = () => UI.showOverlay('新页', '<button id="new">继续</button>', 'glass');
  if (hook === 'pre-mount') UI.hideTooltip = vi.fn().mockImplementationOnce(replacement);
  else document.addEventListener('sdt-overlay-mode', replacement, { once: true });
  expect(show()).toBe(false);
  expect(UI.el.ovTitle.textContent).toBe('新页'); expect(document.getElementById('new')).not.toBeNull();
  expect(UI._lastMode).toBe('glass'); expect(UI._hasBattleStage).toBe(false);
  expect(document.body.classList.contains('page-covered')).toBe(false);
  expect(UI.el.ovBody.parentElement.classList.contains('battle')).toBe(false);
});

it.each(['revision', 'token', 'body', 'owner'])('a newer %s prevents old mount ownership from being used', kind => {
  document.addEventListener('sdt-overlay-mode', () => {
    if (kind === 'revision') UI._overlayRevision++;
    if (kind === 'token') scene._battleToken++;
    if (kind === 'body') { const next = document.createElement('div'); UI.el.ovBody.after(next); UI.el.ovBody = next; }
    if (kind === 'owner') scene._battleRenderCurrent = () => true;
  }, { once: true });
  expect(show()).toBe(false); expect(scene.isConnected).toBe(true); expect(scene.hasAttribute('inert')).toBe(true);
});

it('invalidated old scene is removed only when its captured owner has not changed', () => {
  let current = true; scene._battleRenderCurrent = () => current;
  document.addEventListener('sdt-overlay-mode', () => { current = false; }, { once: true });
  expect(show()).toBe(false); expect(scene.isConnected).toBe(false); expect(UI._hasBattleStage).toBe(false);
});

it('invalidated callback never removes a same-node scene claimed by a newer render', () => {
  let current = true; scene._battleRenderCurrent = () => current;
  document.addEventListener('sdt-overlay-mode', () => { current = false; scene._battleRenderCurrent = () => true; }, { once: true });
  expect(show()).toBe(false); expect(scene.isConnected).toBe(true);
});

it('synchronous focus restoration cannot overwrite a newer overlay opened by its focus handler', () => {
  show(); vi.runOnlyPendingTimers();
  trigger.addEventListener('focus', () => UI.showOverlay('焦点新页', '<button id="focusPage">继续</button>', 'page'), { once: true });
  expect(restoreCombatScene(UI, 7)).toBe(false);
  expect(UI.el.ovTitle.textContent).toBe('焦点新页'); expect(document.getElementById('focusPage')).not.toBeNull();
  expect(UI._lastMode).toBe('page'); expect(UI._hasBattleStage).toBe(false); expect(scene.isConnected).toBe(false);
});

it('immediate exit releases retained layer and coverage without reviving stale scene', () => {
  show(); UI.hideOverlay({ immediate: true });
  expect(UI.el.overlay.hidden).toBe(true); expect(UI.el.ovBody.children).toHaveLength(0);
  expect(document.body.classList.contains('page-covered')).toBe(false); expect(UI._hasBattleStage).toBe(false);
  expect(restoreCombatScene(UI, 7)).toBe(false);
});

it('incoming expedition toolbar unmounts on show and rebuilds the same-action focus target after hide', () => {
  UI.hideOverlay({ immediate: true });
  SDT.game = { runActive: true, battleActive: false, state: 'idle', layerIdx: 0, trackPos: 0, hp: 10, maxHp: 10, inventory: [], layerData: [{ logical: [], doors: [] }] };
  renderExpeditionPanel(document.getElementById('routePanel'), SDT.game, () => '');
  const opener = document.querySelector('[data-expedition-tool="bag"]'); opener.focus();
  UI.showOverlay('背包', '<button data-cancel="true">返回</button>', 'page');
  expect(opener.isConnected).toBe(false); expect(document.getElementById('sidebar').hidden).toBe(true);
  UI.hideOverlay({ immediate: true });
  const replacement = document.querySelector('[data-expedition-tool="bag"]');
  expect(replacement).not.toBe(opener); expect(document.activeElement).toBe(replacement); expect(document.getElementById('sidebar').hidden).toBe(false);
});

it('only registered diagnostic controls join modal focus order and return outside on hide', () => {
  const panel = document.createElement('aside'); panel.innerHTML = '<button id="trace">诊断</button>'; document.body.append(panel);
  const untrusted = document.getElementById('untrusted');
  unregisterPanel = registerRuntimeTracePanel(panel);
  show(); expect(panel.parentElement).toBe(UI.el.overlay);
  expect(UI._overlayFocusable().map(element => element.id)).toEqual(['back', 'trace']);
  expect(untrusted.hasAttribute('inert')).toBe(true);
  UI.hideOverlay({ immediate: true }); expect(panel.parentElement).toBe(document.body); expect(untrusted.hasAttribute('inert')).toBe(false);
});

it('restore show/focus diagnostics end synchronously around their own inclusive boundaries', () => {
  show(); vi.runOnlyPendingTimers(); const events = [];
  disconnectTrace = connectRuntimeStages({ begin: (stage, context) => { events.push(['begin', stage, context]); return () => events.push(['end', stage]); } });
  const context = { id: 1 };
  expect(restoreCombatScene(UI, 7, { traceContext: context })).toBe(true);
  expect(events).toEqual([['begin', 'battle-restore-show-sync', context], ['end', 'battle-restore-show-sync'], ['begin', 'battle-restore-focus-sync', context], ['end', 'battle-restore-focus-sync']]);
  expect(document.activeElement).toBe(trigger);
});
