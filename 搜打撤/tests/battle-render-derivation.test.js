import { battleViewMocks, overlayElements } from './helpers/environment-fixtures.js';
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
// 本文件验输入，资源就绪由 battle-entry-readiness 专门控制未兑现的加载 Promise 验证。
vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({ createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }), waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }) }));

const derivations = vi.hoisted(() => ({ cost: 0, effective: 0 }));
vi.mock('../game/src/battle/core/battle.core.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, effCostOf: (...args) => { derivations.cost++; return actual.effCostOf(...args); },
    findEffectiveCard: (...args) => { derivations.effective++; return actual.findEffectiveCard(...args); } };
});
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const actions = new Map();
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  showCardZoom: vi.fn(),
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 9, 99, 5, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { set$energy, set$turn } = await import('../game/src/battle/runtime/battle.runtime.session.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
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
function start(count = 1, entry = Cards.SHA, extra = [], myClass = null) {
  game = {
    ownedCards: [{ uid: 'inspect-card', card: entry }, ...extra], inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass, state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd(opts) { this.lastBattleSummary = opts.battleSummary; },
  };
  window.SDT.game = game;
  BattleSession.start(game, Array.isArray(count) ? count : Array.from({ length: count }, (_, i) => ({ id: `foe-${i}`, name: `敌人${i}`, hp: 40, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(async () => {
  // 拖拽松手后的 300ms click 吞噬是生产交互窗口；各用例不共享该手势。
  if (Date.now() - Aim.aimPlayedAt < 300) await new Promise(resolve => setTimeout(resolve, 310));
  frames = []; UI.showCardZoom.mockClear();
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { ...overlayElements() };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});

it('compares real mixed combat inputs without keeping derived rules across renders', async () => {
  const spell = i => ({ id: `derive-${i}`, name: `法术${i}`, type: '法术', cost: 1, rarity: '古朴', desc: '造成1点伤害', dmg: 1, dmgType: 'spell' });
  start(2, spell(0), Array.from({length:8}, (_, i) => ({uid:`extra-${i}`,card:spell(i+1)})));
  derivations.cost = 0; derivations.effective = 0;
  const checkpoints = [];
  const totals = {cost:0, effective:0};
  // Measure one fresh synchronous render at each real input boundary. Queued
  // animation paints can coalesce differently under machine load, so exclude them.
  const checkpoint = label => {
    flush(); derivations.cost = 0; derivations.effective = 0; render();
    totals.cost += derivations.cost; totals.effective += derivations.effective;
    checkpoints.push({label, ...derivations});
  };
  render(); checkpoint('ready');
  set$energy(0); render(); checkpoint('energy-zero');
  expect(card().dataset.handState).toBe('blocked');
  expect(card().getAttribute('aria-label')).toContain('能量不足');
  set$energy(9); render(); checkpoint('energy-restored');
  card().click(); checkpoint('target-selection');
  expect(Aim.clickSelectedUid).toBe('inspect-card');
  Aim.cancelClickSelection(); render(); checkpoint('cancel-selection');
  BattleSession.commands.playCard('inspect-card', 0); await settle(); checkpoint('play');
  expect(BattleSession.getSnapshot().hand).not.toContain('inspect-card');
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(39);
  BattleSession.commands.openGrave(); flush(); checkpoint('open-pile');
  BattleSession.commands.closeGrave(); flush(); checkpoint('close-pile');
  const turn = BattleSession.getSnapshot().turn;
  BattleSession.commands.endTurn(); await settle(); checkpoint('next-turn');
  expect(BattleSession.getSnapshot().turn).toBe(turn + 1);
  set$turn(turn + 2);
  const { cardOverrides } = await import('../game/src/battle/runtime/battle.runtime.piles.js');
  cardOverrides.set('extra-0', {...game.ownedCards[1].card, cost:3}); render(); await settle(); checkpoint('live-card-replacement');
  expect(document.querySelector('[data-uid="extra-0"].bt-card').getAttribute('aria-label')).toContain('3 费');
  expect(stage().textContent).toContain(`第 ${turn + 2} 回合`);
  if (process.env.BATTLE_DERIVATION_BASELINE !== '1') {
    expect(checkpoints[0]).toEqual({label:'ready',cost:10,effective:9});
    expect(totals.cost).toBeLessThanOrEqual(110);
    expect(totals.effective).toBeLessThanOrEqual(90);
  }
  console.log('BATTLE_DERIVATION_MIXED', JSON.stringify({checkpoints, totals}));
});
