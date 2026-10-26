import { playerFields, canvasTraps, audioGainFields } from './helpers/environment-fixtures.js';
/* 反馈12条·B组（6/9）真实启动链：敌方指向道具的目标点选必须能收口，
 * 不能把 pendingItem 永久挂在快照里——那会让道具栏此后完全点不动。 */
import { afterAll, describe, it, expect, vi } from 'vitest';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

// jsdom 无 WebGL：序列帧层（battle.frames）在入场闸里 await 会一直挂着，
// 战台 inert + 动作队列 busy 永不清除。只把「帧层就绪」换成恒真，其余保持真实实现。
vi.mock('../game/src/battle/view/battle.frames.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, attach: async () => true };
});

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
{
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
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false, playbackRate: { value: 1 } }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0 }, gain: { value: 0 }, Q: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0 } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
globalThis.fetch = window.fetch = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ version: '0.60.0' }) });

// jsdom 不加载图片资源：战场入场闸（battle.presentation-ready）会一直等 .sts-figure /
// 手牌卡面 img 的 load/decode，导致舞台 inert + 队列动作永久 busy。这里把图片打成
// 「已解码可用」，只还原浏览器里必然发生的成功路径，不改被测代码。
Object.defineProperty(window.HTMLImageElement.prototype, 'complete', { configurable: true, get() { return true; } });
Object.defineProperty(window.HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get() { return 64; } });
Object.defineProperty(window.HTMLImageElement.prototype, 'naturalHeight', { configurable: true, get() { return 64; } });
window.HTMLImageElement.prototype.decode = function () { return Promise.resolve(); };

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

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const LOGS = [];

describe('道具栏：选目标与结算收口', () => {
  it('多敌时敌方指向道具点选敌人后结算；未点选期间其它道具仍可打开', { timeout: 20_000 }, async () => {
    const game = Object.assign(window.SDT.game, {
      ownedCards: [],
      ...playerFields(30, 40, 5, 0, '侠客', null),
      log(msg) { LOGS.push(String(msg).replace(/<[^>]+>/g, '')); },
      heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
      onBattleEnd() {},
    });
    // 用卡库真身（带 rules.bag.use 结构化规则），不手搓卡——手搓卡会走文本分支。
    const catalogCard = id => {
      const card = window.SDT.Cards.all().find(entry => entry.id === id);
      expect(card, `card ${id} 存在于卡库`).toBeTruthy();
      return { ...card };
    };
    game.ownedCards.push({ uid: 'it-ice', card: catalogCard('tt3-iceheart-potion') });
    game.ownedCards.push({ uid: 'it-tnt', card: catalogCard('tt3sp-doom') });
    const foes = [
      { id: 'infantry', name: '靶一', hp: 30, maxHp: 30, atk: 2 },
      { id: 'infantry', name: '靶二', hp: 30, maxHp: 30, atk: 2 },
    ];
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    try {
      const started = await window.SDT.BattleLoader.start(game, foes, { isBoss: false, name: '目标点选测试' });
      expect(started).not.toBe(false);
      await tick(50);

      const snapshot = () => window.SDT.Battle.getSnapshot();
      const panel = () => document.querySelector('[data-potion-use]');
      const potions = () => [...document.querySelectorAll('.bt-potion')];
      expect(potions().length).toBe(2);
      expect(snapshot().pendingItem).toBeFalsy();

      // —— 敌方指向道具：打开确认框 → 使用 → 进入点选 ——
      const ice = potions().find(el => el.textContent.includes('冰冻药水'));
      ice.click();
      expect(panel()).not.toBeNull();
      panel().querySelector('.bt-potion-use-confirm').click();
      await tick(40);
      expect(snapshot().pendingItem && snapshot().pendingItem.uid).toBe('it-ice');
      // 进入点选态必须让敌人亮起来——不亮=玩家看不出要点谁，会以为「道具用不了」
      expect(document.querySelector('.sts-foe.can-target'), '点选态敌人应高亮').not.toBeNull();

      // —— 点选期间不能提交（防御性：不应误结算）——
      ice.click();
      expect(panel()).toBeNull();
      // —— 反馈6 同源：点选态没收口时，TNT 等其余道具也一并打不开 ——
      const tntWhileTargeting = potions().find(el => el.textContent.includes('TNT'));
      expect(tntWhileTargeting).toBeTruthy();
      tntWhileTargeting.click();
      expect(panel(), '点选态下 TNT 入口同样被拒').toBeNull();

      // —— 点击敌人收口：状态生效、道具离场、pendingItem 清空 ——
      const slot = document.querySelector('.sts-foe');
      expect(slot).not.toBeNull();
      slot.click();
      await tick(600);
      expect(snapshot().pendingItem).toBeFalsy();
      expect(snapshot().foes.some(f => (f.status && f.status.freeze || 0) > 0)).toBe(true);
      expect(game.ownedCards.some(o => o.uid === 'it-ice')).toBe(false);

      // —— 收口后道具栏恢复可用：TNT 仍能开框并结算 ——
      const tnt = potions().find(el => el.textContent.includes('TNT'));
      expect(tnt).toBeTruthy();
      tnt.click();
      expect(panel()).not.toBeNull();
      panel().querySelector('.bt-potion-use-confirm').click();
      await tick(200);
      expect(snapshot().pendingItem).toBeFalsy();
      expect(snapshot().foes.filter(f => f.dead).length).toBe(2);
      expect(game.ownedCards.some(o => o.uid === 'it-tnt')).toBe(false);
    } finally {
      if (game.battleActive) window.SDT.Battle.commands.flee();
      Element.prototype.animate = oldAnimate;
      document.getElementById('overlay')?.setAttribute('hidden', '');
      game.state = 'title';
    }
  });
});
