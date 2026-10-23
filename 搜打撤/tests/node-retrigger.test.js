/* 回归测试（2026-09-20 老板定版）：节点完成结算后立即变普通；未触发退出仍可重进；商店离开才消耗。
 * 地图边是双向的（map-generator addEdge 双向登记），走回头路是合法移动——
 * 此前 resolveCell 无 visited 拦截，返回旧格会重刷宝箱/火堆/事件等。
 * 口径：
 *   1) 收益节点完成领取即写 visited，站在格上也不能重刷；
 *   2) 商店关闭后仍可重开，离开商店格时才写 visited。
 * 场景动态选择收益格与已有动作可确定退出的邻格，不依赖随机事件的选择或确认；
 * enterLayer 落位不触发内容，正好构造「站在目标格」的起点。 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

installImmediateWebLocks();

// 故意恒真：仅给下方 canvas/存储补桩一个块级作用域（lint 静音，不改逻辑）
// eslint-disable-next-line no-constant-condition
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
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', gain: { value: 0 }, frequency: { value: 0, setValueAtTime: () => {} }, Q: { value: 0 } }; }
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
trackMainPagePreparation();
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 0));

const { game, newRun, enterLayer } = await import('../game/src/run/game.session.js');
const { moveTo, reenterCell } = await import('../game/src/run/game.run.js');
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

const clickAct = (act) => {
  const el = document.querySelector(`[data-act="${act}"]`);
  if (el && !el.disabled && !el.closest('[hidden], [inert], [aria-hidden="true"]')) { el.click(); return true; }
  return false;
};
async function sweep(max = 120) {
  for (let i = 0; i < max; i++) {
    await tick(30);
    if (game.state === 'idle') return;
    for (const act of ['flowContinue', 'chestOverviewCoins', 'chestFinish', 'chestNext', 'chestReveal', 'chestCoins', 'chestContinue', 'chestTake', 'chestTake1', 'chestPick', 'chestSkip', 'chestLeave', 'chestSelect', 'pickupGo', 'closeShop',
      'blankSafeDone', 'evtNext', 'evtChoice', 'resTake', 'resSkip', 'nodeChestSearch', 'fireRestGo', 'fireDone', 'stayHere', 'goDoor']) {
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
    // skipClassChoice：本用例只测节点消耗时机，选角页是干扰项（用例自行补 myClass/characterId）。
    // 必须显式跳过——openClassChoice 会排 500ms warmBattleRuntime 定时器，vitest jsdom 环境的
    // setTimeout 是 Node 原生实现（populateGlobal 不拷贝 window.setTimeout），文件结束 teardown
    // 删掉 window 后该定时器仍会迟到触发（window is not defined），在全量串行跑里污染下一个文件。
    // newRun(mode, picks, options) 只有三参，第三参就是 options（原写法传的是空数组）。
    await newRun(20260919, 'standard', { skipClassChoice: true });
    await tick(50);
    game.myClass = '战士';
    game.characterId = 'heixiang';
    game.state = 'idle';
  });

  // 用例内的预热/加载任务可能排 500ms 级 setTimeout（见 beforeAll 注释的 warmBattleRuntime 家族）。
  // teardown 撤掉 jsdom 全局后迟到触发会抛 "Image is not defined" 类 ReferenceError，被 vitest 记为
  // unhandled error：全过却 exit 1 的假红（2026-10-01 全量门 3 连跑复现 1 次）。排水让它们在本文件
  // 环境还活着时触发完，比逐个堵入口通用。
  afterAll(async () => { await tick(700); await releaseMainPage(); });

  it('收益完成即锁；商店离开才锁；返回均不重复触发', async () => {
    // 层内类型布局按局随机（种子固定但 skipClassChoice/上游随机源演进都会平移消耗序列，
    // 固定种子不再保证「第 1 层=直线图」的旧前提），动态选目标格：优先宝箱/物资格
    // （收益可计数），兜底商店（页面可观测），且其邻格存在可正常结算的格子
    // （仅入口/空白/商店/营火，不进入需要独立选择与确认的随机事件）。enterLayer 只置位不触发内容，用来构造
    // 「站在目标格」的起点。目标格可能落在任意层：逐层扫描；整局都没有合法格是
    // 合法随机结果——重摇重试到找到（有上限），被测行为与具体布局无关。
    const sweepable = t => ['entrance', 'blank', 'shop', 'fire'].includes(t);
    const neighborsOf = (li, idx) => (game.layerData[li].logical[idx].next || []).filter(([l]) => l === li).map(([, i]) => i);
    const LOOT_TYPES = ['chest', 'coin', 'wood', 'rations', 'key', 'resource'];
    const findTarget = () => {
      for (let li = 0; li < game.layerData.length; li++) {
        for (const want of [LOOT_TYPES, ['shop']]) {
          for (let i = 0; i < game.layerData[li].logical.length; i++) {
            if (!want.includes(typeOfLocal(li, i))) continue;
            const nb = neighborsOf(li, i).find(n => sweepable(typeOfLocal(li, n)));
            if (nb != null) return { li, cellIdx: i, leaveIdx: nb, kind: typeOfLocal(li, i) };
          }
        }
      }
      return null;
    };
    let target = findTarget();
    for (let reroll = 0; !target && reroll < 5; reroll++) {
      await newRun(20260919 + reroll + 1, 'standard', { skipClassChoice: true });
      await tick(50);
      game.myClass = '战士';
      game.characterId = 'heixiang';
      game.state = 'idle';
      target = findTarget();
    }
    expect(target, '整局应存在邻格可正常结算的宝箱/物资/商店格（重摇 5 次后仍无则地图生成有问题）').toBeTruthy();
    const { li, cellIdx, leaveIdx, kind } = target;
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
      // 完成提示可能写入默认收起的日志；直接核对旧节点不会再给可领取输入。
      expect(document.querySelector('[data-act="chestSelect"], [data-act="chestTake"], [data-act="pickupGo"]')).toBeNull();
    } else {
      expect(game.visited[vKey]).toBeFalsy(); // 关闭商店尚未离开，仍可重逛
      expect(reenterCell()).toBe(true);
      await sweep();
      expect(game.visited[vKey]).toBeFalsy();
    }

    // 走去邻格：商店在此刻补写 visited；收益节点保持已完成。
    expect(moveTo(li, leaveIdx)).toBe(true);
    await sweep();
    expect(game.state, `离开 ${kind} 格后，受控邻格 ${typeOfLocal(li, leaveIdx)} 应完成合法操作`).toBe('idle');
    expect(game.visited[vKey]).toBe(1);

    // 走回本格：移动合法（双向边），但内容不得再触发
    const loot2 = lootCount();
    expect(moveTo(li, cellIdx)).toBe(true);
    await sweep();
    expect(game.state).toBe('idle');
    expect(game.trackPos).toBe(cellIdx);
    if (kind !== 'shop') expect(lootCount(), `${kind} 格返回后不得再入账`).toBe(loot2);
    expect(document.querySelector('[data-act="chestSelect"], [data-act="chestTake"], [data-act="pickupGo"]')).toBeNull();
  });

  it('物资格有独立场景层；暂不领取可重进，领取后立即变普通', async () => {
    await newRun(20260920, 'standard', { skipClassChoice: true });   // 同上：跳过选角页防 500ms 迟到 warm 定时器
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
    expect(document.querySelector('.resource-reward-scene')).toBeTruthy();
    const fixedCards = [...game.nodeRewards[key].cardIds];
    expect(clickAct('resSkip')).toBe(true);
    await tick(30);
    expect(game.visited[key]).toBeFalsy();

    expect(reenterCell()).toBe(true);
    await tick(30);
    expect(game.nodeRewards[key].cardIds).toEqual(fixedCards);
    const beforeRead = game.ownedCards.length;
    expect(clickAct('resRead')).toBe(true);
    expect(game.ownedCards.length).toBe(beforeRead);
    const zoomClaim = document.querySelector('#cardZoom .cz-foot [data-act="resTake"]');
    expect(zoomClaim).not.toBeNull();
    zoomClaim.click();
    await sweep();
    expect(game.visited[key]).toBe(1);
  });

  it('商店关闭不消耗，离开所在格才变普通', async () => {
    await newRun(20260921, 'standard', { skipClassChoice: true });   // 同上：跳过选角页防 500ms 迟到 warm 定时器
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
  it.each(['wood','rations','key'])('%s满包可暂离、真实存读档与离开重进保留未领奖；腾格领取只结算一次', async kind => {
    const session = await import('../game/src/run/game.session.js');
    const { RunStorage } = await import('../game/src/hub/game.storage.js');
    const slot=4; session._set_active_slot(slot);window.SDT.Base.use(slot);
    try {
      await newRun('standard',[],{skipClassChoice:true});game.myClass='武';game.characterId='wu';game.state='idle';
      const idx=game.layerData[0].logical.findIndex(cell=>(cell.next||[]).some(([li])=>li===0));
      const neighbor=game.layerData[0].logical[idx].next.find(([li])=>li===0)[1];
      const originalDef=game.layerData[0].logical[idx].def,originalNeighborDef=game.layerData[0].logical[neighbor].def;
      game.layerData[0].logical[idx].def={type:kind,n:1};game.layerData[0].logical[neighbor].def={type:'entrance',name:'测试安全位置',extraction:false};
      enterLayer(0,idx);game.entrySupply=null;
      const eligible=window.SDT.Cards.all().filter(card=>card.type==='法术');
      const unique=[...new Map(eligible.map(card=>[card.name,card])).values()].slice(0,game.bagCap());
      game.ownedCards=unique.map((card,i)=>({uid:`full-${i}`,card:{...card}}));
      expect(game.usedSlots()).toBe(game.bagCap());
      expect(reenterCell()).toBe(true);
      const key=`0,${idx}`,pending=JSON.parse(JSON.stringify(game.nodeChestRewards[key]));
      game.layerData[0].logical[idx].def=originalDef; // 旧资源入口不是现行地图生成类型；待领记录独立于地图投影。
      game.layerData[0].logical[neighbor].def=originalNeighborDef; // 返回地图会保存，先恢复完整合法地图。
      expect(pending.current.cards).toHaveLength(1);expect(game.visited[key]).toBeFalsy();
      expect(clickAct('chestReturn')).toBe(true);expect(game.state).toBe('idle');
      game.layerData[0].logical[neighbor].def={type:'entrance',name:'测试安全位置',extraction:false};
      expect(moveTo(0,neighbor)).toBe(true);await tick(30);
      game.layerData[0].logical[neighbor].def=originalNeighborDef; // 安全落位只供此夹具，不污染持久化地图配额。
      expect(session.saveGame()).toBe(true);
      expect(session.loadGame(slot).ok).toBe(true);
      expect(game.trackPos).toBe(neighbor);expect(game.nodeChestRewards[key]).toEqual(pending);
      game.ownedCards.pop();
      expect(moveTo(0,idx)).toBe(true);await tick(30);
      expect(document.querySelector('[data-act="chestTake1"]')).toBeTruthy();
      expect(clickAct('chestTake1')).toBe(true);expect(clickAct('chestContinue')).toBe(true);
      expect(game.visited[key]).toBe(1);expect(game.nodeChestRewards[key]).toBeUndefined();
      const count=game.ownedCards.length;reenterCell();await tick(30);expect(game.ownedCards.length).toBe(count);
    } finally { session._set_active_slot(null);RunStorage.remove(slot); }
  });
  it('门旁商队关闭重进保留购买记录，穿门后旧店关闭且旧购买动作失效', async () => {
    await newRun('standard',[],{skipClassChoice:true});game.myClass='武';game.characterId='wu';game.state='idle';game.entrySupply=null;game.coins=999;
    const door=game.layerData[0].doors[0],idx=door.at,key=`0,${idx}`;
    game.layerData[0].logical[idx].def={...game.layerData[0].logical[idx].def,type:'shop'};
    enterLayer(0,idx);reenterCell();await tick(30);
    expect(clickAct('doorShop')).toBe(true);
    const stockKey=`door:${door.pair}`,stock=game.shopStocks[stockKey];
    const buyIndex=stock.findIndex(slot=>slot.card&&!slot.empty&&!slot.sold&&!slot.mystery&&slot.shaReplenish==null);
    expect(buyIndex).toBeGreaterThanOrEqual(0);
    window.SDT.UI._acts.buyCard({i:String(buyIndex)});
    expect(stock[buyIndex].sold).toBe(true);
    const oldBuy=window.SDT.UI._acts.buyCard,coins=game.coins,before=JSON.stringify(stock);
    expect(clickAct('closeShop')).toBe(true);reenterCell();await tick(30);expect(clickAct('doorShop')).toBe(true);
    expect(JSON.stringify(game.shopStocks[stockKey])).toBe(before);expect(game.visited[key]).toBeFalsy();
    expect(clickAct('closeShop')).toBe(true);reenterCell();await tick(30);expect(clickAct('goDoor')).toBe(true);
    expect(game.visited[key]).toBe(1);oldBuy({i:String(buyIndex)});expect(game.coins).toBe(coins);
    enterLayer(0,idx);reenterCell();await tick(30);
    expect(document.querySelector('[data-act="doorShop"]')).toBeNull();
  });
  it('F38 真实新局保存/读取保留轮换开关，缺轮换字段的快照与旧种子档均继续旧遭遇', async () => {
    const session = await import('../game/src/run/game.session.js');
    const { RunStorage } = await import('../game/src/hub/game.storage.js');
    const { Random } = await import('../game/src/core/random.js');
    const { buildEncounter } = await import('../game/src/run/game.run.scenes.js');
    const slot = 5;
    RunStorage.remove(slot);
    session._set_active_slot(slot); window.SDT.Base.use(slot);
    try {
      expect(await newRun('standard', [], { skipClassChoice:true })).not.toBe(false);
      game.myClass = '武'; game.characterId = 'wu'; game.state = 'idle';
      expect(game.encounterRotationVersion).toBe(1);
      const battle = game.layerData[2].logical.findIndex(cell => cell.def.type === 'battle');
      enterLayer(2, battle);
      expect(session.saveGame()).toBe(true);
      const modern = RunStorage.read(slot);
      expect(modern.encounterRotationVersion).toBe(1);
      game.encounterRotationVersion = 0;
      expect(session.loadGame(slot).ok).toBe(true);
      expect(game.encounterRotationVersion).toBe(1);
      const stableMap = JSON.stringify(game.layerData.map(layer => layer.logical.map(cell => [cell.id, cell.x, cell.row, cell.def, cell.next])));
      const state = Random.snapshot();
      const first = buildEncounter(2);
      Random.restore(state);
      expect(buildEncounter(2)).toEqual(first);
      // 新4/9必须保留快照：缺失时拒绝恢复，并完整保留原存档以便修复。
      const damaged = JSON.parse(JSON.stringify(modern));
      delete damaged.mapSnapshot; delete damaged.routeVersion;
      expect(RunStorage.write(slot, damaged)).toBe(true);
      const rawBeforeRejectedLoad = localStorage.getItem(`sdt-run-${slot}`);
      expect(session.loadGame(slot)).toMatchObject({ ok: false, preserveRun: true, code: 'UNSUPPORTED_LEGACY_MAP' });
      expect(localStorage.getItem(`sdt-run-${slot}`)).toBe(rawBeforeRejectedLoad);
      for (const legacySeedOnly of [false, true]) {
        const legacy = JSON.parse(JSON.stringify(modern));
        delete legacy.encounterRotationVersion;
        if (legacySeedOnly) {
          delete legacy.mapSnapshot; delete legacy.routeVersion;
          legacy.generatorVersion = 3; legacy.layoutVersion = 9; // 真正旧seed-only身份，不伪造新4/9丢失快照。
        }
        expect(RunStorage.write(slot, legacy)).toBe(true);
        game.encounterRotationVersion = 1;
        expect(session.loadGame(slot).ok).toBe(true);
        expect(game.encounterRotationVersion).toBe(0);
        if (!legacySeedOnly) expect(JSON.stringify(game.layerData.map(layer => layer.logical.map(cell => [cell.id, cell.x, cell.row, cell.def, cell.next])))).toBe(stableMap);
        Random.restore(state);
        const old = buildEncounter(2);
        expect(old.encounterId.startsWith('rotation:')).toBe(false);
        expect(new Set(old.map(enemy => enemy.id)).size).toBe(1);
      }
    } finally {
      session._set_active_slot(null);
      RunStorage.remove(slot);
    }
  });
});
