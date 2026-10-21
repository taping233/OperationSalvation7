import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';

const observed = vi.hoisted(() => ({ handStates: [], snapshots: 0 }));
vi.mock('../game/src/battle/core/battle.core.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, getSnapshot(...args) { observed.snapshots++; return actual.getSnapshot(...args); } };
});
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}),
  play() {}, setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
vi.mock('../game/src/battle/view/battle.hand-hit.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, createHandHitController(...args) {
    const controller = actual.createHandHitController(...args), sync = controller.sync;
    controller.sync = (token, snapshot) => { observed.handStates.push({ token, snapshot }); return sync(token, snapshot); };
    return controller;
  } };
});

const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
let onOverlay = null;
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode, options = {}) {
    this._overlayRevision = (this._overlayRevision || 0) + 1;
    if (options.battleBody) { if (!options.battleBody(rich(html))) return; }
    else this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode;
    const hook = onOverlay; onOverlay = null; hook?.();
  },
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
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
const originalRaf = window.requestAnimationFrame, originalAnimate = Element.prototype.animate;
let frames, game;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const snapshot = () => BattleSession.getSnapshot();
const node = selector => stage().querySelector(selector);
function flush() { for (let i = 0; frames.length && i < 50; i++) frames.shift()(performance.now()); }
function start({ many = true, suffix = '', flushFrames = true, potion = false } = {}) {
  const ids = ['tt3-magic-lamp', 'tt3-treasure-hunt', 'tt3sp-bloodstorm'];
  if (potion) ids.push('tt3-iceheart-potion');
  if (many) ids.push(...catalog.filter(card => ['武术', '法术'].includes(card.type) && !ids.includes(card.id)).slice(0, 8).map(card => card.id));
  game = {
    ownedCards: ids.map(id => ({ uid: id + suffix, card: catalog.find(card => card.id === id) })),
    inventory: [], usedPocket: [], hp: 80, maxHp: 80, atk: 4, spellPower: 0, coins: 0,
    myClass: '法师', state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `persistent-foe-${i}`, name: `常驻舞台靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  if (flushFrames) flush();
}
function bodyFixture() {
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
}
beforeEach(() => {
  frames = []; onOverlay = null; observed.handStates.length = 0; vi.clearAllMocks();
  Random.reseed('battle-persistent-stage');
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  bodyFixture();
});
afterEach(() => {
  onOverlay = null; clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  flush(); frames = []; actions.clear();
  window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
  vi.restoreAllMocks();
});

function operations(run) {
  const templateWrites = [], outerReads = [], mountQueries = [];
  const inner = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  const outer = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
  const body = UI.el.ovBody, query = body.querySelector;
  const innerSpy = vi.spyOn(Element.prototype, 'innerHTML', 'set').mockImplementation(function(value) {
    if (this.tagName === 'TEMPLATE') templateWrites.push(String(value));
    return inner.set.call(this, value);
  });
  const outerSpy = vi.spyOn(Element.prototype, 'outerHTML', 'get').mockImplementation(function() {
    outerReads.push(this); return outer.get.call(this);
  });
  const querySpy = vi.spyOn(body, 'querySelector').mockImplementation(function(selector) {
    if (/data-unit-mount|^\.sts-hud > \.sts-hand-tools$|^\.bt-hand/.test(selector)) mountQueries.push(selector);
    return query.call(this, selector);
  });
  try { run(); } finally { innerSpy.mockRestore(); outerSpy.mockRestore(); querySpy.mockRestore(); }
  return { fullStageParses: templateWrites.filter(html => /class=["'][^"']*battle-stage/.test(html)).length,
    outerReads: outerReads.length, mountQueries };
}

describe('session-owned battle stage production contracts', () => {
  it('patches warm energy, HP and phase without whole-stage parse, outerHTML comparison or body-wide mount lookup', () => {
    start(); render();
    const scene = stage(), image = node('.battle-energy-emblem'), self = node('#btSelf'), hand = node('.sts-hand');
    const counters = operations(() => {
      set$energy(8); render();
      game.hp = 63; render();
      render({ ...snapshot(), phase: 'resolving', busy: true });
      render();
    });
    expect(counters).toEqual({ fullStageParses: 0, outerReads: 0, mountQueries: [] });
    expect(stage()).toBe(scene); expect(node('.battle-energy-emblem')).toBe(image);
    expect(node('#btSelf')).toBe(self); expect(node('.sts-hand')).toBe(hand);
    expect(node('.sts-energy b').textContent).toBe('8');
    expect(node('.sts-energy').getAttribute('aria-label')).toBe('能量 8，每回合 9');
  });

  it('does not write unchanged live HUD text, attributes or child lists', () => {
    // Paging acquisition feedback owns an existing unconditional ARIA setter;
    // keep that independent subsystem out of this stage-component assertion.
    start({ many: false }); render();
    const observer = new MutationObserver(() => {});
    for (const selector of ['.sts-topbar', '.sts-energy-wrap', '.sts-hud-l', '.sts-hud-r', '.sts-tactics', '.sts-hand-tools']) {
      observer.observe(node(selector), { subtree: true, childList: true, attributes: true, characterData: true });
    }
    try {
      render();
      expect(observer.takeRecords().map(record => `${record.type}:${record.target.nodeName}:${record.target.getAttribute?.('data-act') || ''}:${record.attributeName || ''}`).join('\n')).toBe('');
    } finally { observer.disconnect(); }
  });

  it('shares only safely acquired warm snapshots and refreshes after cold and restored host boundaries', () => {
    start(); render(); observed.snapshots = 0;
    render(); expect(observed.snapshots).toBe(1);
    const projected = { ...snapshot(), energy: 1 }; observed.snapshots = 0;
    render(projected); expect(observed.snapshots).toBe(1);
    expect(node('.sts-energy b').textContent).toBe('1'); expect(observed.handStates.at(-1).snapshot.energy).toBe(9);
    UI.showOverlay('cold', '<p>elsewhere</p>', 'settings'); observed.snapshots = 0;
    render(); expect(observed.snapshots).toBe(2);
    node('[data-act="btSettings"]').click(); observed.snapshots = 0;
    render(); expect(observed.snapshots).toBe(2);
    expect(stage().hasAttribute('inert')).toBe(false);
  });

  it('keeps expanded options, focus, runtime animation classes, energy artwork and unrelated HUD identities', () => {
    start();
    const scene = stage(), options = node('.sts-options'), summary = options.querySelector('summary');
    const image = node('.battle-energy-emblem'), piles = node('.sts-hud-r'), self = node('#btSelf');
    options.open = true; summary.focus(); scene.classList.add('fx-dread'); self.classList.add('fx-hit');
    render({ ...snapshot(), energy: 2, maxEnergy: 6, busy: true, phase: 'enemy', turn: 4 });
    expect(stage()).toBe(scene); expect(options.open).toBe(true); expect(document.activeElement).toBe(summary);
    expect(scene.classList.contains('fx-dread')).toBe(true); expect(self.classList.contains('fx-hit')).toBe(true);
    expect(node('.battle-energy-emblem')).toBe(image); expect(node('.sts-hud-r')).toBe(piles);
    expect(node('.sts-energy b').textContent).toBe('2'); expect(node('.sts-energy .battle-control-value > span').textContent).toBe('/6');
    expect(node('.sts-energy').getAttribute('aria-label')).toBe('能量 2，每回合 6');
    expect(node('.sts-energy').dataset.uiTipNote).toBe('回合开始恢复至 6 点');
    expect(node('.sts-encounter b').textContent).toBe('第 4 回合');
    expect(stage().dataset.phase).toBe('enemy'); expect(stage().classList.contains('phase-enemy')).toBe(true);
    expect(node('[data-act="btEnd"]').disabled).toBe(true); expect(node('[data-act="btFlee"]').disabled).toBe(true);
  });

  it('repairs controlled text, classes, ARIA and disabled state even with identical presentation inputs', () => {
    start(); const snap = snapshot(); render(snap);
    const energy = node('.sts-energy'), counter = energy.querySelector('b'), end = node('[data-act="btEnd"]');
    counter.textContent = 'wrong'; energy.setAttribute('aria-label', 'wrong'); energy.classList.remove('sts-energy');
    end.disabled = true; node('.sts-encounter b').textContent = 'wrong'; stage().dataset.phase = 'wrong';
    render(snap);
    expect(node('.sts-energy')).toBe(energy); expect(energy.querySelector('b')).toBe(counter);
    expect(counter.textContent).toBe('9'); expect(energy.getAttribute('aria-label')).toBe('能量 9，每回合 9');
    expect(end.disabled).toBe(false); expect(node('.sts-encounter b').textContent).toBe(`第 ${snap.turn} 回合`);
    expect(stage().dataset.phase).toBe('player'); expect(stage().classList.contains('phase-player')).toBe(true);
  });

  it('repairs owner-controlled root classes and button attributes without leaving duplicate damaged components', () => {
    start(); const rest = node('.sts-hud-r'), options = node('.sts-options'), end = node('[data-act="btEnd"]');
    rest.className = 'external-marker'; options.classList.remove('sts-options');
    end.removeAttribute('data-act'); end.setAttribute('role', 'link');
    render();
    expect(node('.sts-hud-r')).toBe(rest); expect(node('.sts-options')).toBe(options);
    expect(rest.classList.contains('external-marker')).toBe(true);
    expect(node('[data-act="btEnd"]')).toBe(end); expect(end.getAttribute('role')).toBeNull();
    expect(stage().querySelectorAll('.sts-hud-r')).toHaveLength(1); expect(stage().querySelectorAll('.sts-options')).toHaveLength(1);
  });

  it.each(['.sts-arena', '.sts-hud'])('repairs the class of the owned %s container without recreating scenery or mounts', selector => {
    start(); const original = node(selector), scene = stage(), self = node('#btSelf'), hand = node('.sts-hand');
    const scenery = node('.battle-scene-world'); original.className = 'external-marker';
    render();
    expect(stage()).toBe(scene); expect(node(selector)).toBe(original);
    expect(original.classList.contains('external-marker')).toBe(true);
    expect(node('#btSelf')).toBe(self); expect(node('.sts-hand')).toBe(hand); expect(node('.battle-scene-world')).toBe(scenery);
    expect(stage().querySelectorAll(selector)).toHaveLength(1);
  });

  it('repairs changed energy child structure and attributes without replacing surviving artwork', () => {
    start(); const wrap = node('.sts-energy-wrap'), energy = node('.sts-energy'), image = node('.battle-energy-emblem');
    energy.querySelector('b').replaceWith(document.createElement('i'));
    energy.querySelector('.battle-control-value > span').remove(); image.removeAttribute('alt'); image.removeAttribute('draggable');
    render();
    expect(node('.sts-energy-wrap')).toBe(wrap); expect(node('.sts-energy')).toBe(energy); expect(node('.battle-energy-emblem')).toBe(image);
    expect(energy.querySelector('b').textContent).toBe('9'); expect(energy.querySelector('.battle-control-value > span').textContent).toBe('/9');
    expect(energy.querySelector('i')).toBeNull(); expect(image.getAttribute('alt')).toBe(''); expect(image.draggable).toBe(false);
  });

  it('cold-repairs a displaced stage root before updating its unit and hand owners', () => {
    start(); const scene = stage(), extra = document.createElement('aside');
    UI.el.ovBody.prepend(extra); game.hp = 37; set$energy(4); render();
    expect(node('#btSelf .sts-hp span').textContent).toBe('37/80');
    expect(UI.el.ovBody.firstElementChild).toBe(stage());
    expect(stage()).not.toBe(scene); expect(extra.isConnected).toBe(false);
    expect(node('.sts-energy b').textContent).toBe('4');
    expect(node('.sts-hand .bt-card')).not.toBeNull();
  });

  it('removes the real previous phase class even if the public phase attribute was corrupted', () => {
    start(); stage().dataset.phase = 'wrong';
    render({ ...snapshot(), phase: 'enemy', busy: true });
    expect([...stage().classList].filter(name => name.startsWith('phase-'))).toEqual(['phase-enemy']);
    expect(stage().dataset.phase).toBe('enemy');
  });

  it.each(['.sts-energy-wrap', '.sts-hud-r', '.sts-tactics', '.sts-hand-tools'])('cold-repairs removed %s without losing the stage or unit/hand ownership', selector => {
    start();
    const scene = stage(), self = node('#btSelf'), hand = node('.sts-hand');
    node(selector).remove(); render();
    expect(stage()).toBe(scene); expect(node(selector)).not.toBeNull();
    expect(node('#btSelf')).toBe(self); expect(node('.sts-hand')).toBe(hand);
    expect(stage().querySelectorAll('.sts-hand-tools')).toHaveLength(1);
    expect(node('.sts-hand-tools').parentElement).toBe(self);
    expect(node('.sts-energy b').textContent).toBe('9'); expect(node('[data-act="btEnd"]').disabled).toBe(false);
  });

  it.each(['#btSelf', '[data-unit-mount="allies"]', '[data-unit-mount="foes"]', '.sts-hand'])('repairs an externally replaced %s mount and keeps later updates live', selector => {
    start(); const scene = stage(), old = node(selector), replacement = old.cloneNode(false);
    old.replaceWith(replacement); render();
    expect(stage()).toBe(scene); expect(node(selector)).not.toBeNull();
    expect(node('#btSelf .sts-figure')).not.toBeNull(); expect(stage().querySelectorAll('.bt-foe')).toHaveLength(2);
    expect(stage().querySelectorAll('.bt-card').length).toBeGreaterThan(0);
    game.hp = 51; set$energy(3); render();
    expect(node('.sts-energy b').textContent).toBe('3'); expect(node('#btSelf').textContent).toContain('51');
  });

  it('updates pile counts and forecast without replacing their persistent controls or transient animation classes', () => {
    start(); const snap = snapshot(), draw = node('[data-act="btDeck"]'), grave = node('[data-act="btGrave"]');
    const forecast = node('.bt-turn-forecast'); draw.classList.add('fx-pile-pulse');
    render({ ...snap, drawPile: snap.drawPile.slice(0, 5), consumedPile: snap.drawPile.slice(0, 3), player: { ...snap.player, hp: 1 } });
    expect(node('[data-act="btDeck"]')).toBe(draw); expect(node('[data-act="btGrave"]')).toBe(grave);
    expect(draw.querySelector('b').textContent).toBe('5'); expect(grave.querySelector('b').textContent).toBe('3');
    expect(draw.classList.contains('fx-pile-pulse')).toBe(true); expect(draw.getAttribute('aria-label')).toContain('5 张');
    expect(node('.bt-turn-forecast')).toBe(forecast); expect(forecast.textContent).not.toContain('余 78 生命');
    expect(forecast.classList.contains('lethal')).toBe(true);
  });

  it('keeps the timed flee confirmation armed across unrelated patches and restores its original label', () => {
    start(); vi.useFakeTimers();
    try {
      const flee = node('[data-act="btFlee"]'); flee.click();
      expect(flee.dataset.confirm).toBe('1'); expect(flee.textContent).toContain('确认撤离');
      set$energy(7); render();
      expect(node('[data-act="btFlee"]')).toBe(flee); expect(flee.dataset.confirm).toBe('1');
      expect(flee.classList.contains('arm')).toBe(true); expect(flee.textContent).toContain('确认撤离');
      vi.advanceTimersByTime(2600);
      expect(flee.dataset.confirm).toBeUndefined(); expect(flee.classList.contains('arm')).toBe(false);
      expect(flee.textContent).toContain('撤离（判负）'); expect(game.battleActive).toBe(true);
    } finally { vi.useRealTimers(); }
  });

  it('does not overwrite a newer synchronous render from showOverlay or bind stale controls', () => {
    start(); UI.showOverlay('cold', '<p>elsewhere</p>', 'settings');
    const stale = snapshot();
    onOverlay = () => { set$energy(4); game.hp = 45; render(); };
    render(stale);
    expect(node('.sts-energy b').textContent).toBe('4');
    expect(node('#btSelf .sts-hp span').textContent).toBe('45/80');
    expect(stage()._battleToken).toBe(snapshot().battleToken);
    expect(node('[data-act="btSlam"]').dataset.skillState).toBe('ready');
    expect(observed.handStates.at(-1).snapshot.energy).toBe(4);
  });

  it('cannot relabel or populate a newer battle when cold showOverlay starts a new epoch', () => {
    start(); const stale = snapshot(), oldToken = stale.battleToken;
    UI.showOverlay('cold', '<p>elsewhere</p>', 'settings');
    onOverlay = () => start({ many: false, suffix: '-new' });
    render(stale);
    const current = snapshot(); expect(current.battleToken).not.toBe(oldToken);
    expect(stage()._battleToken).toBe(current.battleToken);
    expect(node('[data-act="btHandPage"]')).toBeNull();
    expect([...stage().querySelectorAll('.bt-card')].map(card => card.dataset.uid).every(uid => current.hand.includes(uid))).toBe(true);
    expect(observed.handStates.at(-1).token).toBe(current.battleToken);
  });

  it.each(['opening', 'restoring'])('does not reinsert a departed stage after a %s modal host hook starts another battle', boundary => {
    start(); const old = stage();
    if (boundary === 'restoring') { BattleSession.commands.openGrave(); flush(); }
    onOverlay = () => start({ many: false, suffix: '-modal-new' });
    if (boundary === 'opening') BattleSession.commands.openGrave();
    else BattleSession.commands.closeGrave();
    flush();
    expect(stage()).not.toBe(old); expect(old.isConnected).toBe(false);
    expect(stage()._battleToken).toBe(snapshot().battleToken);
    expect(UI.el.ovBody.querySelectorAll('.battle-stage')).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('.battle-secondary-layer')).toBeNull();
    expect(stage().hasAttribute('inert')).toBe(false);
    expect([...stage().querySelectorAll('.bt-card')].every(card => snapshot().hand.includes(card.dataset.uid))).toBe(true);
  });

  it.each(['opening', 'restoring'])('rejects a departed scene immediately when a %s modal hook only queues a new battle', boundary => {
    start(); const old = stage(), oldToken = snapshot().battleToken;
    if (boundary === 'restoring') { BattleSession.commands.openGrave(); flush(); }
    onOverlay = () => start({ many: false, suffix: '-queued-new', flushFrames: false });
    if (boundary === 'opening') BattleSession.commands.openGrave();
    else BattleSession.commands.closeGrave();
    const pending = frames.shift(); expect(pending).toBeTypeOf('function'); pending(performance.now());
    expect(snapshot().battleToken).not.toBe(oldToken); expect(old.isConnected).toBe(false);
    expect(UI.el.ovBody.contains(old)).toBe(false);
    flush(); expect(stage()._battleToken).toBe(snapshot().battleToken);
    expect(UI.el.ovBody.querySelectorAll('.battle-stage')).toHaveLength(1);
  });

  it.each([false, true])('does not stamp a newer nonfloating decision with departed title/token (new battle: %s)', newBattle => {
    start(); const original = snapshot();
    const formation = { ...original, deckSelection: { selected: [], need: 1, max: 1, starterCount: 5,
      cards: game.ownedCards.slice(0, 1), boss: { id: 'boss-general', name: '编组靶子', hp: 100, atk: 1 } } };
    onOverlay = () => {
      if (newBattle) start({ many: false, suffix: '-decision-new' });
      render({ ...snapshot(), choosing: { cardName: '较新选择', options: ['保留较新页面'] } });
    };
    render(formation);
    const decision = UI.el.ovBody.querySelector('.battle-decision');
    expect(decision.dataset.decisionKind).toBe('choice'); expect(decision._decisionTitle).toContain('抉择');
    expect(decision._decisionTitle).not.toContain('编组牌库'); expect(decision._battleToken).toBe(snapshot().battleToken);
    expect(decision.textContent).toContain('较新选择');
  });

  it('does not repaint a page opened synchronously by the restored focus target', () => {
    start(); const scene = stage(), settings = node('[data-act="btSettings"]');
    settings.focus(); settings.click();
    settings.addEventListener('focus', () => UI.showOverlay('New page', '<p id="focus-navigation">Keep this page</p>', 'settings'), { once:true });
    const back = UI.el.ovBody.querySelector('[data-act="btSettingsBack"]');
    back.focus(); back.click();
    expect(UI.el.ovBody.querySelector('#focus-navigation')?.textContent).toBe('Keep this page');
    expect(scene.isConnected).toBe(false); expect(stage()).toBeNull();
    expect(UI._lastMode).toBe('settings');
  });

  it('rejects a stale public snapshot without invalidating the current battle modal guard', () => {
    start(); const stale = snapshot();
    start({ many: false, suffix: '-current' }); const current = stage(), currentToken = snapshot().battleToken;
    render(stale);
    expect(stage()).toBe(current); expect(current._battleToken).toBe(currentToken);
    node('[data-act="btSettings"]').click();
    expect(stage()).toBe(current); expect(current.isConnected).toBe(true);
    expect(UI.el.ovBody.querySelector('.battle-secondary-panel')).not.toBeNull();
    UI.el.ovBody.querySelector('[data-act="btSettingsBack"]').click();
    expect(stage()).toBe(current); expect(current.hasAttribute('inert')).toBe(false);
    expect(current._battleToken).toBe(currentToken);
  });

  it('reads the latest potion popup description from a retained current control', () => {
    start({ potion:true });
    const potion = snapshot().potionBar.find(p => p.uid === 'tt3-iceheart-potion');
    render({ ...snapshot(), potionBar: [{ ...potion, desc: '首个说明' }] });
    const button = node('.bt-potion');
    button.click();
    expect(node('.bt-potion-use-description').textContent).toBe('首个说明');
    render({ ...snapshot(), potionBar: [{ ...potion, desc: '最新说明' }] });
    expect(node('.bt-potion')).toBe(button);
    button.click();
    expect(node('.bt-potion-use-description').textContent).toBe('最新说明');
    expect(node('[data-potion-tip]')).toBeNull();
  });

  it('preserves the exact current potion popup through unchanged render without using the item', () => {
    start({ potion:true }); render();
    const before = snapshot(); node('.bt-potion').click();
    const popup = node('.bt-potion-use'), use = popup.querySelector('.bt-potion-use-confirm');
    use.focus(); render();
    expect(node('.bt-potion-use')).toBe(popup); expect(popup.isConnected).toBe(true);
    expect(document.activeElement).toBe(use);
    expect(snapshot().pendingItem).toBe(before.pendingItem);
    expect(snapshot().potionBar).toEqual(before.potionBar);
  });

  it('rejects cloned popup ownership and lets the retained source open a fresh current inspection', () => {
    start({ potion:true }); render(); node('.bt-potion').click();
    const source = node('.bt-potion'), popup = node('.bt-potion-use'), clone = popup.cloneNode(true);
    popup.replaceWith(clone); render();
    expect(node('.bt-potion')).toBe(source); expect(clone.isConnected).toBe(false);
    expect(node('.bt-potion-use')).toBeNull();
    source.click(); expect(node('.bt-potion-use')).not.toBe(popup);
    expect(node('.bt-potion-use').isConnected).toBe(true);
  });

  it('reacquires a replaced overlay body without retaining the departed stage owner', () => {
    start(); const oldStage = stage(), oldBody = UI.el.ovBody;
    bodyFixture(); render();
    expect(UI.el.ovBody).not.toBe(oldBody); expect(stage()).not.toBe(oldStage); expect(oldStage.isConnected).toBe(false);
    expect(stage()._battleToken).toBe(snapshot().battleToken); expect(node('.sts-energy b').textContent).toBe('9');
    set$energy(5); render(); expect(node('.sts-energy b').textContent).toBe('5');
    expect(stage().querySelectorAll('.sts-hand-tools')).toHaveLength(1);
  });

  it('captures equivalent HUD semantics across the complete synchronous field matrix', () => {
    start(); const base = snapshot(), originalClass = game.myClass;
    const serialize = element => ({
      tag: element.tagName.toLowerCase(),
      attributes: Object.fromEntries([...element.attributes]
        .filter(attribute => !/^data-(?:key-bound|aim-bound|use-bound|tip-bound)$/.test(attribute.name) && attribute.name !== 'style')
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(attribute => [attribute.name, attribute.name === 'class' ? attribute.value.split(/\s+/).filter(Boolean).sort().join(' ') : attribute.value])),
      text: [...element.childNodes].filter(child => child.nodeType === 3).map(child => child.textContent).join('').replace(/\s+/g, ''),
      children: [...element.children].map(serialize),
    });
    const samples = {};
    const capture = (name, value) => {
      render(value);
      samples[name] = { phase: stage().dataset.phase, state: stage().dataset.battleState,
        components: ['.sts-encounter', '.sts-options', '.sts-energy-wrap', '.sts-hud-l', '.sts-hud-r', '.sts-hand-tools', '.sts-tactics', '.bt-potions']
          .map(selector => ({ selector, tree: node(selector) ? serialize(node(selector)) : null })) };
      expect(node('.sts-energy b').textContent).toBe(String(value.energy));
    };
    capture('ready', base);
    capture('energy-max', { ...base, energy: 0, maxEnergy: 6 });
    capture('enemy', { ...base, energy: 3, turn: 4, busy: true, phase: 'enemy' });
    capture('resolving', { ...base, energy: 2, busy: true, phase: 'resolving' });
    capture('piles-lethal', { ...base, drawPile: base.drawPile.slice(0, 5), consumedPile: base.drawPile.slice(0, 3), player: { ...base.player, hp: 1 } });
    capture('potions', { ...base, potionBar: [
      { uid: 'potion-off', name: '不可用试剂', count: 2, usable: false, why: '限制', desc: '说明一' },
      { uid: 'potion-self', name: '回复试剂', count: 1, usable: true, desc: '说明二' },
      { uid: 'potion-enemy', name: '指向试剂', count: 3, usable: true, aim: 'enemy', desc: '说明三' },
    ] });
    capture('page-two', base); node('[data-act="btHandNext"]').click();
    samples['page-two'] = { ...samples['page-two'], page: node('.bt-hand-page').getAttribute('aria-label') };
    game.myClass = '牧师'; capture('priest', snapshot()); game.myClass = originalClass;
    const label = process.env.BATTLE_STAGE_SEMANTICS;
    if (['candidate', 'baseline'].includes(label)) writeFileSync(`${import.meta.dirname}/../out/battle-stage-semantics-${label}.json`, JSON.stringify(samples, null, 2));
  });

  it('passes live interaction state to hand-hit while a grave panel paints a masked background', () => {
    start(); observed.handStates.length = 0;
    BattleSession.commands.openGrave(); flush();
    expect(snapshot().viewingGrave).toBe(true);
    expect(stage().getAttribute('aria-hidden')).toBe('true');
    expect(observed.handStates.length).toBeGreaterThan(0);
    expect(observed.handStates.at(-1).snapshot.viewingGrave).toBe(true);
    BattleSession.commands.closeGrave(); flush();
    expect(observed.handStates.at(-1).snapshot.viewingGrave).toBe(false);
    expect(stage().hasAttribute('inert')).toBe(false);
  });
});
