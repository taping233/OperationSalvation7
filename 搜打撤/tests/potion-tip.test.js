import { playerFields, canvasTraps, audioGainFields } from './helpers/environment-fixtures.js';
/* 真实启动链的道具阅读与确认契约：悬停/按住只读；点击固定详情，
 * 使用前可取消且保持原道具，明确确认后才进入原有结算/选靶。 */
import { afterAll, describe, it, expect, vi } from 'vitest';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

// This suite isolates potion reading/confirmation from image and character-frame readiness.
// The real readiness gate has its own loading/inert/timeout integration coverage.
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));

// 完整启动会排入壁纸预热等延后工作；测试结束前释放，避免jsdom拆除后再访问Image。
const pendingTimeouts = new Set();
const nativeSetTimeout = globalThis.setTimeout;
const timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay, ...args) => {
  const timer = nativeSetTimeout(callback, delay, ...args);
  pendingTimeouts.add(timer);
  return timer;
});
afterAll(async () => {
  await releaseMainPage();
  for (const timer of pendingTimeouts) clearTimeout(timer);
  timeoutSpy.mockRestore();
});

// ---- 环境补桩（与 boot.test.js 同族：jsdom 无 canvas/Audio/WebAudio） ----
// 故意恒真：jsdom 无 canvas，无论原生 getContext 是否存在都强制换成本桩（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
if (!window.HTMLCanvasElement.prototype.getContext || true) {
  const noopCtx = () => new Proxy(function () {}, {
    ...canvasTraps(noopCtx),
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
  createGain() { return { ...audioGainFields() }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', gain: { value: 0 }, frequency: { value: 0 }, Q: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0, setValueAtTime: () => {} } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: '0.51.0' }) });

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
{
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.head.innerHTML = '';
  document.body.innerHTML = body;
}

await import('../game/src/main.js');
trackMainPagePreparation();
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));

describe('药水文字说明与使用确认', () => {
  it('真实启动后悬停/按住只读，点击查看可取消，确认后仅使用一次', { timeout: 15_000 }, async () => {
    const game = Object.assign(window.SDT.game, {
      ownedCards: [
        { uid: 'tip-heal', card: { id: 'tip-heal', name: '回血药剂', type: '道具', desc: '回复 12 点生命。' } },
        { uid: 'tip-ice', card: { id: 'tip-ice', name: '冰冻药剂', type: '道具', desc: '造成 3 点固定伤害，附加冰冻。' } },
      ],
      ...playerFields(15, 30, 5, 0, '侠客', null),
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
      onBattleEnd() {},
    });
    expect(game).toBe(window.SDT.game);
    const foe = { id: 'infantry', name: '提示测试靶', hp: 40, maxHp: 40, atk: 1 };
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    // 战斗域按需加载（battle-loader）：BattleLoader.start 异步拉模块后开局
    const started = await window.SDT.BattleLoader.start(game, [foe], { isBoss: false, name: '提示测试' });
    expect(started).not.toBe(false);
    expect(game.battleActive).toBe(true);
    await new Promise(r => setTimeout(r, 30));

    const potions = [...document.querySelectorAll('.bt-potion')];
    expect(potions.length).toBe(2);
    for (const el of potions) expect(el.getAttribute('title')).toBeNull();

    const currentTip = () => document.querySelector('[data-potion-use]');
    expect(currentTip()).toBeNull();

    // 悬停：显示名称+效果+用法；移开：收起
    const heal = potions.find(el => el.textContent.includes('回血药剂'));
    heal.dispatchEvent(new MouseEvent('mouseenter'));
    expect(currentTip().textContent).toContain('回血药剂');
    expect(currentTip().textContent).toContain('回复 12 点生命');
    expect(currentTip().querySelector('.bt-potion-use-actions').hidden).toBe(true);
    heal.dispatchEvent(new MouseEvent('mouseleave'));
    expect(currentTip()).toBeNull();

    // 触摸口径：pointerdown 即显，pointerup 收起（jsdom 无 PointerEvent，用 MouseEvent 带 type 派发）
    heal.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(currentTip().textContent).toContain('回复 12 点生命');
    expect(game.hp).toBe(15); expect(game.ownedCards.map(entry => entry.uid)).toEqual(['tip-heal', 'tip-ice']);
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(currentTip()).toBeNull();

    heal.click();
    const first = currentTip(), cancelledUse = first.querySelector('.bt-potion-use-confirm');
    expect(first.getAttribute('role')).toBe('dialog');
    expect(first.querySelector('.bt-potion-use-actions').hidden).toBe(false);
    first.querySelector('.bt-potion-use-cancel').click(); cancelledUse.click();
    expect(currentTip()).toBeNull(); expect(game.hp).toBe(15);
    expect(game.ownedCards.map(entry => entry.uid)).toEqual(['tip-heal', 'tip-ice']);

    // 敌方指向药水：提示条说明拖到敌人身上的用法
    const ice = potions.find(el => el.textContent.includes('冰冻药剂'));
    ice.dispatchEvent(new MouseEvent('mouseenter'));
    expect(currentTip().textContent).toContain('附加冰冻');
    expect(currentTip().textContent).toContain('拖到敌人身上');
    ice.dispatchEvent(new MouseEvent('mouseleave'));

    heal.click(); const confirmedUse = currentTip().querySelector('.bt-potion-use-confirm');
    confirmedUse.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(game.hp).toBe(15);
    confirmedUse.click(); confirmedUse.click();
    expect(game.hp).toBe(27); expect(game.ownedCards.map(entry => entry.uid)).toEqual(['tip-ice']);
    expect(currentTip()).toBeNull();

    if (game.battleActive) window.SDT.Battle.commands.flee();
    Element.prototype.animate = oldAnimate;
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });
});
