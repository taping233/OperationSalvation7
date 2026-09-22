/* 回归测试（2026-09-20 老板定版）：节点完成结算后立即变普通；未触发退出仍可重进；商店离开才消耗。
 * 地图边是双向的（map-generator addEdge 双向登记），走回头路是合法移动——
 * 此前 resolveCell 无 visited 拦截，返回旧格会重刷宝箱/火堆/事件等。
 * 口径：
 *   1) 收益节点完成领取即写 visited，站在格上也不能重刷；
 *   2) 商店关闭后仍可重开，离开商店格时才写 visited。
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
      'blankSafeDone', 'evtNext', 'evtChoice', 'resPick0', 'resSkip', 'fireDone', 'stayHere', 'goDoor']) {
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

describe('节点完成/离开后的消耗时机（2026-09-20 定版）', () => {
  beforeAll(async () => {
    newRun(20260919, 'standard', []);
    await tick(50);
    game.myClass = '战士';
    game.characterId = 'heixiang';
    game.state = 'idle';
  });

  it('收益完成即锁；商店离开才锁；返回均不重复触发', async () => {
    // 层内类型布局按局随机（newRun 不接种子，Random.reseed() 每局重摇），
    // 动态选目标格：优先宝箱/物资格（收益可计数），兜底商店（页面可观测），
    // 且其邻格存在可正常结算的格子（避开战斗/门/祭坛/首脑/撤离点）。
    // enterLayer 只置位不触发内容，用来构造「站在目标格」的起点。
    const li = 0;
    const sweepable = t => !['battle', 'door', 'extraction', 'altar', 'boss', 'emergencyExit'].includes(t);
    const neighborsOf = idx => (game.layerData[li].logical[idx].next || []).filter(([l]) => l === li).map(([, i]) => i);
    const LOOT_TYPES = ['chest', 'coin', 'wood', 'rations', 'key', 'resource'];
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

    // 第一次进入并完成结算。
    const loot1 = lootCount();
    expect(reenterCell()).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    if (kind !== 'shop') {
      expect(lootCount(), `${kind} 格领取应入账`).toBeGreaterThan(loot1);
      expect(game.visited[vKey]).toBe(1);     // 收益完成立即消耗
      const settledLoot = lootCount();
      expect(reenterCell()).toBe(true);
      await sweep();
      expect(lootCount(), `${kind} 格完成后站在原地也不得重刷`).toBe(settledLoot);
      expect(document.body.textContent).toContain('已完成结算');
    } else {
      expect(game.visited[vKey]).toBeFalsy(); // 关闭商店尚未离开，仍可重逛
      expect(reenterCell()).toBe(true);
      await sweep();
      expect(game.visited[vKey]).toBeFalsy();
    }

    // 走去邻格：商店在此刻补写 visited；收益节点保持已完成。
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
    expect(document.body.textContent).toContain('已完成结算');
  });

  it('物资格有独立场景层；暂不领取可重进，领取后立即变普通', async () => {
    newRun(20260920, 'standard', []);
    await tick(30);
    game.myClass = '战士'; game.characterId = 'heixiang'; game.state = 'idle';
    const li = 0;
    const idx = game.layerData[li].logical.findIndex(cell => (cell.next || []).some(([nextLi]) => nextLi === li));
    expect(idx).toBeGreaterThanOrEqual(0);
    game.layerData[li].logical[idx].def = { type: 'resource' };
    enterLayer(li, idx);
    const key = `${li},${idx}`;

    expect(reenterCell()).toBe(true);
    await tick(30);
    expect(document.querySelector('.node-pg[data-asset-key="scene-event-airdrop"]')).toBeTruthy();
    expect(clickAct('resSkip')).toBe(true);
    await tick(30);
    expect(game.visited[key]).toBeFalsy();

    expect(reenterCell()).toBe(true);
    await tick(30);
    expect(clickAct('resPick0')).toBe(true);
    await sweep();
    expect(game.visited[key]).toBe(1);
  });

  it('商店关闭不消耗，离开所在格才变普通', async () => {
    newRun(20260921, 'standard', []);
    await tick(30);
    game.myClass = '战士'; game.characterId = 'heixiang'; game.state = 'idle';
    const li = 0;
    const idx = game.layerData[li].logical.findIndex(cell => (cell.next || []).some(([nextLi]) => nextLi === li));
    const nextIdx = game.layerData[li].logical[idx].next.find(([nextLi]) => nextLi === li)[1];
    game.layerData[li].logical[idx].def = { type: 'shop' };
    game.layerData[li].logical[nextIdx].def = undefined;
    enterLayer(li, idx);
    const key = `${li},${idx}`;

    expect(reenterCell()).toBe(true);
    await sweep();
    expect(game.visited[key]).toBeFalsy();
    expect(moveTo(li, nextIdx)).toBe(true);
    await sweep();
    expect(game.visited[key]).toBe(1);
  });
});
