/* 启动链冒烟测试：真实导入 src/main.js 并触发 DOMContentLoaded。
 * 回归目标：ESM 循环导入下模块体在顶层读 game 导致启动崩溃
 *（症状：标题页漏出局内下方控制栏 / 开始游戏·设置按钮无响应）。
 * jsdom 无 canvas/Audio/WebAudio，这里 stub 掉渲染与音频，只验启动接线。 */
import { describe, it, expect, beforeAll } from 'vitest';

// ---- 环境补桩（必须在动态 import main.js 之前就位） ----
// 2D 上下文：所有方法返回可链式/可读的哑值
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
// Audio 元素（sound.js 顶层 new Audio）
window.Audio = class FakeAudio {
  constructor() { this.loop = false; this.volume = 1; this.preload = ''; }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  load() {}
};
// WebAudio（sound.js 惰性创建，兜底防未定义）
window.AudioContext = window.AudioContext || class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { connect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {} } }; }
  createDynamicsCompressor() { return { connect: () => {}, threshold: {}, ratio: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
  createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0, setValueAtTime: () => {} } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
// fetch（boot 顶层拉 version.json，失败会走 .catch 分支，不影响启动）
window.fetch = window.fetch || (() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) }));

// 注入真实页面结构：读取 index.html，剥掉 script/link（模块由动态 import 接管）
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
{
  const html = readFileSync(resolve(process.cwd(), 'prototypes/map-system/index.html'), 'utf8');
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  document.head.innerHTML = '';
  document.body.innerHTML = body;
}

// 模块加载（DOMContentLoaded 已在 jsdom 环境建立时派发过，
// boot.js 的监听随后注册，故下方手动再派发一次触发启动链）
await import('../prototypes/map-system/src/main.js');
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
// fetch .then 与 UI 初始化里的微任务需要清一轮
await new Promise(r => setTimeout(r, 0));

describe('启动链（DOMContentLoaded → showTitle）', () => {
  it('启动完成后 body 挂上 lobby 类（局内控件在标题页隐藏）', () => {
    expect(document.body.classList.contains('lobby'), 'body 缺少 lobby 类').toBe(true);
  });
  it('标题封面处于显示状态', () => {
    const title = document.getElementById('title');
    expect(title).not.toBeNull();
    expect(title.hidden).toBe(false);
  });
  it('开始游戏 / 设置 / 退出按钮已绑定监听（可点击响应）', () => {
    // getEventListeners 不可用，用行为代理：点击 mSettings 应弹出设置 overlay（不再 hidden）
    document.getElementById('mSettings').click();
    const overlay = document.getElementById('overlay');
    expect(overlay.hidden, '点击设置后 overlay 应打开').toBe(false);
    document.getElementById('settingsBack')?.click();
  });
  it('跨文件 mixin 已延迟绑定（TDZ 回归点）', () => {
    const g = window.SDT.game;
    expect(typeof g.grantCard).toBe('function');      // bindRunMixins
    expect(typeof g.onBattleEnd).toBe('function');    // bindBagMixins
    expect(g.TYPE_NAME && typeof g.TYPE_NAME.coin).toBe('string'); // bindNotesMixins
    expect(typeof g.debug.openShop).toBe('function'); // boot 调试入口
  });
  it('SDT 命名空间核心模块均已发布', () => {
    for (const k of ['MAP', 'Art', 'Icons', 'Sound', 'Camera', 'Notes', 'Cards', 'Combat', 'Base', 'Meta', 'Renderer', 'UI', 'Battle', 'Chests']) {
      expect(window.SDT[k], `window.SDT.${k} 未发布`).toBeTruthy();
    }
  });
});
