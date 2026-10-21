import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installRuntimeTrace } from '../game/src/core/runtime-trace.local.js';
import { getOverlayRuntimeTracePanel } from '../game/src/core/runtime-trace-panel.local.js';

window.SDT = { Icons: { rich: value => value }, Sound: { sfx() {} } };
const { UI } = await import('../game/src/ui/ui.js');
let trace;
const panel = () => document.getElementById('sdtRuntimeTrace');
const control = action => panel().querySelector(`[data-trace="${action}"]`);
const flushMutations = () => Promise.resolve();
function install() {
  window.history.replaceState({}, '', '/?runtimeTrace=1');
  trace = installRuntimeTrace();
  return trace;
}
function open(mode = 'battle') {
  UI.showOverlay('当前游戏页面', '<button id="gameFirst">行动</button><button id="gameLast">查看</button>', mode);
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState({}, '', '/');
  document.body.innerHTML = `
    <main id="viewport">
      <div id="heroAva">旅</div>
      <button id="opener">打开</button><div id="alreadyInert" inert>原本不可交互</div>
      <div id="overlay" tabindex="-1" hidden>
        <div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>
      </div>
      <button id="background">背景操作</button>
    </main><button id="outside">外部背景</button>`;
  UI._acts = {};
  UI._overlayReturnFocus = null;
  UI._overlayInerted = [];
  UI._roomActive = false;
  UI.init();
});
afterEach(() => {
  trace?.destroy(); trace = null;
  UI.hideOverlay({ immediate: true });
  document.body.replaceChildren();
  document.body.className = '';
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('explicit local diagnostic controls within the modal boundary', () => {
  it.each(['/', '/?runtimeTrace=0', '/?runtimeTrace=true'])('does not install on %s or exempt a lookalike ID', url => {
    window.history.replaceState({}, '', url);
    const listener = vi.spyOn(document, 'addEventListener');
    const frame = vi.spyOn(window, 'requestAnimationFrame');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    expect(installRuntimeTrace()).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    expect(frame).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(panel()).toBeNull();
    document.body.insertAdjacentHTML('beforeend', '<aside id="sdtRuntimeTrace"><button id="fake">假的诊断</button></aside>');
    open();
    expect(panel().hasAttribute('inert')).toBe(true);
    expect(getOverlayRuntimeTracePanel(UI.el.overlay)).toBeNull();
    expect(UI._overlayFocusable().map(node => node.id)).toEqual(['gameFirst', 'gameLast']);
  });

  it('moves the exact opted-in panel inside the dialog while keeping every ordinary background inert', () => {
    install();
    const original = panel();
    expect(original.parentElement).toBe(document.body);
    open();
    expect(panel()).toBe(original);
    expect(original.parentElement).toBe(UI.el.overlay);
    expect(UI.el.ovBody.contains(original)).toBe(false);
    expect(original.closest('[role="dialog"][aria-modal="true"]')).toBe(UI.el.overlay);
    expect(original.closest('[inert], [hidden], [aria-hidden="true"]')).toBeNull();
    for (const id of ['opener', 'background', 'outside', 'alreadyInert']) {
      expect(document.getElementById(id).hasAttribute('inert')).toBe(true);
    }
    expect(UI._overlayInerted).not.toContain(original);
    // Renaming or cloning a panel cannot grant another node modal membership.
    original.id = 'renamedDiagnostic';
    const fake = original.cloneNode(true); fake.id = 'sdtRuntimeTrace'; document.body.append(fake);
    UI.hideOverlay({ immediate: true }); open();
    expect(fake.hasAttribute('inert')).toBe(true);
    expect(getOverlayRuntimeTracePanel(UI.el.overlay)).toBe(original);
    expect(UI._overlayFocusable()).not.toContain(fake.querySelector('button'));
  });

  it('supports installation during a modal and survives repeated battle/settings body replacement', () => {
    open(); install();
    const original = panel();
    for (const mode of ['page', 'battle', 'page', 'battle']) {
      open(mode);
      expect(panel()).toBe(original);
      expect(original.parentElement).toBe(UI.el.overlay);
      expect(original.closest('[inert], [hidden]')).toBeNull();
      expect(UI._resolveOverlayInitialFocus()).toBe(document.getElementById('gameFirst'));
      expect(UI._resolveOverlayInitialFocus('[data-trace="clear"]')).toBe(document.getElementById('gameFirst'));
    }
    vi.advanceTimersByTime(20);
    expect(document.activeElement.id).toBe('gameFirst');
  });

  it('restores panel location, original inert state and opener after close, including interrupted close/reopen', () => {
    install(); const original = panel();
    const opener = document.getElementById('opener'); opener.focus();
    open('page'); vi.advanceTimersByTime(20);
    UI.hideOverlay();
    expect(original.parentElement).toBe(UI.el.overlay);
    open('page'); vi.advanceTimersByTime(300);
    expect(UI.el.overlay.hidden).toBe(false);
    expect(original.parentElement).toBe(UI.el.overlay);
    UI.hideOverlay(); vi.advanceTimersByTime(300);
    expect(UI.el.overlay.hidden).toBe(true);
    expect(original.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(opener);
    for (const id of ['opener', 'background', 'outside']) expect(document.getElementById(id).hasAttribute('inert')).toBe(false);
    expect(document.getElementById('alreadyInert').hasAttribute('inert')).toBe(true);
    open(); UI.hideOverlay({ immediate: true });
    expect(original.parentElement).toBe(document.body);
    expect(original.closest('[inert], [hidden]')).toBeNull();
  });

  it('includes only the registered diagnostic controls in the existing keyboard cycle', () => {
    install(); open();
    expect(UI._overlayFocusable().map(node => node.id || node.dataset.trace))
      .toEqual(['gameFirst', 'gameLast', 'sync', 'export', 'stop', 'clear']);
    control('clear').focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('gameFirst');
    const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(control('clear'));
    document.getElementById('gameLast').focus();
    const toDiagnostic = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(toDiagnostic);
    expect(toDiagnostic.defaultPrevented).toBe(false); // Native next stop is the panel, not the background.
    control('sync').disabled = true; control('export').hidden = true;
    expect(UI._overlayFocusable().map(node => node.id || node.dataset.trace)).toEqual(['gameFirst', 'gameLast', 'stop', 'clear']);
  });

  it('keeps clear/stop/download on their normal click handlers without triggering gameplay or collecting diagnostic input', async () => {
    install(); open(); await flushMutations();
    const create = vi.fn(() => 'blob:local-trace'), revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
    const download = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const gameAction = vi.fn(); document.getElementById('gameFirst').addEventListener('click', gameAction);
    control('sync').click();
    expect(trace.read().records.at(-1)).toMatchObject({ kind: 'sync', marker: 1 });
    expect(trace.read().records.some(row => row.kind === 'input')).toBe(false);
    document.getElementById('gameFirst').click();
    control('clear').click(); await flushMutations(); vi.advanceTimersByTime(100);
    expect(trace.read().records).toEqual([]);
    control('stop').click();
    expect(trace.read().active).toBe(false);
    expect(trace.read().records.map(row => row.kind)).toEqual(['stop']);
    expect(panel().querySelector('output').textContent).toBe('已停止；可下载或清空');
    expect(create).not.toHaveBeenCalled();
    control('export').click();
    expect(create).toHaveBeenCalledOnce(); expect(download).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].type).toBe('application/json');
    vi.advanceTimersByTime(1000); expect(revoke).toHaveBeenCalledWith('blob:local-trace');
    expect(gameAction).toHaveBeenCalledOnce(); // Only the explicit gameplay click above.
    expect(UI.el.overlay.hidden).toBe(false);
    expect(document.getElementById('background').hasAttribute('inert')).toBe(true);
  });

  it('does not count diagnostic subtree updates or relocation as gameplay mutations, but keeps mixed app changes', async () => {
    install(); open(); await flushMutations();
    document.getElementById('gameFirst').click();
    control('sync').click(); await flushMutations();
    expect(trace.read().records.filter(row => row.kind === 'dom-update')).toEqual([]);
    panel().querySelector('output').append(document.createTextNode('诊断状态')); await flushMutations();
    expect(trace.read().records.filter(row => row.kind === 'dom-update')).toEqual([]);
    // Exercise the same app lifecycle hook with only panel relocation in the observed subtree.
    UI.el.overlay.hidden = true; UI._restoreOverlayBackground(); await flushMutations();
    UI.el.overlay.hidden = false; UI._isolateOverlayBackground(); await flushMutations();
    expect(trace.read().records.filter(row => row.kind === 'dom-update')).toEqual([]);
    panel().querySelector('output').textContent = '诊断与游戏同批更改';
    UI.el.ovBody.append(document.createElement('span')); await flushMutations();
    expect(trace.read().records.filter(row => row.kind === 'dom-update')).toHaveLength(1);
    const lookalike = document.createElement('aside'); lookalike.id = 'sdtRuntimeTrace';
    UI.el.ovBody.append(lookalike); await flushMutations();
    expect(trace.read().records.filter(row => row.kind === 'dom-update')).toHaveLength(2);
    expect(JSON.stringify(trace.read())).not.toMatch(/诊断|当前游戏页面|gameFirst|runtimeTrace=1/);
  });

  it('does not resurrect removed panels and can destroy/reinstall while a modal remains open', () => {
    install(); open(); const first = panel();
    first.remove(); open('page');
    expect(first.isConnected).toBe(false);
    expect(getOverlayRuntimeTracePanel(UI.el.overlay)).toBeNull();
    const oldTrace = trace; install(); const replacement = panel();
    oldTrace.destroy();
    expect(getOverlayRuntimeTracePanel(UI.el.overlay)).toBe(replacement);
    trace.stop(); open();
    expect(getOverlayRuntimeTracePanel(UI.el.overlay)).toBe(replacement);
    trace.destroy(); trace = null;
    expect(panel()).toBeNull();
    expect(UI._overlayFocusable().map(node => node.id)).toEqual(['gameFirst', 'gameLast']);
    install();
    expect(trace.read().active).toBe(true);
    expect(panel().parentElement).toBe(UI.el.overlay);
    expect(panel().closest('[inert], [hidden]')).toBeNull();
  });

  it('exposes diagnostic buttons and live status inside the accessible modal', async () => {
    install(); open();
    vi.useRealTimers();
    const { default: axe } = await import('axe-core');
    const result = await axe.run(UI.el.overlay, { runOnly: { type: 'rule', values: ['button-name', 'aria-dialog-name', 'aria-valid-attr', 'aria-valid-attr-value', 'aria-allowed-role'] } });
    expect(result.violations).toEqual([]); expect(result.incomplete).toEqual([]);
    expect(panel().querySelector('output').getAttribute('aria-live')).toBe('polite');
    for (const button of panel().querySelectorAll('button')) expect(button.textContent.trim()).not.toBe('');
  });
});
