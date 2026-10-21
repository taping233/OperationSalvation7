/* 反馈12条·B组（10）：敌方负面状态图标——施加到敌人身上的每一个状态，
 * 名牌角标都必须同时给出图标与文案，不能出现「有状态没图标」。 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}), play() {},
  setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
// 真实图标口径：[[icon:key]] 必须被解析成 <img>，测试据此断言「图标真的出了」。
const rich = value => String(value || '').replace(/\[\[icon:([^\]]+)\]\]/g, (_m, key) => `<img class="ic" data-icon="${key}" alt="">`);
const UI = {
  el: {}, _lastMode: null, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, Combat } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
await import('../game/src/battle/view/battle.view.js');
const { mountUnitLayer, updateUnits } = await import('../game/src/battle/view/battle.layers.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
let game, frames;
const originalAnimate = Element.prototype.animate;
const foeMount = () => UI.el.ovBody.querySelector('[data-unit-mount="foes"]');
const foes = () => [...foeMount().children];
function flush() { const pending = frames; frames = []; pending.forEach(callback => callback(performance.now())); }
async function settle() {
  for (let i = 0; i < 400; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!Runtime.busy && !BattleSession.getSnapshot().actionQueueLength && !frames.length) return;
  }
  throw new Error('Battle did not settle');
}
async function start() {
  game = {
    ownedCards: [{ uid: 'status-bandage', card: structuredClone(catalog.find(card => card.id === 'tt3-bandage')) }],
    inventory: [], usedPocket: [], hp: 60, maxHp: 80, atk: 4, spellPower: 1, coins: 0, myClass: '法师',
    state: 'idle', battleActive: false, log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'unit-target', name: '训练靶', hp: 120, atk: 3 }], { isBoss: false });
  await settle();
  const snapshot = BattleSession.getSnapshot();
  return { ...snapshot, equipped: [], allies: [], foes: [{ ...snapshot.foes[0], status: {} }] };
}
function paint(snapshot, ctx = {}) {
  updateUnits(mountUnitLayer(UI.el.ovBody, snapshot.battleToken), snapshot, ctx);
}
beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  localStorage.setItem('sdt-intent-legend', '1');
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI._lastMode = null;
});
afterEach(async () => {
  clearFeedback();
  if (game?.battleActive) { commands.flee(); await settle(); }
  UI.hideOverlay(); frames = []; Element.prototype.animate = originalAnimate; vi.restoreAllMocks();
});

it('施加到敌人身上的每个诅咒都渲染出图标角标', async () => {
  const snapshot = await start();
  const all = [...Combat.CURSES, ...Combat.BUFFS];
  expect(all.length).toBeGreaterThanOrEqual(16);
  // 一次全挂：任一状态缺图标都会让下面的逐键断言失败
  snapshot.foes[0].status = Object.fromEntries(all.map(key => [key, key === 'atkDown' || key === 'stealth' ? 2 : 1]));
  paint(snapshot);
  const plate = foes()[0].querySelector('.sts-chips');
  expect(plate, '状态角标容器存在').not.toBeNull();
  for (const key of all) {
    const chip = plate.querySelector(`.bt-curse.c-${key}, .bt-buff.b-${key}`);
    expect(chip, `${key} 有角标`).not.toBeNull();
    const icon = chip && chip.querySelector('img.ic');
    expect(icon, `${key} 角标带图标`).not.toBeNull();
    expect(icon && icon.getAttribute('data-icon'), `${key} 图标名`).toBeTruthy();
    expect(chip.textContent.trim().length, `${key} 角标带文案`).toBeGreaterThan(0);
  }
  // 未解析的图标标记=玩家会看到裸文本 [[icon:x]]
  expect(plate.innerHTML).not.toContain('[[icon:');
  // 逐键增删同步：先清空再单独挂一个，验证没有被前一状态的签名缓存吞掉
  for (const key of all) {
    snapshot.foes[0].status = { [key]: 1 };
    paint(snapshot);
    const chips = [...foes()[0].querySelectorAll('.sts-chips .bt-curse, .sts-chips .bt-buff')];
    expect(chips.map(el => el.className.split(' ')[1]), `${key} 单挂时角标`)
      .toEqual([Combat.CURSES.includes(key) ? `c-${key}` : `b-${key}`]);
    expect(chips[0].querySelector('img.ic'), `${key} 单挂带图标`).not.toBeNull();
  }
});

it('标记类负面状态（腐化/契约回响）同样出图标角标', async () => {
  const snapshot = await start();
  for (const patch of [
    { rotSeedMarked: true, label: '腐化标记' },
    { deathBurst: { status: 'poison', multiplier: 1 }, label: '腐化标记' },
    { damageEcho: { amount: 2, dmgType: 'true', recursive: false }, label: '契约回响' },
    { soulContractMarked: true, label: '契约回响' },
  ]) {
    snapshot.foes[0].status = {};
    snapshot.foes[0].rotSeedMarked = false;
    snapshot.foes[0].deathBurst = null;
    snapshot.foes[0].damageEcho = null;
    snapshot.foes[0].soulContractMarked = false;
    Object.assign(snapshot.foes[0], patch);
    paint(snapshot);
    const plate = foes()[0].querySelector('.sts-chips');
    const chip = plate && plate.querySelector('.bt-affix');
    expect(chip, `${patch.label} 角标存在`).not.toBeNull();
    expect(chip.querySelector('img.ic'), `${patch.label} 带图标`).not.toBeNull();
    expect(chip.textContent, `${patch.label} 文案`).toContain(patch.label);
  }
  // 同一卡的两种标记写法不重复出角标
  snapshot.foes[0].rotSeedMarked = true;
  snapshot.foes[0].deathBurst = { status: 'poison', multiplier: 1 };
  snapshot.foes[0].damageEcho = null; snapshot.foes[0].soulContractMarked = false;
  paint(snapshot);
  expect([...foes()[0].querySelectorAll('.sts-chips .bt-affix')].map(el => el.textContent.trim())).toEqual(['腐化标记']);
});
