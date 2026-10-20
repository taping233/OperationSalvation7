import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}),
  play() {}, setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
// Observe one connected button's gesture dispatch without constructing a drag session.
vi.mock('../game/src/battle/view/battle.aim.js', async importOriginal => ({
  ...await importOriginal(), startAim: vi.fn(),
}));

const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const { startAim } = await import('../game/src/battle/view/battle.aim.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
const originalRaf = window.requestAnimationFrame, originalAnimate = Element.prototype.animate;
let frames, game;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const snapshot = () => BattleSession.getSnapshot();
const skill = () => stage().querySelector('[data-act="btSlam"]');
const page = () => stage().querySelector('[data-act="btHandPage"]');
function flush() { for (let i = 0; frames.length && i < 40; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 300; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!snapshot().busy && !snapshot().actionQueueLength) { flush(); return; }
  }
  throw new Error('Battle tools fixture action did not settle');
}
function start({ many = true } = {}) {
  const cards = ['tt3-magic-lamp', 'tt3-treasure-hunt', 'tt3sp-bloodstorm'];
  if (many) cards.push(...catalog.filter(card => ['武术', '法术'].includes(card.type) && !cards.includes(card.id)).slice(0, 8).map(card => card.id));
  game = {
    ownedCards: cards.map(id => ({ uid: id, card: catalog.find(card => card.id === id) })),
    inventory: [], usedPocket: [], hp: 80, maxHp: 80, atk: 4, spellPower: 0, coins: 0,
    myClass: '法师', state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `tools-foe-${i}`, name: `工具栏靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  flush();
}
function expectUniqueTools({ ready = true, pages = true } = {}) {
  const tools = stage().querySelectorAll('.sts-hand-tools');
  expect(tools).toHaveLength(1);
  expect(tools[0].parentElement).toBe(stage().querySelector('#btSelf'));
  expect(stage().querySelector('.sts-hud > .sts-hand-tools')).toBeNull();
  expect(stage().querySelectorAll('[data-act="btSlam"]')).toHaveLength(1);
  expect(skill().disabled).toBe(!ready);
  expect(stage().querySelectorAll('[data-act="btHandPage"]')).toHaveLength(pages ? 1 : 0);
  return tools[0];
}
function expectCoveredStage(scene = stage()) {
  expect(stage()).toBe(scene);
  expect(scene.hasAttribute('inert')).toBe(true);
  expect(scene.getAttribute('aria-hidden')).toBe('true');
  expect(UI.el.ovBody.querySelector('.battle-secondary-panel')).not.toBeNull();
}
beforeEach(() => {
  frames = []; vi.clearAllMocks();
  Random.reseed('battle-tools-lifecycle');
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle(); frames = []; actions.clear();
  window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
  vi.restoreAllMocks();
});

describe('battle tools template ownership', () => {
  it('replaces retained disabled tools with the fresh ready template after a full redraw', () => {
    start();
    const player = stage().querySelector('#btSelf');
    render({ ...snapshot(), busy: true });
    const oldTools = expectUniqueTools({ ready: false }), oldSkill = skill();
    UI.showOverlay('外层面板', '<button>关闭</button>', 'settings');
    render();
    expect(stage().querySelector('#btSelf')).toBe(player);
    expect(expectUniqueTools()).not.toBe(oldTools);
    expect(oldTools.isConnected).toBe(false); expect(oldSkill.isConnected).toBe(false);
    expect(skill().dataset.skillState).toBe('ready');
    expect(skill().getAttribute('aria-label')).toContain('可用');
    expect(skill().getAttribute('aria-label')).not.toContain('结算中');
    for (let i = 0; i < 5; i++) { render(); expectUniqueTools(); }
  });

  it.each([
    ['grave', 'btGrave', 'btGraveBack'],
    ['settings', 'btSettings', 'btSettingsBack'],
  ])('keeps one current set after repeated %s open/return and incremental patches', (_kind, open, close) => {
    start();
    for (let i = 0; i < 4; i++) {
      const oldTools = expectUniqueTools(), scene = stage();
      if (open === 'btGrave') BattleSession.commands.openGrave();
      else UI.el.ovBody.querySelector(`[data-act="${open}"]`).click();
      flush();
      expectCoveredStage(scene);
      UI.el.ovBody.querySelector(`[data-act="${close}"]`).click(); flush();
      expect(expectUniqueTools()).toBe(oldTools); expect(oldTools.isConnected).toBe(true);
      expect(stage().hasAttribute('inert')).toBe(false);
      expect(stage().hasAttribute('aria-hidden')).toBe(false);
      render(); expectUniqueTools();
    }
  });

  it('普通战背包按钮与命令均被锁定，手牌和独立道具快捷栏不受影响', () => {
    start();
    const current = stage(), before = [...snapshot().hand];
    const bagButton = current.querySelector('[data-act="btBag"]');
    expect(bagButton).toBeNull();
    expect(BattleSession.commands.openBag()).toBe(false);
    expect(actions.has('btBag')).toBe(false); // 战斗不注册可绕过通用入口的背包动作。
    expect(snapshot().viewingBag).toBe(false);expect(stage()).toBe(current);
    expect(snapshot().hand).toEqual(before);expectUniqueTools();
  });

  it('returns from the real lamp enemy-target choice with one ready set through the next turn', async () => {
    start();
    BattleSession.commands.playCard('tt3-magic-lamp'); flush();
    expect(snapshot().pendingTarget?.uid).toBe('tt3-magic-lamp');
    stage().querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
    expect(snapshot().choosing?.cardName).toBe('神灯'); expectCoveredStage();
    const choice = UI.el.ovBody.querySelector('[data-act="btChoicePick"][data-i="2"]');
    expect(choice.textContent).toContain('冰冻 2 名角色');
    choice.click(); await settle();
    expect(snapshot().pdef.armor).toBe(5); expect(snapshot().choosing).toBeNull();
    expectUniqueTools();
    const turn = snapshot().turn;
    BattleSession.commands.endTurn(); await settle();
    expect(snapshot().turn).toBe(turn + 1); expectUniqueTools();
  });

  it('returns from real discovery with one current set and preserves subsequent updates', async () => {
    start();
    BattleSession.commands.playCard('tt3-treasure-hunt', 0); await settle();
    expect(snapshot().discovering?.options.length).toBeGreaterThan(0); expectCoveredStage();
    await new Promise(resolve => setTimeout(resolve, 360));
    UI.el.ovBody.querySelector('[data-act="btDiscover"][data-i="0"]').click(); await settle();
    expect(snapshot().discovering).toBeNull(); expectUniqueTools();
    set$energy(0); render();
    expectUniqueTools({ ready: false }); expect(skill().dataset.skillState).toBe('unaffordable');
    set$energy(9); render(); expectUniqueTools(); expect(skill().dataset.skillState).toBe('ready');
  });

  it('keeps one set when target or infusion is cancelled, and when the lethal warning returns', () => {
    start();
    BattleSession.commands.playCard('tt3-magic-lamp'); flush();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); flush();
    expect(snapshot().pendingTarget).toBeNull(); expectUniqueTools();
    BattleSession.commands.beginInfusion('tt3sp-bloodstorm'); flush();
    expectUniqueTools(); expectCoveredStage();
    const energy = snapshot().energy;
    skill().click();
    expect(snapshot().energy).toBe(energy); // Retained tools are behind the inert input shield.
    UI.el.ovBody.querySelector('[data-act="btInfuseCancel"]').click(); flush();
    expect(snapshot().infusing).toBeNull(); expectUniqueTools();
    game.hp = 1; render(); UI.el.ovBody.querySelector('[data-act="btEnd"]').click();
    expectCoveredStage();
    UI.el.ovBody.querySelector('[data-act="btRiskBack"]').click();
    expect(game.hp).toBe(1); expectUniqueTools();
  });

  it('does not duplicate paging or gesture listeners across patches and full redraws', () => {
    start();
    for (let cycle = 0; cycle < 3; cycle++) {
      for (let i = 0; i < 5; i++) { render(); expectUniqueTools(); }
      const button = skill(), firstPage = page().textContent;
      button.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
      expect(startAim).toHaveBeenCalledTimes(cycle + 1);
      expect(startAim.mock.calls[cycle][1]).toBe(button);
      page().click(); expect(page().textContent).not.toBe(firstPage); expectUniqueTools();
      page().click(); expect(page().textContent).toBe(firstPage); expectUniqueTools();
      UI.el.ovBody.querySelector('[data-act="btSettings"]').click();
      UI.el.ovBody.querySelector('[data-act="btSettingsBack"]').click();
      expect(button.isConnected).toBe(true); expect(skill()).toBe(button); expectUniqueTools();
    }
    const onSkill = vi.fn(); actions.set('btSlam', onSkill);
    skill().click(); expect(onSkill).toHaveBeenCalledTimes(1);
  });

  it('spends for the real skill once after repeated returns, retains used state, then resets next turn', async () => {
    start();
    for (let i = 0; i < 3; i++) {
      render();
      UI.el.ovBody.querySelector('[data-act="btSettings"]').click();
      UI.el.ovBody.querySelector('[data-act="btSettingsBack"]').click();
    }
    const energy = snapshot().energy;
    skill().click(); skill().click(); await settle();
    expect(snapshot().energy).toBe(energy - 1);
    expectUniqueTools({ ready: false }); expect(skill().dataset.skillState).toBe('used');
    UI.el.ovBody.querySelector('[data-act="btSettings"]').click();
    UI.el.ovBody.querySelector('[data-act="btSettingsBack"]').click();
    expectUniqueTools({ ready: false }); expect(skill().getAttribute('aria-label')).toContain('已使用');
    skill().click(); await settle(); expect(snapshot().energy).toBe(energy - 1);
    BattleSession.commands.endTurn(); await settle();
    expectUniqueTools(); expect(skill().dataset.skillState).toBe('ready');
  });

  it('removes and reintroduces paging through one shared set and starts the next battle cleanly', () => {
    start(); expectUniqueTools();
    const original = snapshot();
    // Stable shortcut slots intentionally last for one turn; compact at the turn boundary.
    render({ ...original, turn: original.turn + 1, hand: original.hand.slice(0, 2) }); expectUniqueTools({ pages: false });
    render({ ...original, turn: original.turn + 2 }); expectUniqueTools();
    const oldSelf = stage().querySelector('#btSelf'), oldTools = expectUniqueTools();
    start({ many: false });
    expectUniqueTools({ pages: false });
    expect(stage().querySelector('#btSelf')).not.toBe(oldSelf); expect(oldTools.isConnected).toBe(false);
  });
});
