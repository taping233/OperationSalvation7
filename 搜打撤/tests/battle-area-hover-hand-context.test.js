import { battleViewMocks, overlayElements, frameMocks, inventoryFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  ...frameMocks(),
}));
vi.mock('../game/src/battle/view/battle.anim.view.js', async importOriginal => ({
  ...(await importOriginal()), animateBattleTransition: () => ({ flightMs:0 }),
}));
vi.mock('../game/src/ui/ui-scale.js', async importOriginal => ({ ...(await importOriginal()), scale: () => 1, viewport: () => ({ width: 1920, height: 1080 }) }));
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = { el: {}, _lastMode: null, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
  showOverlay(_title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 99, 99, 0, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, findCard } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const { showFoePreview } = await import('../game/src/battle/view/battle.hover.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const areaCard = i => ({ id: `hover-context-${i}`, name: `群体招式${i}`, type: '法术', cost: 1, dmg: 3, dmgType: 'spell', desc: '',
  rules: { version: 1, battle: { target: { side: 'enemy', area: true } }, triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'allEnemies' }] } } });
let frames, frameId, clock, game, hit;
const stage = () => document.querySelector('.battle-stage');
const foeNodes = () => [...document.querySelectorAll('.bt-foe[data-eidx]')];
const previews = () => foeNodes().map(node => node.querySelector('.bt-fpreview')?.textContent || '');
const step = () => { clock += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(clock)); };
function pointer(type, x = 800, y = 700) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: 1 }); return event;
}
function enter() { hit = stage(); window.dispatchEvent(pointer('pointermove')); step(); }
function leave() { hit = document.querySelector('.sts-hud'); window.dispatchEvent(pointer('pointermove')); step(); }
function begin() {
  const card = document.querySelector('.bt-card[data-uid="u0"]');
  expect(card).not.toBeNull();
  const rect = () => ({ left: 200, top: 800, width: 220, height: 300 });
  card.getBoundingClientRect = rect; card.parentElement.getBoundingClientRect = rect;
  Aim.startAim(pointer('pointerdown', 320, 950), card);
  expect(Aim.aim?.uid).toBe('u0');
}
function restore(count = 9, first = areaCard(0), overrides = {}) {
  const ownedCards = Array.from({ length: count }, (_, i) => ({ uid: `u${i}`, card: i ? areaCard(i) : first }));
  game = { ownedCards, ...inventoryFields(99, 99, 0, '战士'), log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  window.SDT.game = game;
  expect(BattleSession.restore(game, {
    opts: { isBoss: false, name: '群体悬停检查' }, mode: 'normal', turn: 1, maxEnergy: 99, energy: 99,
    hand: ownedCards.map(entry => entry.uid), drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
    pdef: { shield: 0, armor: 0, guard: false }, pstat: { status: {} },
    foes: Array.from({ length: 4 }, (_, i) => ({ id: `hover-foe-${i}`, name: `敌人${i}`, hp: 30, maxHp: 30, atk: 1,
      dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } })),
    delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [], ...overrides,
  })).toBe(true);
  render(); step(); step();
  return first;
}
function measure(action) {
  let uidReads = 0;
  game.ownedCards.forEach((entry, i) => Object.defineProperty(entry, 'uid', {
    configurable: true, enumerable: true, get() { uidReads++; return `u${i}`; },
  }));
  const projection = vi.spyOn(Runtime.hand, 'map');
  try {
    action();
    const handProjection = projection.mock.results.filter(result => Array.isArray(result.value)
      && result.value.length > 0 && result.value.every(entry => entry && typeof entry === 'object'
        && 'uid' in entry && 'card' in entry)).length;
    return { uidReads, handProjection };
  } finally {
    projection.mockRestore();
    game.ownedCards.forEach((entry, i) => Object.defineProperty(entry, 'uid', { configurable: true, enumerable: true, writable: true, value: `u${i}` }));
  }
}
beforeEach(() => {
  frames = new Map(); frameId = 0; clock = 0; hit = null;
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: () => () => {} }));
  document.elementFromPoint = () => hit;
  localStorage.setItem('sdt-intent-legend', '1');
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { ...overlayElements() };
  UI._lastMode = null;
  UI.el.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1920, height: 1080 });
  UI.el.overlay.setPointerCapture = () => {}; UI.el.overlay.hasPointerCapture = () => true; UI.el.overlay.releasePointerCapture = () => {};
});
afterEach(() => {
  Aim.cancelAim(); Aim.cancelClickSelection(); clearFeedback();
  if (game?.battleActive) commands.flee();
  for (let i = 0; i < 100 && frames.size; i++) step();
  UI.hideOverlay(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it.each([9, 30, 60])('one real empty-field pointer hover resolves %i raw hand entries once, not per target', count => {
  restore(count); begin();
  const before = BattleSession.serialize();
  const counts = measure(enter);
  expect(previews()).toHaveLength(4);
  previews().forEach(text => { expect(text).toContain('直接伤害：3'); expect(text).toContain('松手打出'); });
  expect(BattleSession.serialize()).toEqual(before);
  // Owned UID reads include the non-shared per-target preview/availability lookups.
  expect(counts.uidReads).toBe(count * (count + 1) / 2 + 28);
  expect(counts.handProjection).toBe(1);
  expect(measure(step).uidReads).toBe(0); // No new transition: no batch at all.
  leave();
  expect(measure(enter)).toEqual(counts); // A new entry materializes a new projection, even without a state edit.
  if (count === 9) {
    const dragged = Aim.aim.el; render(); expect(Aim.aim?.el).toBe(dragged);
    expect(measure(enter)).toEqual(counts); // Renderer-preserved aim still starts a new batch.
  }
});

it('uses the current catalog 风暴火球 with unchanged damage, cost and play wording', () => {
  const card = structuredClone(Cards.all().find(entry => entry.id === 'tt3-flame-storm'));
  restore(9, card); begin();
  const counts = measure(enter);
  previews().forEach(text => { expect(text).toContain('直接伤害：4'); expect(text).toContain('费2'); expect(text).toContain('松手打出'); });
  expect(counts.uidReads).toBe(73);
  expect(counts.handProjection).toBe(1);
});

it('new pointer entries see changed hand, raw overrides, requirements, energy and target death', () => {
  const card = restore(); begin(); enter();
  card.rules.battle.requirements = [{ kind: 'handCards', count: 8, type: '法术' }];
  leave(); enter(); previews().forEach(text => expect(text).toContain('松手打出'));
  Runtime.hand.pop(); leave(); enter();
  previews().forEach(text => { expect(text).toContain('当前无法打出'); expect(text).toContain('现有 7 张'); });
  Runtime.hand.push('u8');
  Runtime.cardOverrides.set('u8', { ...areaCard(8), type: '武术' }); leave(); enter();
  previews().forEach(text => expect(text).toContain('现有 7 张'));
  Runtime.cardOverrides.delete('u8'); card.rules.battle.requirements[0].count = 9; leave(); enter();
  previews().forEach(text => expect(text).toContain('现有 8 张'));
  card.rules.battle.requirements = []; Runtime.set$energy(0); Runtime.foes[1].dead = true; leave(); enter();
  expect(previews()[1]).toBe('');
  previews().filter(Boolean).forEach(text => expect(text).toContain('能量不足'));
  Runtime.set$energy(99); leave(); enter();
  previews().filter(Boolean).forEach(text => expect(text).toContain('松手打出'));
  // Cancelling and grabbing again must not retain any old hand projection either.
  Aim.cancelAim(); Runtime.hand.splice(0, 1); render();
  expect(Aim.aim).toBeNull();
  expect(commands.getCardPlayAvailability('u0', 0).reason.code).toBe('NOT_IN_HAND');
});

it('real renderer refresh discards the hover batch and keeps fresh target/self modifiers', () => {
  restore(); begin(); enter();
  const dragged = Aim.aim.el;
  game.spellPower = 2; Runtime.foes[0].defense.shield = 2; Runtime.foes[1].status.immune = 1;
  Runtime.foes[2].status.dodge = 1; Runtime.foes[3].dead = true;
  render();
  expect(Aim.aim?.el).toBe(dragged);
  enter();
  expect(previews()[0]).toContain('直接伤害：3'); expect(previews()[0]).toContain('护盾 2→0');
  expect(previews()[1]).toContain('直接伤害：0'); expect(previews()[2]).toContain('直接伤害：0');
  expect(previews()[2]).toContain('闪避'); expect(previews()[3]).toBe('');
  Runtime.hand.pop(); render(); expect(Aim.aim).toBeNull();
});

it('standalone preview calls and final pointer release recheck the live hand instead of using the last batch', () => {
  const card = restore(); begin(); enter();
  card.rules.battle.requirements = [{ kind: 'handCards', count: 8, type: '法术' }];
  Runtime.hand.pop();
  showFoePreview(foeNodes()[0], 0, 'u0', card, 'click');
  expect(previews()[0]).toContain('现有 7 张');
  Runtime.hand.push('u8'); showFoePreview(foeNodes()[0], 0, 'u0', card, 'click');
  expect(previews()[0]).toContain('点击该敌人打出');
  Runtime.hand.pop();
  const before = BattleSession.serialize();
  window.dispatchEvent(pointer('pointerup'));
  expect(BattleSession.serialize()).toEqual(before);
  expect(BattleSession.getSnapshot().hand).toContain('u0');
  expect(document.querySelector('.bt-thought-bubble')?.textContent).toContain('现有 7 张');
});

it('fresh batch uses replacement card identity and does not survive a new battle token', () => {
  restore(); begin(); enter();
  const replacement = areaCard(0);
  replacement.rules.battle.requirements = [{ kind: 'handCards', count: 9, type: '法术' }];
  Runtime.cardOverrides.set('u0', replacement); leave(); enter();
  previews().forEach(text => expect(text).toContain('现有 8 张'));
  expect(findCard('u0').card).toBe(replacement);
  const token = BattleSession.getSnapshot().battleToken;
  restore(); expect(BattleSession.getSnapshot().battleToken).not.toBe(token);
  step(); expect(Aim.aim).toBeNull();
  begin(); enter(); previews().forEach(text => expect(text).toContain('松手打出'));
});

function readingSurface(kind) {
  const host = document.createElement('div');
  const surfaces = {
    status: '<div class="status-chip-list"><span class="status-chip"><i>状态</i></span></div>',
    summary: '<span class="status-chip-summary"><i>2项</i></span>',
    term: '<span data-term="poison"><i>中毒</i></span>',
    dynamic: '<span data-ui-tip data-ui-tip-text="状态说明"><i>说明</i></span>',
    skill: '<div class="battle-skill-help"><i>职业说明</i></div>',
    tooltip: '<aside class="term-tip"><i>词条正文</i></aside>',
  };
  host.innerHTML = surfaces[kind];
  (kind === 'tooltip' ? document.body : foeNodes()[0]).append(host);
  return host.querySelector('i');
}
function pickupForClick(area) {
  const card = areaCard(0);
  if (!area) {
    card.rules.battle.target.area = false;
    card.rules.triggers.onPlay[0].target = 'chosenEnemy';
  }
  restore(1, card); begin();
  expect(Aim.aim.playBlockedReason).toBe('');
  // Release over the hand, then enter the playfield: the real pickup switches
  // to click confirmation rather than submitting this initial release.
  hit = document.querySelector('.sts-hand');
  window.dispatchEvent(pointer('pointerup', 320, 950));
  hit = foeNodes()[0];
  window.dispatchEvent(pointer('pointermove', 800, 450)); step();
  expect(Aim.aim?.targetMode).toBe('click');
}

it.each([true, false])('keeps an already picked %s-area card while reading status and tooltip surfaces', async area => {
  pickupForClick(area);
  const before = BattleSession.serialize(), held = Aim.aim;
  for (const kind of ['status', 'summary', 'term', 'dynamic', 'skill', 'tooltip']) {
    const surface = readingSurface(kind);
    hit = surface;
    surface.dispatchEvent(pointer('pointermove', 800, 450)); step();
    expect(Aim.aim?.hover, kind).toBeNull();
    surface.dispatchEvent(pointer('pointerdown', 800, 450));
    surface.dispatchEvent(pointer('pointerup', 800, 450));
    surface.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, detail:1, clientX:800, clientY:450 }));
    expect(Aim.aim === held, kind).toBe(true);
    expect(BattleSession.serialize(), kind).toEqual(before);
    surface.parentElement.parentElement.remove();
  }
  // The next intentional target click is still accepted.
  hit = foeNodes()[0];
  hit.dispatchEvent(pointer('pointerdown', 800, 450));
  hit.dispatchEvent(pointer('pointerup', 800, 450));
  expect(Aim.aim).toBeNull();
  await vi.waitFor(() => expect(BattleSession.getSnapshot().hand).not.toContain('u0'));
});

it.each([true, false])('does not turn a %s-area reading press into a play when released over an enemy', area => {
  pickupForClick(area);
  const before = BattleSession.serialize(), held = Aim.aim;
  const surface = readingSurface('status');
  hit = surface;
  surface.dispatchEvent(pointer('pointerdown', 800, 450));
  hit = foeNodes()[0];
  hit.dispatchEvent(pointer('pointermove', 800, 450)); step();
  hit.dispatchEvent(pointer('pointerup', 800, 450));
  expect(Aim.aim === held).toBe(true);
  expect(BattleSession.serialize()).toEqual(before);
});

it.each([true, false])('keeps a %s-area drag release over a status reading surface from submitting', area => {
  const card = areaCard(0);
  if (!area) {
    card.rules.battle.target.area = false;
    card.rules.triggers.onPlay[0].target = 'chosenEnemy';
  }
  restore(1, card); begin();
  const before = BattleSession.serialize(), held = Aim.aim;
  const surface = readingSurface('status');
  hit = surface;
  // Pointer capture retargets the event to overlay; geometric hit testing must
  // still detect the reading surface underneath that captured pointer.
  UI.el.overlay.dispatchEvent(pointer('pointermove', 800, 450)); step();
  UI.el.overlay.dispatchEvent(pointer('pointerup', 800, 450));
  expect(Aim.aim === held).toBe(true);
  expect(Aim.aim?.leftDown).toBe(false);
  expect(Aim.aim?.targetMode).toBe('click');
  expect(BattleSession.serialize()).toEqual(before);
});
