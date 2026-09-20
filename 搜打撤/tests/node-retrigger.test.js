/* 回归测试（2026-09-19 老板 bug）：节点离开进入新节点后，返回旧节点不得再次触发内容。
 * 地图边是双向的（map-generator addEdge 双向登记），走回头路是合法移动——
 * 此前 resolveCell 无 visited 拦截，返回旧格会重刷宝箱/火堆/事件等。
 * 口径：
 *   1) 站在格上 reenterCell() 仍可反复重开（2026-09-19 留言 #24）；
 *   2) 离开过的可消耗格（visited，由 moveTo 离开时补写）再踏入不触发，状态回 idle。
 * 场景用固定种子 20260919 第 1 层的直线图：0入口 1战斗 2商店 3宝箱 4火堆 5战斗 6门；
 * enterLayer 落位不触发内容，正好构造「站在宝箱格」的起点。 */
import { describe, it, expect, beforeAll } from 'vitest';

if (true) {
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
  play() { return Promise.resolve(); } pause() {} addEventListener() {} load() {}
};
window.AudioContext = window.AudioContext || class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} } }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0, setValueAtTime: () => {} }, Q: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, type: '', frequency: { value: 0, setValueAtTime: () => {} } }; }
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
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));

const { game, newRun, enterLayer } = await import('../game/src/game.session.js');
const { moveTo, reenterCell } = await import('../game/src/game.run.js');
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
      'blankSafeDone', 'evtNext', 'resPick0', 'resSkip', 'fireDone', 'stayHere', 'goDoor']) {
      if (clickAct(act)) break;
    }
  }
}
// 通用收益计数：币 + 背包卡总张数 + 物资栏总数（宝箱开出的卡/币都会入账）
const lootCount = () => game.coins
  + game.ownedCards.reduce((a, o) => a + (o.count || 1), 0)
  + (game.inventory || []).reduce((a, b) => a + (b.count || 1), 0);
const typeOfLocal = (li, idx) => {
  const c = game.layerData[li].logical[idx];
  return c && c.def ? c.def.type : 'blank';
};

describe('节点离开后返回不得重复触发（2026-09-19 bug 回归）', () => {
  beforeAll(async () => {
    newRun(20260919, 'standard', []);
    await tick(50);
    game.myClass = '战士';
    game.characterId = 'heixiang';
    game.state = 'idle';
  });

  it('站在格上可重开；离开后返回不触发', async () => {
    // 层内类型布局按局随机（newRun 不接种子，Random.reseed() 每局重摇），
    // 动态选目标格：优先宝箱/物资格（收益可计数），兜底商店（页面可观测），
    // 且其邻格存在可正常结算的格子（避开战斗/门/祭坛/首脑/撤离点）。
    // enterLayer 只置位不触发内容，用来构造「站在目标格」的起点。
    const li = 0;
    const sweepable = t => !['battle', 'door', 'extraction', 'altar', 'boss', 'emergencyExit'].includes(t);
    const neighborsOf = idx => (game.layerData[li].logical[idx].next || []).filter(([l]) => l === li).map(([, i]) => i);
    const LOOT_TYPES = ['chest', 'coin', 'wood', 'rations', 'key'];
    let cellIdx = -1, leaveIdx = -1, kind = '';
    for (const want of [LOOT_TYPES, ['shop']]) {
      for (let i = 0; i < game.layerData[li].logical.length; i++) {
        if (!want.includes(typeOfLocal(li, i))) continue;
        const nb = neighborsOf(i).find(n => sweepable(typeOfLocal(li, n)));
        if (nb != null) { cellIdx = i; leaveIdx = nb; kind = typeOfLocal(li, i); break; }
      }
      if (cellIdx >= 0) break;
    }
    expect(cellIdx, '本层应存在邻格可正常结算的宝箱/物资/商店格').toBeGreaterThanOrEqual(0);
    enterLayer(li, cellIdx);
    await tick(30);
    expect(game.state).toBe('idle');
    expect(game.trackPos).toBe(cellIdx);
    const vKey = li + ',' + cellIdx;
    expect(game.visited[vKey]).toBeFalsy();   // 踩格不写 visited（留言 #24）

    // 站在格上重开（留言 #24 口径保持）：内容再次触发
    const loot1 = lootCount();
    expect(reenterCell()).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    if (kind !== 'shop') expect(lootCount(), `${kind} 格重开应再入账`).toBeGreaterThan(loot1);
    expect(game.visited[vKey]).toBeFalsy();   // 重开不写 visited

    // 走去邻格：离开本格（moveTo 此刻补写 visited）
    expect(moveTo(li, leaveIdx)).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    expect(game.visited[vKey]).toBe(1);

    // 走回本格：移动合法（双向边），但内容不得再触发
    const loot2 = lootCount();
    expect(moveTo(li, cellIdx)).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    expect(game.trackPos).toBe(cellIdx);
    if (kind !== 'shop') expect(lootCount(), `${kind} 格返回后不得再入账`).toBe(loot2);
    expect(document.body.textContent).toContain('该节点已被消耗');
  });
});
