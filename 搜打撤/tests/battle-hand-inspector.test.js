import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// 本文件验输入，资源就绪由 battle-entry-readiness 专门控制未兑现的加载 Promise 验证。
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
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
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { closeHandInspector, syncHandInspector } = await import('../game/src/battle/view/battle.hand-inspector.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
const panel = () => document.querySelector('.bt-hand-detail');
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const card = () => UI.el.ovBody.querySelector('.sts-hand .bt-card');
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    const s = BattleSession.getSnapshot();
    if (!s.busy && !s.actionQueueLength) { flush(); return; }
  }
  throw new Error('战斗动作没有收口');
}
function start(count = 1, entry = Cards.SHA, extra = []) {
  game = {
    ownedCards: [{ uid: 'inspect-card', card: entry }, ...extra], inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, Array.from({ length: count }, (_, i) => ({ id: `foe-${i}`, name: `敌人${i}`, hp: 40, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(async () => {
  // 拖拽松手后的 300ms click 吞噬是生产交互窗口；各用例不共享该手势。
  if (Date.now() - Aim.aimPlayedAt < 300) await new Promise(resolve => setTimeout(resolve, 310));
  frames = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  closeHandInspector({ restoreFocus: false }); Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});

it.each([1, 2])('clicking with %s enemies only inspects; explicit use still requires target confirmation', async count => {
  start(count);
  const before = BattleSession.getSnapshot();
  card().click();
  expect(panel()?.getAttribute('aria-modal')).toBe('true');
  expect(panel().querySelector('.hs-card.lg')).not.toBeNull();
  expect(stage().inert).toBe(true);
  expect(BattleSession.getSnapshot().energy).toBe(before.energy);
  expect(BattleSession.getSnapshot().hand).toEqual(before.hand);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  panel().querySelector('.bt-hand-detail-use').click();
  expect(panel()).toBeNull(); expect(stage().inert).toBe(false);
  expect(Aim.clickSelectedUid).toBe('inspect-card');
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  UI.el.ovBody.querySelector('.bt-foe[data-eidx="0"]').click();
  await settle();
  expect(BattleSession.getSnapshot().foes[0].hp).toBeLessThan(40);
});

it('keeps untargeted cards read-only until explicit use, and a repeated old confirmation cannot spend twice', async () => {
  start(1, { id: 'inspect-coins', name: '金币试验牌', type: '法术', rarity: '古朴', cost: 1, desc: '获得 3 金币。',
    rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [{ op: 'coins', n: 3 }] } } });
  card().click(); expect(game.coins).toBe(0);
  const use = panel().querySelector('.bt-hand-detail-use'); use.click(); use.click();
  await settle();
  expect(game.coins).toBe(3);
  expect(BattleSession.getSnapshot().energy).toBe(8);
});

it('opens from number/Enter keys, traps focus and blocks combat hotkeys until Escape restores the hand', () => {
  start(); card().focus();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', isComposing: true, bubbles: true }));
  card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
  expect(panel()).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
  expect(panel()).not.toBeNull();
  const use = panel().querySelector('.bt-hand-detail-use'); use.focus();
  use.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(panel().querySelector('.bt-hand-detail-close'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
  expect(Aim.clickSelectedUid).toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }));
  expect(panel()).not.toBeNull();
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  expect(panel()).toBeNull(); expect(stage().inert).toBe(false); expect(document.activeElement).toBe(card());
  card().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  expect(panel()).not.toBeNull(); expect(BattleSession.getSnapshot().energy).toBe(9);
});

it('keeps nine hand identities and stable corner controls while rerendering the battlefield', () => {
  const distinct = Array.from({ length: 8 }, (_, i) => ({ id: `layout-card-${i}`,
    name: `第${i + 1}张完整手牌`, type: '武术', cost: 1, desc: '造成 4 点物理伤害。', dmg: 4, dmgType: 'physical' }));
  start(2, Cards.SHA, distinct.map((entry, i) => ({ uid: `nine-${i}`, card: entry })));
  const hand = stage().querySelector('.sts-hand');
  expect(hand.querySelectorAll('.bt-hand-identity')).toHaveLength(9);
  for (const entry of distinct) expect(hand.textContent).toContain(entry.name);
  expect(stage().querySelector('.sts-topbar .sts-options')).not.toBeNull();
  expect(stage().querySelector('.sts-hud .sts-hud-l')).not.toBeNull();
  expect(stage().querySelector('.sts-hud .sts-hud-r')).not.toBeNull();
  const previous = stage();
  render();
  expect(stage()).toBe(previous);
  expect(stage().querySelector('.sts-hand')).toBe(hand);
  expect(stage().querySelectorAll('[data-act="btEnd"]')).toHaveLength(1);
  expect(stage().querySelectorAll('[data-act="btSettings"]')).toHaveLength(1);
});

it('opens on a pointer tap without movement and suppresses the following synthetic click', () => {
  start();
  expect([...stage().querySelectorAll('.bt-card')].map(node => node.dataset.uid)).toEqual(['inspect-card']);
  const down = new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 20, clientY: 600 });
  Object.defineProperty(down, 'pointerId', { value: 1 }); card().dispatchEvent(down);
  expect(Aim.aim?.uid).toBe('inspect-card');
  const up = new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 20, clientY: 600 });
  Object.defineProperty(up, 'pointerId', { value: 1 }); window.dispatchEvent(up);
  expect(panel()).not.toBeNull(); card().click();
  expect(document.querySelectorAll('.bt-hand-detail')).toHaveLength(1);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
});

it('keeps unavailable cards readable and prevents stale confirmations after a battle switch', () => {
  start(); set$energy(0); render(); card().click();
  expect(panel().querySelector('.bt-hand-detail-use').disabled).toBe(true);
  expect(panel().textContent).toContain('能量不足');
  closeHandInspector(); set$energy(9); render(); card().click();
  const oldStage = stage(), oldUse = panel().querySelector('.bt-hand-detail-use');
  start(); oldUse.click();
  expect(panel()).toBeNull(); expect(oldStage.inert).toBe(false);
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(40);
  card().click();
  const currentPanel = panel(); oldUse.click();
  expect(panel()).toBe(currentPanel);
  expect(Aim.clickSelectedUid).toBeNull();
  stage().remove(); syncHandInspector();
  expect(panel()).toBeNull();
});

it('removes the inspector and restores inert state when the whole overlay is hidden', async () => {
  start(); card().click();
  const oldStage = stage();
  UI.el.overlay.hidden = true;
  await Promise.resolve();
  expect(panel()).toBeNull();
  expect(oldStage.inert).toBe(false);
});

it('inspects infusion cards and materials before either entering or changing the selection', () => {
  start(1, { id: 'inspect-infuse', name: '注能护体', type: '法术', cost: 1, infuse: 1, desc: '注能(1)：获得 6 点护盾。' }, [{ uid: 'inspect-fuel', card: Cards.SHA }]);
  UI.el.ovBody.querySelector('.bt-card[data-uid="inspect-card"]').click();
  expect(BattleSession.getSnapshot().infusing).toBeNull();
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  UI.el.ovBody.querySelector('.bt-card[data-uid="inspect-fuel"]').click();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual([]);
  expect(panel().querySelector('.bt-hand-detail-use').textContent).toBe('选作注能材料');
  panel().querySelector('.bt-hand-detail-use').click(); flush();
  expect(BattleSession.getSnapshot().infusing.picked).toEqual(['inspect-fuel']);
  expect(BattleSession.getSnapshot().energy).toBe(9);
  expect(BattleSession.getSnapshot().hand).toContain('inspect-fuel');
});
