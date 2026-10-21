/* INFRA-02 回归：开发者控制台「快捷键」页签点「进入」后，jump 成功开出的目标页
 * 必须存活（_acts 不被 hideOverlay 清掉、overlay 不被隐藏），控制台页被目标页顶替。
 * 走真实链路：openDevConsole → devcTab 切快捷键页签 → 真实 DOM click「进入」按钮。 */
import { afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

afterAll(releaseMainPage);

// ---- 环境补桩（与 boot.test.js 同款，必须在动态 import main.js 之前就位） ----
// 故意恒真：jsdom 无 canvas，无论原生 getContext 是否存在都强制换成本桩（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
if (!window.HTMLCanvasElement.prototype.getContext || true) {
  const noopCtx = () => new Proxy(function () {}, {
    get: (_t, k) => {
      if (k === 'canvas') return null;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createPattern' || k === 'getImageData') {
        return () => ({ addColorStop: () => {}, data: [] });
      }
      return () => noopCtx();
    },
    set: () => true,
    apply: () => noopCtx(),
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return noopCtx(); };
}
window.Audio = class FakeAudio {
  constructor() { this.loop = false; this.volume = 1; this.preload = ''; }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  load() {}
};
window.AudioContext = window.AudioContext || class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} } }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(1) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', gain: { value: 0 }, frequency: { value: 0, setValueAtTime: () => {} }, Q: { value: 1 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 440, setValueAtTime: () => {} } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: '0.0.0' }) });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
{
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.head.innerHTML = '';
  document.body.innerHTML = body;
}

// Control only module delivery, retaining the real page factory and its UI behavior.
// The first case cancels while the actual cold import is outstanding.
let menuImportStarted = false;
let releaseMenuImport;
const menuImportGate = new Promise(resolve => { releaseMenuImport = resolve; });
vi.doMock('../game/src/ui/game.menu.pages.js', async () => {
  menuImportStarted = true;
  await menuImportGate;
  return vi.importActual('../game/src/ui/game.menu.pages.js');
});

await import('../game/src/main.js');
trackMainPagePreparation();
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 50));

const UI = () => window.SDT.UI;
const waitForPresentation = () => vi.waitFor(() => {
  expect(document.querySelector('.page-loading, .page-visual-handoff')).toBeNull();
}, { timeout: 4000 });

// No late jump or overlay transition may leak from one real-flow case to the next.
afterEach(async () => {
  const { cancelPendingPageEntries } = await import('../game/src/ui/page-entry-cancellation.js');
  cancelPendingPageEntries();
  releaseMenuImport();
  await vi.dynamicImportSettled();
  await waitForPresentation();
  if (document.getElementById('devConsole')) {
    expect(UI()._acts.devcClose, '可见控制台必须保留关闭动作').toBeTypeOf('function');
    UI()._acts.devcClose();
  }
  UI().hideOverlay({ immediate: true });
  const { showTitle } = await import('../game/src/run/game.session.js');
  showTitle();
  await Promise.resolve();
  vi.restoreAllMocks();
});

const openKeysTab = async () => {
  await waitForPresentation();
  const { openDevConsole } = await import('../game/src/run/game.run.dev.js');
  openDevConsole();
  // 切到「快捷键」页签（真实按钮点击，bindKeysTab 在 render 内注册 devcGoto）
  const tabBtn = document.querySelector('#ovBody [data-act="devcTab"][data-tab="keys"]');
  expect(tabBtn, '快捷键页签按钮不存在').not.toBeNull();
  tabBtn.click();
  await vi.waitFor(() => expect(UI()._acts.devcGoto).toBeTypeOf('function'));
  await waitForPresentation();
};

const clickJump = page => {
  const button = document.querySelector(`#ovBody [data-act="devcGoto"][data-page="${page}"]`);
  expect(button, `${page}页「进入」按钮不存在`).not.toBeNull();
  const action = vi.spyOn(UI()._acts, 'devcGoto');
  button.click();
  expect(action).toHaveBeenCalledOnce();
  const result = action.mock.results[0].value;
  expect(typeof result?.then, '真实jump必须暴露可等待的异步结果').toBe('function');
  return result;
};

describe('INFRA-02 控制台快捷键页签跳转不再关掉目标页', () => {
  it('冷设置载入中真实Escape取消，迟到模块不能替换控制台或清掉动作表', async () => {
    await openKeysTab();
    const { menuPageLoading } = await import('../game/src/ui/game.menu.js');
    expect(menuPageLoading).toBe(false);
    const pending = clickJump('settings');
    expect(document.querySelector('.page-loading')).not.toBeNull();
    await vi.waitFor(() => expect(menuImportStarted).toBe(true), { timeout: 4000 });
    expect(document.querySelector('.settings-page')).toBeNull();
    const escape = new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true });
    window.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(await pending).toBe(false);
    releaseMenuImport();
    await vi.dynamicImportSettled();
    await waitForPresentation();
    expect(document.querySelector('.settings-page')).toBeNull();
    expect(document.querySelector('.devc-tabs')).not.toBeNull();
    expect(UI().el.overlay.hidden).toBe(false);
    expect(UI()._acts.devcGoto).toBeTypeOf('function');
    expect(UI()._acts.devcClose).toBeTypeOf('function');
  });
  it('点合法页面「进入」后：目标页动作表存活、overlay 未被隐藏、控制台已被顶替', async () => {
    await openKeysTab();
    const goto = document.querySelector('#ovBody [data-act="devcGoto"][data-page="settings"]');
    expect(goto, '设置页「进入」按钮不存在').not.toBeNull();
    expect(goto.disabled, '设置页在标题态应可进入').toBe(false);

    await clickJump('settings');   // 真实点击并等待 ovBody 委托 → devcGoto → jump → 冷/热菜单完成
    await waitForPresentation();

    expect(UI().el.overlay.hidden, 'jump 成功后 overlay 被隐藏了（INFRA-02 症状）').toBe(false);
    const settingsPage = document.querySelector('#ovBody .settings-page');
    expect(settingsPage, '设置页未在控制台层内打开').not.toBeNull();
    // 目标页动作表存活：设置页自己的关闭钮已注册（旧 bug 会把 _acts 清空）
    const closeBtn = document.querySelector('#ovBody [data-act="closeSettings"]');
    expect(closeBtn, '设置页关闭钮不存在').not.toBeNull();
    expect(typeof UI()._acts[closeBtn.dataset.act]).toBe('function');
    // 原控制台已关闭（页签骨架被设置页顶替）
    expect(document.querySelector('.devc-tabs')).toBeNull();
    expect(document.querySelector('#ovBody [data-act="devcGoto"]')).toBeNull();
  });

  it('点不可用/未知页面时控制台不跳转、重绘留在本页', async () => {
    await openKeysTab();
    expect(UI()._acts.devcGoto, 'devcGoto 未注册').toBeTruthy();
    expect(await UI()._acts.devcGoto({ page: '__no_such_page__' })).toBe(false);
    expect(document.querySelector('.devc-tabs'), 'jump 失败应重绘留在控制台').not.toBeNull();
    expect(UI().el.overlay.hidden).toBe(false);
  });

  it('真实 Ctrl+L 在四个页签均恢复来源，按住重复消息不反复开关', async () => {
    if (document.getElementById('devConsole')) UI()._acts.devcClose();
    const game = window.SDT.game;
    game.state = 'modal';
    UI().showOverlay('来源节点', '<section id="consoleOrigin"><button data-act="originContinue">继续节点</button></section>', 'page');
    const source = document.getElementById('consoleOrigin');
    let continued = 0;
    UI().act('originContinue', () => { continued += 1; });
    const toggle = repeat => window.dispatchEvent(new KeyboardEvent('keydown', { key:'l', ctrlKey:true, repeat, bubbles:true, cancelable:true }));
    for (const [index, tab] of ['debug', 'agent', 'data', 'keys'].entries()) {
      // 整页 staged 揭幕的遮层会短暂阻断普通按键（Ctrl+L 在内）；等遮层退场再按（同 boot.test.js）。
      await vi.waitFor(() => expect(document.querySelector('.page-visual-handoff')).toBeNull(), { timeout: 4000 });
      toggle(false);
      // 首次键盘入口按需装载；后续 warm toggle 保留即时 DOM 与原业务断言。
      if (index === 0) await vi.waitFor(() => expect(document.getElementById('devConsole')).not.toBeNull());
      expect(document.getElementById('devConsole')).not.toBeNull();
      document.querySelector(`[data-act="devcTab"][data-tab="${tab}"]`).click();
      toggle(true);
      expect(document.getElementById('devConsole')).not.toBeNull();
      toggle(false);
      expect(document.getElementById('devConsole')).toBeNull();
      expect(document.getElementById('consoleOrigin')).toBe(source);
      expect(game.state).toBe('modal');
    }
    source.querySelector('button').click();
    expect(continued).toBe(1);
  });
});
