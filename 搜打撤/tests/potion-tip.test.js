/* 药水自绘文字提示栏（2026-09-20 老板：悬停/触摸药水要有文字栏提示，不用系统 title）回归：
 *   ① 药水元素不再挂系统 title 属性（悬停延迟且触屏无效）；
 *   ② 药水栏自带 [data-potion-tip] 提示条，初始隐藏，贴药水栏正下方；
 *   ③ 悬停/按下药水 → 提示条显示【名 ×数】效果+用法；移开/松手 → 收起。 */
import { describe, it, expect } from 'vitest';

// ---- 环境补桩（与 boot.test.js 同族：jsdom 无 canvas/Audio/WebAudio） ----
// 故意恒真：jsdom 无 canvas，无论原生 getContext 是否存在都强制换成本桩（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
if (!window.HTMLCanvasElement.prototype.getContext || true) {
  const noopCtx = () => new Proxy(function () {}, {
    get: (_t, k) => {
      if (k === 'canvas') return null;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createPattern' || k === 'getImageData') return () => ({ addColorStop: () => {}, data: [] });
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
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
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
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));

describe('药水自绘文字提示栏', () => {
  it('药水无系统 title；悬停/按下显示提示条，移开/松手收起；敌方指向药水带拖拽用法', { timeout: 15_000 }, async () => {
    const game = {
      ownedCards: [
        { uid: 'tip-heal', card: { id: 'tip-heal', name: '回血药剂', type: '道具', desc: '回复 12 点生命。' } },
        { uid: 'tip-ice', card: { id: 'tip-ice', name: '冰冻药剂', type: '道具', desc: '造成 3 点固定伤害，附加冰冻。' } },
      ],
      hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 0,
      myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
      onBattleEnd() {},
    };
    const foe = { id: 'infantry', name: '提示测试靶', hp: 40, maxHp: 40, atk: 1 };
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    // 战斗域按需加载（battle-loader）：BattleLoader.start 异步拉模块后开局
    await window.SDT.BattleLoader.start(game, [foe], { isBoss: false, name: '提示测试' });
    await new Promise(r => setTimeout(r, 30));

    const potions = [...document.querySelectorAll('.bt-potion')];
    expect(potions.length).toBe(2);
    for (const el of potions) expect(el.getAttribute('title')).toBeNull();

    const tip = document.querySelector('[data-potion-tip]');
    expect(tip).not.toBeNull();
    expect(tip.hidden).toBe(true);

    // 悬停：显示名称+效果+用法；移开：收起
    const heal = potions.find(el => el.textContent.includes('回血药剂'));
    heal.dispatchEvent(new MouseEvent('mouseenter'));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('回血药剂');
    expect(tip.textContent).toContain('回复 12 点生命');
    expect(tip.textContent).toContain('点击直接使用');
    heal.dispatchEvent(new MouseEvent('mouseleave'));
    expect(tip.hidden).toBe(true);

    // 触摸口径：pointerdown 即显，pointerup 收起（jsdom 无 PointerEvent，用 MouseEvent 带 type 派发）
    heal.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    expect(tip.hidden).toBe(false);
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    expect(tip.hidden).toBe(true);

    // 敌方指向药水：提示条说明拖到敌人身上的用法
    const ice = potions.find(el => el.textContent.includes('冰冻药剂'));
    ice.dispatchEvent(new MouseEvent('mouseenter'));
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain('附加冰冻');
    expect(tip.textContent).toContain('拖到敌人身上');

    if (game.battleActive) window.SDT.Battle.commands.flee();
    Element.prototype.animate = oldAnimate;
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });
});
