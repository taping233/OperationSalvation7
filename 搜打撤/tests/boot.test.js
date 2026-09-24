/* 启动链冒烟测试：真实导入 src/main.js 并触发 DOMContentLoaded。
 * 回归目标：ESM 循环导入下模块体在顶层读 game 导致启动崩溃
 *（症状：标题页漏出局内下方控制栏 / 开始游戏·设置按钮无响应）。
 * jsdom 无 canvas/Audio/WebAudio，这里 stub 掉渲染与音频，只验启动接线。 */
import { describe, it, expect } from 'vitest';

// ---- 环境补桩（必须在动态 import main.js 之前就位） ----
// 2D 上下文：所有方法返回可链式/可读的哑值
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

  it('卡牌档案馆可打开、筛选、清空与排序', { timeout: 15_000 }, async () => {
    const originalSfx = window.SDT.Sound.sfx;
    window.SDT.Sound.sfx = () => {};
    document.getElementById('btnCardLib').click();
    const page = document.querySelector('.card-library-page');
    expect(page).not.toBeNull();
    expect(document.getElementById('libResultCount')).not.toBeNull();
    const search = document.getElementById('cardSearch');
    search.value = '不存在的卡牌';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 150));
    expect(document.querySelector('.clib-empty')).not.toBeNull();
    expect(document.querySelector('#libPreview .studio-preview-empty')).not.toBeNull();
    document.querySelector('[data-act="libClearFilter"]').click();
    expect(document.querySelector('.lib-grid')).not.toBeNull();
    expect(document.querySelector('#libPreview .studio-preview-frame')).not.toBeNull();
    const sort = document.getElementById('libSort');
    sort.value = 'name';
    sort.dispatchEvent(new Event('input', { bubbles: true }));
    expect(sort.value).toBe('name');
    window.SDT.Sound.sfx = originalSfx;
  });

  it('照相馆以照片背签打开，默认大图仍用卡牌面且保留 footer 委托', async () => {
    const originalSfx = window.SDT.Sound.sfx;
    window.SDT.Sound.sfx = () => {};
    const card = document.querySelector('#libGrid .lib-cardwrap');
    expect(card).not.toBeNull();
    const sourcePaper = card.querySelector('.studio-photo-paper');
    const originalUiRect = window.SDT.UiScale.rect;
    const originalClientRects = Element.prototype.getClientRects;
    const sourceBox = { left: 80, top: 90, width: 120, height: 160 };
    const targetBox = { left: 300, top: 160, width: 620, height: 500 };
    const rect = box => ({ ...box, right: box.left + box.width, bottom: box.top + box.height });
    sourcePaper.getBoundingClientRect = () => rect(sourceBox);
    window.SDT.UiScale.rect = node => node.classList?.contains('cz-photo-paper')
      ? rect(targetBox)
      : node.classList?.contains('studio-photo-paper') ? rect(sourceBox) : originalUiRect(node);
    Element.prototype.getClientRects = function () { return this.isConnected ? [{}] : []; };
    card.focus();
    card.click();
    const photoZoom = document.getElementById('cardZoom');
    expect(photoZoom?.classList.contains('cz-photo')).toBe(true);
    expect(photoZoom.querySelector('.cz-photo-image img')).not.toBeNull();
    expect(photoZoom.querySelector('.cz-photo-rules')).not.toBeNull();
    expect(photoZoom.querySelector('.cz-card')).toBeNull();
    expect(photoZoom.style.getPropertyValue('--cz-photo-from-transform')).toContain('translate(');
    const photoNote = photoZoom.querySelector('.cz-note-input');
    expect(photoNote.maxLength).toBe(240);
    photoNote.value = '测试照片背签';
    photoNote.dispatchEvent(new Event('input', { bubbles: true }));
    photoZoom.querySelector('.cz-note').click();
    expect(document.getElementById('cardZoom')).toBe(photoZoom);
    await new Promise(r => setTimeout(r, 260));
    expect(photoZoom.querySelector('.cz-note-status').textContent).toBe('已存档');
    expect(document.querySelector('#libPreview .pv-note')?.textContent).toContain('测试照片背签');
    photoNote.value = '';
    photoNote.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 260));
    const { photoNoteFor } = await import('../game/src/cards/card-photo-notes.js');
    const selectedCard = window.SDT.Cards.all().find(c => c.id === card.dataset.card);
    const restoredNote = photoNoteFor(selectedCard);
    expect(document.querySelector('#libPreview .pv-note')?.textContent || '').toBe(restoredNote ? `备注${restoredNote}` : '');
    document.querySelector('#cardZoom .cz-backdrop').click();
    expect(photoZoom.classList.contains('cz-photo-closing-to-source')).toBe(true);
    expect(photoZoom.style.getPropertyValue('--cz-photo-to-transform')).toContain('translate(');
    expect(document.getElementById('overlay').inert).toBe(true);
    expect(photoZoom.querySelector('.cz-note-status').textContent).toBe('尚未撰写');
    await new Promise(r => setTimeout(r, 400));
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(document.getElementById('overlay').inert).toBe(false);
    expect(document.activeElement).toBe(card);
    window.SDT.UiScale.rect = originalUiRect;
    Element.prototype.getClientRects = originalClientRects;

    // Reopening while a photo is reversing cancels that pending removal immediately.
    card.click();
    const reversingPhoto = document.getElementById('cardZoom');
    reversingPhoto.querySelector('.cz-backdrop').click();
    let footerCalled = 0;
    window.SDT.UI.act('zoomTestFooter', () => { footerCalled += 1; });
    window.SDT.UI.showCardZoom(window.SDT.Cards.all()[0], {
      footer: '<button type="button" data-act="zoomTestFooter">测试</button>',
    });
    const defaultZoom = document.getElementById('cardZoom');
    expect(reversingPhoto.isConnected).toBe(false);
    expect(defaultZoom.querySelector('.cz-card .hs-card')).not.toBeNull();
    expect(defaultZoom.querySelector('.cz-photo-layout')).toBeNull();
    defaultZoom.querySelector('.cz-foot [data-act="zoomTestFooter"]').click();
    expect(footerCalled).toBe(1);
    expect(document.getElementById('cardZoom')).toBe(defaultZoom);
    defaultZoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }));
    expect(document.getElementById('cardZoom')).toBe(defaultZoom);
    defaultZoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise(r => setTimeout(r, 270));
    document.querySelector('.card-library-page [data-act="closeCardPage"]').click();
    await new Promise(r => setTimeout(r, 230));
    expect(document.getElementById('overlay').hidden).toBe(true);
    window.SDT.Sound.sfx = originalSfx;
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
  it('核心模块已发布，战斗域按需加载后发布', async () => {
    for (const k of ['RULES', 'MAP', 'Art', 'Icons', 'Sound', 'Camera', 'Notes', 'Cards', 'Base', 'Meta', 'RenderScheduler', 'Renderer', 'UI', 'Chests']) {
      expect(window.SDT[k], `window.SDT.${k} 未发布`).toBeTruthy();
    }
    const { ensureBattleReady } = await import('../game/src/battle/battle-loader.js');
    await ensureBattleReady();
    expect(window.SDT.Battle, 'window.SDT.Battle 按需加载后未发布').toBeTruthy();
    expect(typeof window.SDT.Battle.getSnapshot).toBe('function');
    expect(Object.isFrozen(window.SDT.Battle)).toBe(true);
    for (const command of ['playCard', 'selectInfusion', 'confirmInfusion', 'cancelInfusion', 'endTurn', 'flee', 'openGrave', 'closeGrave', 'selectDeckCard', 'confirmDeck', 'cancelDeck', 'cancelPendingTarget']) {
      expect(typeof window.SDT.Battle.commands[command], `Battle.commands.${command} 未发布`).toBe('function');
    }
  });
  // 骰子 UI 的两个落定测试已随骰子系统整体移除一并退役（2026-09-19 老板定向）。

  it('运行时按 mapSeed 重建局部几何，并以稳定节点提交移动事务', async () => {
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
    const game = session.game;
    session.buildDerived('integration-map-seed');
    expect(game.mapSeed).toBe('integration-map-seed');
    expect(game.generatorVersion).toBeTruthy();
    expect(game.layoutVersion).toBeTruthy();
    expect(game.geometryVersion).toContain('integration-map-seed');
    expect(game.layerBounds).toHaveLength(4);
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
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
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
    const session = await import('../game/src/run/game.session.js');
    const run = await import('../game/src/run/game.run.js');
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
    expect(game.layerData[3].logical[game.layerData[3].exit].def.type).toBe('extraction');
    localStorage.removeItem('sdt-reduce-motion');
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('enterLayer 将入口与可走分支一起构图，隐藏节点不占据画面', async () => {
    const session = await import('../game/src/run/game.session.js');
    const game = session.game;
    const camera = session.cam;
    session.buildDerived('fit-layer-seed');
    camera.resize(800, 600);
    const li = 3;
    const at = game.layerData[li].entrances[0];
    session.enterLayer(li, at);
    expect(game.activeLayerBounds).toEqual(game.layerBounds[li]);
    expect(camera.frameExploration).toBeTypeOf('function');
    const pad = 70;
    const indices = [at, ...game.layerData[li].logical[at].next.filter(([nl]) => nl === li).map(([, idx]) => idx)];
    for (const idx of indices) {
      const p = game.nodePos[li][idx];
      const screen = camera.worldToScreen(p.x, p.y);
      expect(screen.x).toBeGreaterThanOrEqual(pad);
      expect(screen.x).toBeLessThanOrEqual(camera.viewW - pad);
      expect(screen.y).toBeGreaterThanOrEqual(pad);
      expect(screen.y).toBeLessThanOrEqual(camera.viewH - pad);
    }
    game.state = 'title';
  });

  it('战斗指向卡支持点击选中、Esc取消与目标结算', { timeout: 15_000 }, async () => {
    const C = window.SDT.Cards;
    const sha = C.all().find(c => c.id === 'starter-attack');
    const game = {
      ownedCards: [{ uid: 'boot-click-sha', card: sha }], hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 0,
      myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
      onBattleEnd() {},
    };
    const foe = { id: 'infantry', name: '点击测试靶', hp: 40, maxHp: 40, atk: 1 };
    const foe2 = { id: 'infantry', name: '第二目标', hp: 20, maxHp: 20, atk: 1 };
    // 两个敌人：唯一敌人时 STS2 口径会免选直接打出，这里必须双敌才能测「选中→取消→结算」流
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    window.SDT.Battle.start(game, [foe, foe2], { isBoss: false, name: '点击测试' });
    await new Promise(resolve => setTimeout(resolve, 20));
    const card = document.querySelector('.sts-hand .bt-card.need-target');
    const enemy = document.querySelector('.sts-foe[data-eidx="0"]');
    expect(card).not.toBeNull(); expect(enemy).not.toBeNull();
    const hotkey = new KeyboardEvent('keydown', { key: card.dataset.handIndex, bubbles: true, cancelable: true });
    document.dispatchEvent(hotkey);
    expect(card.classList.contains('click-selected')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    card.click();
    expect(card.classList.contains('click-selected')).toBe(true);
    expect(card.getAttribute('aria-pressed')).toBe('true');
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(card.classList.contains('click-selected')).toBe(false);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    card.click();
    const before = window.SDT.Battle.getSnapshot().foes[0].hp;
    enemy.click();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(window.SDT.Battle.getSnapshot().foes[0].hp).toBeLessThan(before);
    expect(window.SDT.Battle.getSnapshot().foes[0].hp).toBeLessThan(40);
    if (game.battleActive) window.SDT.Battle.commands.flee();
    Element.prototype.animate = oldAnimate;
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });

  it('唯一敌人时指向卡点击直接打出（STS2 TryWebClickPlay 口径）', async () => {
    const C = window.SDT.Cards;
    const sha = C.all().find(c => c.id === 'starter-attack');
    const game = {
      ownedCards: [{ uid: 'boot-single-sha', card: sha }], hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 0,
      myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
      onBattleEnd() {},
    };
    const foe = { id: 'infantry', name: '唯一靶', hp: 40, maxHp: 40, atk: 1 };
    const oldAnimate = Element.prototype.animate;
    Element.prototype.animate = function () { return { onfinish: null, cancel() {} }; };
    window.SDT.Battle.start(game, [foe], { isBoss: false, name: '单敌测试' });
    await new Promise(resolve => setTimeout(resolve, 20));
    const card = document.querySelector('.sts-hand .bt-card.need-target');
    expect(card).not.toBeNull();
    card.click();
    // 单敌：不进入选中态，直接结算伤害
    expect(card.classList.contains('click-selected')).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(window.SDT.Battle.getSnapshot().foes[0].hp).toBeLessThan(40);
    if (game.battleActive) window.SDT.Battle.commands.flee();
    Element.prototype.animate = oldAnimate;
    document.getElementById('overlay')?.setAttribute('hidden', '');
    game.state = 'title';
  });
});
