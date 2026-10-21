import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}), play() {},
  setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
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
const { BattleSession, commands } = await import('../game/src/battle/core/battle.core.js');
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
const self = () => document.getElementById('btSelf');
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
    ownedCards: [{ uid: 'unit-bandage', card: structuredClone(catalog.find(card => card.id === 'tt3-bandage')) }],
    inventory: [], usedPocket: [], hp: 60, maxHp: 80, atk: 4, spellPower: 1, coins: 0, myClass: '法师',
    state: 'idle', battleActive: false, log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'unit-target', name: '训练靶', hp: 120, atk: 3 }], { isBoss: false });
  await settle();
  const snapshot = BattleSession.getSnapshot();
  return { ...snapshot, equipped: [], allies: [], pdef: { ...snapshot.pdef, armor: 2 }, foes: Array.from({ length: 4 }, (_, i) => ({
    ...snapshot.foes[0], id: `unit-target-${i}`, name: `训练靶${i}`, status: {},
  })) };
}
function paint(snapshot, ctx = {}) {
  updateUnits(mountUnitLayer(UI.el.ovBody, snapshot.battleToken), snapshot, ctx);
}
function observeUnits() {
  const observer = new MutationObserver(() => {});
  observer.observe(UI.el.ovBody.querySelector('.sts-arena'), { attributes: true, childList: true, subtree: true });
  return { records: () => observer.takeRecords(), close: () => observer.disconnect() };
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

it('avoids repeated self and foe metadata mutations in 100 warm production updates', async () => {
  const snapshot = await start(); paint(snapshot);
  const kept = [self(), ...foes()], observer = observeUnits();
  for (let i = 0; i < 100; i++) paint(snapshot);
  const records = observer.records(); observer.close();
  const targeted = records.filter(record => !(record.type === 'attributes' && record.attributeName === 'aria-label' && kept.includes(record.target)));
  console.info('BATTLE_UNIT_METADATA_COUNTS', JSON.stringify({ updates: 100, foes: 4, allMutations: records.length, guardedMetadataMutations: targeted.length }));
  expect(targeted).toHaveLength(0);
  expect(records).toHaveLength(1000); // Existing targeting clear/reapply remains unchanged.
  expect([self(), ...foes()]).toEqual(kept);
});

it('avoids repeated CSS and hidden/text setter calls at the guarded sites', async () => {
  const snapshot = await start(); paint(snapshot);
  const armor = self().querySelector('.sts-hp-armor');
  const guarded = [vi.spyOn(foeMount().style, 'setProperty'), ...foes().map(el => vi.spyOn(el.style, 'setProperty')),
    vi.spyOn(armor, 'hidden', 'set'), vi.spyOn(armor, 'textContent', 'set'),
    vi.spyOn(self().querySelector('.sts-equips').style, 'display', 'set'),
    ...foes().map(el => vi.spyOn(el.querySelector('.sts-intent').style, 'display', 'set'))];
  for (let i = 0; i < 10; i++) paint(snapshot);
  console.info('BATTLE_UNIT_SETTER_COUNTS', JSON.stringify({ updates: 10, guardedCalls: guarded.map(spy => spy.mock.calls.length) }));
  guarded.forEach(spy => expect(spy).not.toHaveBeenCalled());
});

it('updates armor visibility, text and labels without stale HP or character identity', async () => {
  const snapshot = await start(); paint(snapshot);
  const kept = self(), armor = kept.querySelector('.sts-hp-armor');
  snapshot.player = { ...snapshot.player, hp: 27, characterId: 'xingyue' };
  snapshot.pdef.armor = 0; paint(snapshot);
  expect(self()).toBe(kept); expect(armor.hidden).toBe(true);
  expect(armor.textContent).toBe('甲 0'); expect(armor.getAttribute('aria-label')).toBe('护甲 0');
  expect(kept.querySelector('.sts-hp span').textContent).toBe('27/80');
  expect(kept.querySelector('.sts-figure').getAttribute('aria-label')).toBe('星月');
  snapshot.pdef.armor = 7; paint(snapshot);
  expect(armor.hidden).toBe(false); expect(armor.textContent).toBe('甲 7');
  expect(armor.getAttribute('aria-label')).toBe('护甲 7');
});

it('updates foe names, intent damage, status and death while retaining slots', async () => {
  const snapshot = await start(); paint(snapshot);
  const kept = foes(), first = kept[0], intent = first.querySelector('.sts-intent');
  snapshot.foes[0].name = '新名称'; snapshot.foes[0].atk = 9;
  snapshot.pstat = { ...snapshot.pstat, status: { bleed: 2 } }; paint(snapshot);
  expect(foes()[0]).toBe(first);
  expect(first.querySelector('.sts-figure').getAttribute('aria-label')).toBe('新名称');
  expect(intent.getAttribute('aria-label')).toContain('11');
  snapshot.foes[0].status.freeze = 2; paint(snapshot);
  expect(intent.getAttribute('aria-label')).toContain('冰冻'); expect(first.classList.contains('fx-frozen')).toBe(true);
  snapshot.foes[0].dead = true; snapshot.foes[0].hp = 0; paint(snapshot);
  expect(intent.style.display).toBe('none'); expect(first.getAttribute('aria-label')).toContain('已倒下');
  snapshot.foes[0].dead = false; snapshot.foes[0].hp = 14; snapshot.foes[0].status.freeze = 0; paint(snapshot);
  expect(intent.style.display).toBe(''); expect(first.classList.contains('fx-frozen')).toBe(false);
  expect(first.querySelector('.sts-hp span').textContent).toBe('14/120');
});

it('updates count, index, idle phase and affix title after reordering and removal', async () => {
  const snapshot = await start(); paint(snapshot);
  const kept = foes(); snapshot.foes = [...snapshot.foes].reverse(); snapshot.foes[0].affix = 'frenzy'; paint(snapshot);
  const reordered = foes(); expect(reordered).toEqual([...kept].reverse());
  reordered.forEach((el, i) => {
    expect(el.dataset.eidx).toBe(String(i)); expect(el.dataset.foeId).toBe(snapshot.foes[i].id);
    expect(el.style.getPropertyValue('--foe-idle-phase')).toBe(`${-(i * 0.61)}s`);
  });
  expect(reordered[0].title).not.toBe('');
  snapshot.foes = [snapshot.foes[0]]; paint(snapshot);
  expect(foeMount().dataset.count).toBe('1'); expect(foeMount().style.getPropertyValue('--battle-foe-count')).toBe('1');
  snapshot.foes[0].affix = null; paint(snapshot); expect(foes()[0].title).toBe('');
  snapshot.foes = []; paint(snapshot); expect(foes()).toHaveLength(0);
  expect(foeMount().dataset.count).toBe('0'); expect(foeMount().style.getPropertyValue('--battle-foe-count')).toBe('1');
});

it('keeps self and enemy target transitions and disabled labels live', async () => {
  const snapshot = await start(); paint(snapshot);
  paint(snapshot, { pendingTarget: { uid: 'unit-bandage' } });
  expect(self().classList.contains('can-target')).toBe(true); expect(self().getAttribute('role')).toBe('button');
  paint(snapshot, { slamPending: true });
  expect(self().classList.contains('can-target')).toBe(false); expect(self().hasAttribute('role')).toBe(false);
  foes().forEach(el => { expect(el.classList.contains('can-target')).toBe(true); expect(el.tabIndex).toBe(0); });
  snapshot.foes[0].dead = true; paint(snapshot, { dartPending: true });
  expect(foes()[0].classList.contains('can-target')).toBe(false);
  expect(foes()[0].getAttribute('aria-label')).toContain('已倒下');
  paint(snapshot); foes().forEach(el => expect(el.hasAttribute('role')).toBe(false));
});

it('toggles equipment visibility and preserves busy/used descriptions', async () => {
  const snapshot = await start(); paint(snapshot);
  const equipment = self().querySelector('.sts-equips'); expect(equipment.style.display).toBe('none');
  snapshot.equipped = [{ uid: 'meta-equip', name: '测试装备', desc: '说明', skill: '治疗' }]; paint(snapshot);
  expect(equipment.style.display).toBe(''); expect(equipment.querySelector('button').disabled).toBe(false);
  snapshot.busy = true; paint(snapshot); expect(equipment.querySelector('button').disabled).toBe(true);
  snapshot.equipped = []; paint(snapshot); expect(equipment.style.display).toBe('none');
});

it('repairs live DOM metadata, text and styles even when the snapshot is unchanged', async () => {
  const snapshot = await start(); paint(snapshot); paint(snapshot);
  const expected = UI.el.ovBody.querySelector('.sts-arena').outerHTML;
  const figure = self().querySelector('.sts-figure'), armor = self().querySelector('.sts-hp-armor');
  figure.setAttribute('role', 'stale'); figure.setAttribute('aria-label', 'stale');
  armor.hidden = true; armor.textContent = 'stale'; armor.setAttribute('aria-label', 'stale');
  self().querySelector('.sts-equips').style.display = '';
  foeMount().dataset.count = '99'; foeMount().style.setProperty('--battle-foe-count', '99');
  foes().forEach(el => {
    el.dataset.foeId = 'stale'; el.dataset.eidx = '99'; el.title = 'stale'; el.style.setProperty('--foe-idle-phase', '99s');
    el.querySelector('.sts-figure').setAttribute('role', 'stale'); el.querySelector('.sts-figure').setAttribute('aria-label', 'stale');
    el.querySelector('.sts-intent').setAttribute('aria-label', 'stale'); el.querySelector('.sts-intent').style.display = 'none';
  });
  paint(snapshot); expect(UI.el.ovBody.querySelector('.sts-arena').outerHTML).toBe(expected);
});

it('retains native string conversion for null and undefined foe names', async () => {
  const snapshot = await start(); paint(snapshot);
  for (const name of [null, undefined, 0, '']) {
    snapshot.foes[0].name = name; paint(snapshot);
    expect(foes()[0].querySelector('.sts-figure').getAttribute('aria-label')).toBe(String(name));
    expect(foes()[0].dataset.foeId).toBe(snapshot.foes[0].id);
  }
  snapshot.foes[0].id = null; snapshot.foes[0].name = undefined; paint(snapshot);
  expect(foes()[0].dataset.foeId).toBe('undefined');
});
