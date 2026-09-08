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
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: '0.51.0' }) });

// 注入真实页面结构：读取 index.html，剥掉 script/link（模块由动态 import 接管）
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
{
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.head.innerHTML = '';
  document.body.innerHTML = body;
}

// 模块加载（DOMContentLoaded 已在 jsdom 环境建立时派发过，
// boot.js 的监听随后注册，故下方手动再派发一次触发启动链）
await import('../game/src/main.js');
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
    for (const k of ['RULES', 'MAP', 'Art', 'Icons', 'Sound', 'Camera', 'Notes', 'Cards', 'Base', 'Meta', 'RenderScheduler', 'Renderer', 'UI', 'Battle', 'Chests']) {
      expect(window.SDT[k], `window.SDT.${k} 未发布`).toBeTruthy();
    }
    expect(typeof window.SDT.Battle.getSnapshot).toBe('function');
    expect(Object.isFrozen(window.SDT.Battle)).toBe(true);
    for (const command of ['playCard', 'selectInfusion', 'confirmInfusion', 'cancelInfusion', 'endTurn', 'flee', 'openGrave', 'closeGrave', 'selectDeckCard', 'confirmDeck', 'cancelDeck', 'cancelPendingTarget']) {
      expect(typeof window.SDT.Battle.commands[command], `Battle.commands.${command} 未发布`).toBe('function');
    }
  });
  it('第一次投掷前显示完整的静止骰子', () => {
    const face = document.getElementById('diceFace');
    expect(face.classList.contains('idle-dice')).toBe(true);
    expect(face.querySelectorAll('.dice-f')).toHaveLength(6);
    expect(face.querySelector('.dice-cube').style.transform).toBe('rotateX(90deg) rotateY(0deg) rotateZ(0deg)');
  });
  it('骰子六种结果都以目标点数朝上的姿态落定', () => {
    const expected = {
      1: [90, 0, 0], 2: [0, 0, 0], 3: [0, 0, 270],
      4: [0, 0, 90], 5: [180, 0, 0], 6: [270, 0, 0],
    };
    for (let value = 1; value <= 6; value++) {
      window.SDT.UI.drawDice(value);
      const transform = document.querySelector('#diceFace .dice-cube').style.transform;
      const angles = [...transform.matchAll(/rotate[XYZ]\((-?\d+)deg\)/g)]
        .map(match => ((+match[1] % 360) + 360) % 360);
      expect(angles, `${value} 点没有朝上落定`).toEqual(expected[value]);
    }
  });

  it('运行时按 mapSeed 重建局部几何，并以稳定节点提交移动事务', async () => {
    const session = await import('../game/src/game.session.js');
    const run = await import('../game/src/game.run.js');
    const game = session.game;
    session.buildDerived('integration-map-seed');
    expect(game.mapSeed).toBe('integration-map-seed');
    expect(game.generatorVersion).toBeTruthy();
    expect(game.layoutVersion).toBeTruthy();
    expect(game.geometryVersion).toContain('integration-map-seed');
    expect(game.layerBounds).toHaveLength(5);
    for (const [li, layer] of game.layerData.entries()) {
      const positions = game.nodePos[li];
      for (const [nodeIdx, node] of layer.logical.entries()) {
        for (const [toLi, toIdx] of node.next) {
          if (toLi !== li) continue;
          const a = positions[nodeIdx], b = game.nodePos[toLi][toIdx];
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBe(120);
        }
      }
    }

    const li = 0;
    const start = game.layerData[li].entrances[0];
    const edge = game.layerData[li].logical[start].next.find(([toLi]) => toLi === li);
    expect(edge).toBeTruthy();
    game.layerIdx = li; game.trackPos = start; game.pos = session.cellCenter(li, start);
    game.state = 'idle'; game.moveTarget = null;
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(run.moveTo(edge[0], edge[1])).toBe(true);
    expect(game.state).not.toBe('moving');
    expect([game.layerIdx, game.trackPos]).toEqual(edge);
    expect(game.pos).toEqual(session.cellCenter(edge[0], edge[1]));
    localStorage.removeItem('sdt-reduce-motion');
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('非 reduced-motion 的 fake rAF 移动最终只提交一次', async () => {
    const session = await import('../game/src/game.session.js');
    const run = await import('../game/src/game.run.js');
    const game = session.game;
    session.buildDerived('async-move-seed');
    const li = 0;
    const start = game.layerData[li].entrances[0];
    const edge = game.layerData[li].logical[start].next.find(([toLi]) => toLi === li);
    expect(edge).toBeTruthy();
    game.layerIdx = li; game.trackPos = start; game.pos = session.cellCenter(li, start);
    game.state = 'idle'; game.moveTarget = null; game.turn = 1;
    localStorage.removeItem('sdt-reduce-motion');

    const originalRaf = globalThis.requestAnimationFrame;
    const callbacks = [];
    globalThis.requestAnimationFrame = (callback) => { callbacks.push(callback); return callbacks.length; };
    try {
      expect(run.moveTo(edge[0], edge[1])).toBe(true);
      expect(game.state).toBe('moving');
      const tick = callbacks.shift();
      expect(typeof tick).toBe('function');
      const now = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) + 400;
      tick(now);
      expect(game.state).not.toBe('moving');
      expect([game.layerIdx, game.trackPos]).toEqual(edge);
      expect(game.turn).toBe(2);
      // 重复调用同一个已完成帧回调不得再次结算。
      tick(now + 400);
      expect(game.turn).toBe(2);
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
      localStorage.removeItem('sdt-reduce-motion');
      document.getElementById('overlay')?.setAttribute('hidden', '');
      game.state = 'title';
    }
  });

  it('第一层 door 确认后进入第二层，终层仍保留 extraction', async () => {
    const session = await import('../game/src/game.session.js');
    const run = await import('../game/src/game.run.js');
    const game = session.game;
    session.buildDerived('door-transition-seed');
    const door = game.layerData[0].doors[0];
    const from = game.layerData[0].logical.findIndex(cell =>
      cell.next.some(([toLi, toIdx]) => toLi === 0 && toIdx === door.at));
    expect(from).toBeGreaterThanOrEqual(0);
    game.layerIdx = 0; game.trackPos = from; game.pos = session.cellCenter(0, from);
    game.state = 'idle'; game.moveTarget = null;
    localStorage.setItem('sdt-reduce-motion', '1');
    expect(run.moveTo(0, door.at)).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 950));
    const goDoor = document.querySelector('#ovBody [data-act="goDoor"]');
    expect(goDoor).not.toBeNull();
    goDoor.click();
    expect(game.layerIdx).toBe(door.toLayer);
    expect(game.trackPos).toBe(door.arriveAt);
    expect(game.state).toBe('idle');
    expect(game.layerData[4].logical[game.layerData[4].exit].def.type).toBe('extraction');
    localStorage.removeItem('sdt-reduce-motion');
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('enterLayer 会按当前层全貌适配镜头，而不是只聚焦入口', async () => {
    const session = await import('../game/src/game.session.js');
    const game = session.game;
    const camera = session.cam;
    session.buildDerived('fit-layer-seed');
    camera.resize(800, 600);
    const li = 3;
    const at = game.layerData[li].entrances[0];
    session.enterLayer(li, at);
    expect(game.activeLayerBounds).toEqual(game.layerBounds[li]);
    expect(camera.fitLayer).toBeTypeOf('function');
    const pad = 128;
    for (const p of game.nodePos[li]) {
      const screen = camera.worldToScreen(p.x, p.y);
      expect(screen.x).toBeGreaterThanOrEqual(-pad);
      expect(screen.x).toBeLessThanOrEqual(camera.viewW + pad);
      expect(screen.y).toBeGreaterThanOrEqual(-pad);
      expect(screen.y).toBeLessThanOrEqual(camera.viewH + pad);
    }
    game.state = 'title';
  });
});
