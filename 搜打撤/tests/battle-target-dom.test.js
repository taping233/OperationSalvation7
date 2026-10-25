import { battleViewMocks, overlayElements, frameMocks, inventoryFields, mountBattleRoot } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  ...frameMocks(),
}));
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _lastMode: null, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 9, 99, 5, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
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
async function start(entry = Cards.SHA) {
  game = {
    ownedCards: [{ uid: 'target-card', card: structuredClone(entry) }],
    ...inventoryFields(60, 80, 1, '法师'), log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, Array.from({ length: 3 }, (_, i) => ({ id: `target-${i}`, name: `训练靶${i}`, hp: 120, atk: 3 })), { isBoss: false });
  await settle();
  return BattleSession.getSnapshot();
}
function observe(nodes) {
  const observer = new MutationObserver(() => {});
  nodes.forEach(node => observer.observe(node, { attributes: true, attributeOldValue: true }));
  return { records: () => observer.takeRecords(), close: () => observer.disconnect() };
}
beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  mountBattleRoot();
  UI.el = { ...overlayElements() };
  UI._lastMode = null;
});
afterEach(async () => {
  Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) { commands.flee(); await settle(); }
  UI.hideOverlay(); frames = []; Element.prototype.animate = originalAnimate; vi.restoreAllMocks();
});

it('leaves enabled target attributes untouched across 20 real battle renders', async () => {
  await start(); Aim.selectCardByClick('target-card', false, { autoSingleTarget: false }); render();
  const kept = foes(), before = BattleSession.getSnapshot(), observer = observe(kept);
  expect(kept).toHaveLength(3);
  kept.forEach(node => expect(node.classList.contains('can-target')).toBe(true));
  const calls = kept.map(node => ({ set: vi.spyOn(node, 'setAttribute'), remove: vi.spyOn(node, 'removeAttribute'),
    tab: vi.spyOn(node, 'tabIndex', 'set'), toggle: vi.spyOn(node.classList, 'toggle') }));
  for (let i = 0; i < 20; i++) render();
  const records = observer.records(); observer.close();
  const counts = { renders: 20, enabledFoes: kept.length, attributeMutations: records.length,
    targetAttributeWrites: calls.reduce((sum, call) => sum + call.set.mock.calls.filter(([name]) => ['role', 'aria-label'].includes(name)).length + call.tab.mock.calls.length, 0),
    canTargetToggleCalls: calls.reduce((sum, call) => sum + call.toggle.mock.calls.filter(([name]) => name === 'can-target').length, 0) };
  console.info('BATTLE_TARGET_DOM_COUNTS', JSON.stringify(counts));
  expect(records).toHaveLength(0);
  expect(counts.targetAttributeWrites).toBe(0);
  expect(counts.canTargetToggleCalls).toBe(0);
  expect(foes()).toEqual(kept);
  expect(BattleSession.getSnapshot()).toEqual(before);
  kept.forEach((node, i) => {
    expect(node.getAttribute('role')).toBe('button'); expect(node.tabIndex).toBe(0);
    expect(node.getAttribute('aria-label')).toBe(`训练靶${i}，按 Enter 确认目标`);
  });
});

it('updates a renamed selected foe and clears a dead target without caching eligibility', async () => {
  await start(); Aim.selectCardByClick('target-card', false, { autoSingleTarget: false }); render();
  const kept = foes(), current = BattleSession.getSnapshot(), snap = { ...current, foes: [...current.foes] }, observer = observe(kept);
  snap.foes[0] = { ...snap.foes[0], name: '改名后的训练靶' };
  render(snap);
  const renamed = observer.records();
  expect(renamed.map(record => [record.target, record.attributeName])).toEqual([[kept[0], 'aria-label']]);
  expect(kept[0].getAttribute('aria-label')).toBe('改名后的训练靶，按 Enter 确认目标');
  snap.foes[0] = { ...snap.foes[0], dead: true, hp: 0 }; render(snap);
  expect(kept[0].classList.contains('can-target')).toBe(false);
  expect(kept[0].hasAttribute('role')).toBe(false); expect(kept[0].hasAttribute('tabindex')).toBe(false);
  expect(kept[0].getAttribute('aria-label')).toBe('改名后的训练靶，已倒下');
  expect(kept[1].classList.contains('can-target')).toBe(true);
  snap.foes[0] = { ...snap.foes[0], dead: false, hp: 120 }; render(snap);
  expect(foes()).toEqual(kept); expect(kept[0].getAttribute('role')).toBe('button');
  expect(kept[0].getAttribute('tabindex')).toBe('0');
  expect(kept[0].getAttribute('aria-label')).toBe('改名后的训练靶，按 Enter 确认目标');
  observer.close();
});

it('repairs current DOM attributes rather than trusting a previous enabled-state signature', () => {
  const node = document.createElement('div');
  node.className = 'bt-foe unrelated'; node.setAttribute('aria-describedby', 'details');
  Aim.setTargetable(node, true, '第一目标');
  node.classList.remove('can-target'); node.setAttribute('role', 'group');
  node.tabIndex = -1; node.setAttribute('aria-label', '外部旧标签');
  Aim.setTargetable(node, true, '第二目标');
  expect(node.className).toBe('bt-foe unrelated can-target');
  expect(node.getAttribute('role')).toBe('button'); expect(node.getAttribute('tabindex')).toBe('0');
  expect(node.getAttribute('aria-label')).toBe('第二目标');
  expect(node.getAttribute('aria-describedby')).toBe('details');
  Aim.setTargetable(node, false, '不应保留');
  expect(node.className).toBe('bt-foe unrelated');
  for (const name of ['role', 'tabindex', 'aria-label']) expect(node.hasAttribute(name)).toBe(false);
  expect(node.getAttribute('aria-describedby')).toBe('details');
  const remove = vi.spyOn(node, 'removeAttribute'), toggle = vi.spyOn(node.classList, 'toggle');
  for (let i = 0; i < 20; i++) Aim.setTargetable(node, false, '不应保留');
  expect(remove).not.toHaveBeenCalled(); expect(toggle).not.toHaveBeenCalled();
  expect(() => Aim.setTargetable(null, true, '不存在')).not.toThrow();
});

it('retains explicit tabindex and label coercion on a fresh naturally-focusable target', () => {
  const node = document.createElement('button');
  expect(node.tabIndex).toBe(0); expect(node.hasAttribute('tabindex')).toBe(false);
  Aim.setTargetable(node, true, undefined);
  expect(node.getAttribute('tabindex')).toBe('0'); expect(node.getAttribute('aria-label')).toBe('undefined');
  Aim.setTargetable(node, true, null);
  expect(node.getAttribute('aria-label')).toBe('null');
});

it('still cancels and submits a freshly validated target after repeated renders', async () => {
  await start(); Aim.selectCardByClick('target-card', false, { autoSingleTarget: false });
  for (let i = 0; i < 5; i++) render();
  expect(Aim.cancelClickSelection()).toBe(true);
  foes().forEach(node => {
    expect(node.classList.contains('can-target')).toBe(false);
    expect(node.hasAttribute('role')).toBe(false); expect(node.hasAttribute('tabindex')).toBe(false);
    expect(node.hasAttribute('aria-label')).toBe(false);
  });
  render(); expect(foes()[0].getAttribute('aria-label')).toBe('训练靶0，敌方单位');
  Aim.selectCardByClick('target-card', false, { autoSingleTarget: false });
  const before = BattleSession.getSnapshot();
  foes()[1].focus();
  for (let i = 0; i < 5; i++) render();
  expect(document.activeElement).toBe(foes()[1]);
  foes()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await settle();
  const after = BattleSession.getSnapshot();
  expect(after.foes[1].hp).toBeLessThan(before.foes[1].hp);
  expect(after.foes[0].hp).toBe(before.foes[0].hp);
  expect(after.energy).toBeLessThan(before.energy);
  expect(after.hand).not.toContain('target-card');
});

it('refreshes the selected self label when character identity changes', async () => {
  await start(Cards.all().find(card => card.id === 'tt3-bandage'));
  Aim.selectCardByClick('target-card', false, { autoSingleTarget: false }); render();
  const node = document.getElementById('btSelf');
  expect(node.classList.contains('can-target')).toBe(true);
  const current = BattleSession.getSnapshot();
  const snapshot = { ...current, player: { ...current.player, characterId: 'xingyue' } };
  render(snapshot);
  expect(document.getElementById('btSelf')).toBe(node);
  expect(node.getAttribute('aria-label')).toBe('星月，自己，按 Enter 确认目标');
  const observer = observe([node]);
  for (let i = 0; i < 10; i++) render(snapshot);
  expect(observer.records()).toHaveLength(0); observer.close();
});
