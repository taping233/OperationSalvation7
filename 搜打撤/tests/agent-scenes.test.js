/* 验收剧本库定向测试：真实启动链（main.js）跑通 dev 直跳场景。
 * 回归目标：SDT.Agent.scenes 装配与 battle/shop 场景的断言链在 jsdom 全量
 * 启动环境下自然收口（pass），防止场景与命令面/动作面漂移脱节。
 * 环境补桩与 tests/boot.test.js 同款：无 canvas/Audio 渲染，逻辑同源。 */
import { describe, it, expect } from 'vitest';

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

await import('../game/src/main.js');
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));

const { runScene, listScenes } = await import('../game/src/agent/agent.scenes.js');
const { game } = await import('../game/src/run/game.session.js');

const waitFor = async (cond, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (cond()) return true;
    await new Promise(r => setTimeout(r, 25));
  }
  return cond();
};

describe('SDT.Agent.scenes 验收剧本库', () => {
  it('启动完成后清单可用且含全部注册场景', async () => {
    expect(await waitFor(() => game.state === 'title')).toBe(true);
    const list = listScenes().map(s => s.id);
    for (const id of ['smoke', 'battle', 'boss', 'shop', 'event', 'fire', 'altar', 'chest', 'extract', 'fullrun']) {
      expect(list, `缺场景 ${id}`).toContain(id);
    }
  });

  it('未知场景返回 UNKNOWN_SCENE 且不busy', async () => {
    const report = await runScene('不存在的场景');
    expect(report.ok).toBe(false);
    expect(report.code).toBe('UNKNOWN_SCENE');
  });

  it('battle 场景：测试局直跳遭遇战并自然打完（turbo）', { timeout: 90000 }, async () => {
    expect(await waitFor(() => game.state === 'title')).toBe(true);
    const report = await runScene('battle', { turbo: true });
    expect(report.ok, JSON.stringify(report).slice(0, 600)).toBe(true);
    expect(report.pass, report.assertions.filter(a => !a.pass).map(a => `${a.name}: ${a.detail}`).join(' | ')).toBe(true);
    expect(report.stopReason).toBe('until');
    expect(report.final.fought, '战斗计数应增长').toBeGreaterThan(0);
  });

  it('shop 场景：商店页打开且被策略收口（turbo）', { timeout: 90000 }, async () => {
    const report = await runScene('shop', { turbo: true });
    expect(report.ok, JSON.stringify(report).slice(0, 600)).toBe(true);
    expect(report.pass, report.assertions.filter(a => !a.pass).map(a => `${a.name}: ${a.detail}`).join(' | ')).toBe(true);
  });
});
