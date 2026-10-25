import { canvasTraps, audioGainFields } from './helpers/environment-fixtures.js';
/* SYS-01 探索奖励（2026-10-03）：moveTo 首踏入格打标 explored 的真实链路行为。
 *   ① 已探索格间安全往返（回头路合法）：explored 不涨——撤离经验的计酬基数不变；
 *   ② 首次踏入新格：explored 入账——正激励保留；
 *   ③ 步数统计（game.turn）照常累加，保留作展示口径。
 * 台架同 node-retrigger.test.js：全量 boot + reduce-motion 让 moveTo 同步完成。 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

installImmediateWebLocks();

// 故意恒真：仅给下方 canvas/存储补桩一个块级作用域（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
if (true) {
  const noopCtx = () => new Proxy(function () {}, {
    ...canvasTraps(noopCtx),
  });
  window.HTMLCanvasElement.prototype.getContext = function () { return noopCtx(); };
}
window.Audio = class FakeAudio {
  constructor() { this.loop = false; this.volume = 1; this.preload = ''; }
  play() { return Promise.resolve(); } pause() {} addEventListener() {} load() {}
};
window.AudioContext = window.AudioContext || class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { ...audioGainFields() }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} }, Q: {} }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, type: '', frequency: { value: 0 } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: 'test' }) });
localStorage.setItem('sdt-reduce-motion', '1');   // moveTo 同步完成，免 rAF

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

const { game, newRun, enterLayer } = await import('../game/src/run/game.session.js');
const { moveTo } = await import('../game/src/run/game.run.js');
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

const clickAct = (act) => {
  const el = document.querySelector(`[data-act="${act}"]`);
  if (el) { el.click(); return true; }
  return false;
};
async function sweep(max = 120) {
  for (let i = 0; i < max; i++) {
    await tick(30);
    if (game.state === 'idle') return;
    for (const act of ['flowContinue', 'chestTake', 'chestPick', 'chestSkip', 'pickupGo', 'closeShop',
      'blankSafeDone', 'evtNext', 'evtChoice', 'resPick0', 'resSkip', 'fireDone', 'stayHere', 'goDoor']) {
      if (clickAct(act)) break;
    }
  }
}
const sameLayerNext = (li, idx) => (game.layerData[li].logical[idx].next || [])
  .filter(([l]) => l === li).map(([, i]) => i);
// 找同层四连直线链 i→a→b→c（i≠b、a≠c 保证持续前进）；门格排除（门弹窗不受 def 清空影响）
function findChain() {
  for (let li = 0; li < game.layerData.length; li++) {
    const logical = game.layerData[li].logical;
    const doors = new Set((game.layerData[li].doors || []).map(d => d.at));
    for (let i = 0; i < logical.length; i++) {
      if (doors.has(i)) continue;
      for (const a of sameLayerNext(li, i)) {
        if (doors.has(a)) continue;
        for (const b of sameLayerNext(li, a)) {
          if (b === i || doors.has(b)) continue;
          for (const c of sameLayerNext(li, b)) {
            if (c === a || c === i || doors.has(c)) continue;
            return { li, chain: [i, a, b, c] };
          }
        }
      }
    }
  }
  return null;
}

describe('moveTo 首探打标（SYS-01 撤离经验锚定首次有效探索）', () => {
  const ctx = {};
  beforeAll(async () => {
    // skipClassChoice：本用例只测移动打标，选角页是干扰项（node-retrigger 同款，防 500ms 迟到定时器假红）
    let found = null;
    for (let reroll = 0; reroll < 6 && !found; reroll++) {
      await newRun(20261003 + reroll, 'standard', { skipClassChoice: true });
      await tick(50);
      game.myClass = '战士';
      game.characterId = 'heixiang';
      game.state = 'idle';
      found = findChain();
    }
    expect(found, '应存在同层四连直线链（重摇 6 个种子后仍无则地图生成有问题）').toBeTruthy();
    const { li, chain } = found;
    ctx.li = li;
    ctx.chain = chain;
    // 链上格子一律清成普通空格，防宝箱/商店/事件页干扰移动计测（node-retrigger 同款手法）
    for (const idx of chain) game.layerData[li].logical[idx].def = undefined;
    enterLayer(li, chain[0]);
    await tick(30);
  });

  // 用例内的预热/加载任务可能排 500ms 级 setTimeout；排水防 teardown 后迟到触发假红（node-retrigger 同款）
  afterAll(async () => { await tick(700); await releaseMainPage(); });

  it('起点不计首探；前进每格首踏入入账；20 次安全往返不涨；新格仍入账', async () => {
    const { li, chain } = ctx;
    const key = idx => li + ',' + idx;
    expect(game.state).toBe('idle');
    // 起点（enterLayer 落位，非移动）不计首探——撤离经验只数「迈出去」的首探格
    expect(game.explored).toEqual({});
    expect(game.turn).toBe(1);

    // 前进两格：每格首次踏入记入 explored
    expect(moveTo(li, chain[1])).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    expect(moveTo(li, chain[2])).toBe(true);
    await sweep();
    expect(Object.keys(game.explored).sort()).toEqual([key(chain[1]), key(chain[2])].sort());
    const turnAfterForward = game.turn;
    expect(turnAfterForward).toBe(3);

    // 验收①机制：已探索格间 20 次安全往返（回头路合法）——explored 不涨，turn 照常走
    //（前进两格后站在 chain[2]，首跳先回 chain[1]，此后两格交替）
    for (let i = 0; i < 20; i++) {
      expect(moveTo(li, i % 2 ? chain[2] : chain[1])).toBe(true);
      await sweep();
      expect(game.state).toBe('idle');
    }
    expect(Object.keys(game.explored).sort(), '重复进出已探索格不得新增首探标记').toEqual([key(chain[1]), key(chain[2])].sort());
    expect(game.turn, '步数统计保留（展示口径）').toBe(turnAfterForward + 20);

    // 验收②机制：首次踏入新格仍入账
    expect(moveTo(li, chain[3])).toBe(true);
    await sweep();
    expect(game.explored[key(chain[3])]).toBe(1);
    expect(Object.keys(game.explored).length).toBe(3);
    expect(game.turn).toBe(turnAfterForward + 21);
  });
});
