// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, hideTooltip() {}, refresh() {}, log() {}, showTooltip() {},
  act: (name, callback) => actions.set(name, callback),
  showOverlay(title, html, mode) {
    this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
  },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, Icons: { rich, img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { mountHandLayer, updateHand } = await import('../game/src/battle/view/battle.layers.js');
const { groupHandCards, orderHandGroups } = await import('../game/src/battle/core/battle.hand.js');
const { renderInfusionSelection } = await import('../game/src/battle/view/battle.infusion-view.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { render } = await import('../game/src/battle/view/battle.view.js');

let frames, game;
beforeEach(() => {
  frames = []; actions.clear();
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"><div class="battle-stage"><div class="sts-hud"><div class="sts-hand"></div></div></div></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI._lastMode = null;
});
afterEach(() => {
  document.dispatchEvent(new Event('sdt-overlay-close'));
  if (game?.battleActive) BattleSession.commands.flee();
  game = null; actions.clear(); vi.restoreAllMocks();
});

function infusionPage() {
  const main = { ...Cards.all().find(card => card.id === 'tt3sp-bloodstorm') };
  const entries = [{ uid: 'main', card: main }, { uid: 'a', card: Cards.SHA }, { uid: 'b', card: Cards.SHA }];
  const snapshot = { battleToken: 42, hand: entries.map(entry => entry.uid), foes: [], phase: 'player', busy: false,
    infusing: { uid: 'main', card: main, need: 2, picked: [] } };
  const getSnapshot = vi.fn(() => snapshot);
  const commands = { selectInfusion: vi.fn(uid => {
    const index = snapshot.infusing.picked.indexOf(uid);
    if (index < 0) snapshot.infusing.picked.push(uid); else snapshot.infusing.picked.splice(index, 1);
  }), cancelInfusion: vi.fn(), playDirect: vi.fn(), confirmInfusion: vi.fn() };
  const draw = () => renderInfusionSelection({ UI, snapshot, getSnapshot,
    findCard: uid => entries.find(entry => entry.uid === uid), infusionFuelReason: () => '',
    effCostOf: card => card.cost, targetSide: () => 'enemy', commands,
    cardHTML: card => `<div class="hs-card"><div class="hsc-desc">${card.desc}</div></div>`,
    showBattleDecision(title, body) {
      UI.el.ovBody.innerHTML = `<section class="battle-decision battle-secondary-panel" data-decision-kind="infusion">${body}</section>`;
      document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'discover' }));
    },
  });
  draw(); getSnapshot.mockClear();
  return { snapshot, getSnapshot, commands, draw };
}
const key = value => document.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));

describe('battle page input and DOM work', () => {
  it('does not capture a battle snapshot for unrelated infusion keys', () => {
    const { getSnapshot, commands } = infusionPage();
    for (const value of ['Tab', 'a', 'ArrowLeft', 'Shift']) key(value);
    expect(getSnapshot).not.toHaveBeenCalled();
    expect(commands.selectInfusion).not.toHaveBeenCalled();
  });

  it('shares one fresh snapshot per material shortcut and sees in-place changes before repaint', () => {
    const { getSnapshot, commands, snapshot } = infusionPage();
    key('1'); key('1'); key('1');
    expect(commands.selectInfusion.mock.calls).toEqual([['a'], ['b'], ['a']]);
    expect(snapshot.infusing.picked).toEqual(['b']);
    expect(getSnapshot).toHaveBeenCalledTimes(3);
    snapshot.busy = true; key('1');
    expect(commands.selectInfusion).toHaveBeenCalledTimes(3);
    snapshot.busy = false; getSnapshot.mockReturnValue({ ...snapshot, battleToken: 43 }); key('1');
    expect(commands.selectInfusion).toHaveBeenCalledTimes(3);
  });

  it('checks confirmation and pointer adjustments once and blocks zoom/hidden inputs', () => {
    const { getSnapshot, commands, snapshot } = infusionPage();
    actions.get('btInfuseAdd')({ i: '0' });
    actions.get('btInfuseAdd')({ i: '0' });
    actions.get('btInfuseGo')();
    expect(commands.confirmInfusion).toHaveBeenCalledOnce();
    expect(getSnapshot).toHaveBeenCalledTimes(3);
    snapshot.infusing.picked.pop(); actions.get('btInfuseGo')();
    expect(commands.confirmInfusion).toHaveBeenCalledOnce();
    getSnapshot.mockClear();
    UI.el.overlay.appendChild(Object.assign(document.createElement('div'), { id: 'cardZoom' }));
    key('1'); actions.get('btInfuseAdd')({ i: '0' });
    expect(getSnapshot).not.toHaveBeenCalled();
    document.getElementById('cardZoom').remove(); UI.el.overlay.hidden = true;
    key('1'); expect(getSnapshot).not.toHaveBeenCalled();
  });

  it.each(['sdt-overlay-mode', 'sdt-overlay-close'])('releases the active infusion key listener on %s', event => {
    const add = vi.spyOn(document, 'addEventListener'), remove = vi.spyOn(document, 'removeEventListener');
    const { commands, getSnapshot } = infusionPage();
    const listener = add.mock.calls.find(call => call[0] === 'keydown' && call[2] === true)[1];
    document.dispatchEvent(new Event(event));
    expect(remove).toHaveBeenCalledWith('keydown', listener, true);
    key('1'); expect(commands.selectInfusion).not.toHaveBeenCalled(); expect(getSnapshot).not.toHaveBeenCalled();
  });

  it('re-rendering infusion owns exactly one live keyboard handler', () => {
    const { draw, commands, getSnapshot } = infusionPage();
    draw(); draw(); getSnapshot.mockClear(); key('1');
    expect(commands.selectInfusion).toHaveBeenCalledExactlyOnceWith('a');
    expect(getSnapshot).toHaveBeenCalledOnce();
  });

  it('measures stable nine-stack hand writes and infusion snapshot traversals', () => {
    const { snapshot, groups, layer } = handPage(9);
    const observer = new MutationObserver(() => {});
    observer.observe(layer, { attributes: true, childList: true, subtree: true });
    for (let i = 0; i < 20; i++) updateHand(snapshot, null, groups, [], { mode: 'encounter', spellBonus: 0 });
    const handWrites = observer.takeRecords().length; observer.disconnect();
    const infusion = infusionPage();
    for (let i = 0; i < 20; i++) key('a');
    const unrelatedSnapshots = infusion.getSnapshot.mock.calls.length;
    infusion.getSnapshot.mockClear(); key('1');
    const materialSnapshots = infusion.getSnapshot.mock.calls.length;
    console.log('BATTLE_PAGE_PERF', JSON.stringify({ repeats: 20, groups: 9, handWrites, unrelatedSnapshots, materialSnapshots }));
    if (process.env.BATTLE_PAGE_PERF_BASELINE !== '1') {
      expect(handWrites).toBe(0); expect(unrelatedSnapshots).toBe(0); expect(materialSnapshots).toBe(1);
    }
  });

  it('measures discovery readiness commits without changing its 350 ms admission window', () => {
    let time = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    const { snapshot } = handPage(2);
    for (const callback of frames.splice(0)) callback(time);
    render({ ...snapshot, discovering: { act: 'hand', n: 1, options: game.ownedCards.map(entry => entry.card) } });
    const panel = UI.el.ovBody.querySelector('[data-battle-discover]');
    expect(panel.getAttribute('aria-busy')).toBe('true');
    const observer = new MutationObserver(() => {});
    observer.observe(UI.el.ovBody.querySelector('.battle-decision'), { attributes: true, childList: true, subtree: true });
    for (let i = 1; i <= 20; i++) {
      time = 1000 + i * 10;
      for (const callback of frames.splice(0)) callback(time);
    }
    const openingWrites = observer.takeRecords().length;
    expect(panel.getAttribute('aria-busy')).toBe('true');
    time = 1351; for (const callback of frames.splice(0)) callback(time);
    const readyWrites = observer.takeRecords().length; observer.disconnect();
    expect(panel.getAttribute('aria-busy')).toBe('false');
    expect([...panel.querySelectorAll('[data-act="btDiscover"]')].every(button => !button.hasAttribute('aria-disabled'))).toBe(true);
    expect(UI.el.ovBody.querySelector('.battle-discover-progress').textContent).toContain('剩余');
    console.log('BATTLE_DISCOVER_PERF', JSON.stringify({ openingFrames: 20, candidates: 2, openingWrites, readyWrites }));
    if (process.env.BATTLE_PAGE_PERF_BASELINE !== '1') expect(openingWrites).toBe(0);
  });

  it('updates live cost, content, order and external attribute changes after an unchanged hand render', () => {
    const { snapshot, groups, layer } = handPage(2);
    const liveState = { ...snapshot };
    const card = layer.querySelector('.bt-card'), face = card.querySelector('.hs-card');
    const oldFace = face;
    updateHand(snapshot, null, groups, [], { mode: 'encounter', spellBonus: 0 });
    expect(card.querySelector('.hs-card')).toBe(oldFace);
    card.setAttribute('aria-label', 'external'); face.setAttribute('aria-disabled', 'true');
    layer.querySelector('.bt-slot').style.setProperty('--fx', '999px');
    updateHand(snapshot, null, groups, [], { mode: 'encounter', spellBonus: 0 });
    expect(card.getAttribute('aria-label')).not.toBe('external');
    expect(face.getAttribute('aria-disabled')).toBe('false');
    expect(layer.querySelector('.bt-slot').style.getPropertyValue('--fx')).not.toBe('999px');
    liveState.energy = 0;
    groups[0].card = { ...groups[0].card, desc: '更新后的完整规则' };
    updateHand(liveState, null, groups, [], { mode: 'encounter', spellBonus: 0 });
    expect(card.dataset.handState).toBe('blocked'); expect(card.dataset.blockReason).toContain('能量不足');
    expect(card.textContent).toContain('更新后的完整规则');
    expect(card.querySelector('.hs-card').getAttribute('aria-disabled')).toBe('true');
    liveState.energy = 9;
    updateHand(liveState, null, groups.slice().reverse(), [], { mode: 'encounter', spellBonus: 0 });
    expect(layer.querySelector('.bt-slot').dataset.uid).toBe('hand-1');
    expect(card.hasAttribute('data-block-reason')).toBe(false);
  });
});

function handPage(count) {
  game = { ownedCards: Array.from({ length: count }, (_, i) => ({ uid: `hand-${i}`,
    card: { id: `page-perf-${i}`, name: `性能测试${i}`, type: '法术', cost: 1, rarity: '古朴', desc: '造成1点伤害', dmg: 1, dmgType: 'spell' } })),
    inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0, myClass: null,
    state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {} };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'target', name: '靶子', hp: 100, atk: 1 }], { isBoss: false });
  const snapshot = BattleSession.getSnapshot();
  const entries = game.ownedCards.filter(entry => snapshot.hand.includes(entry.uid));
  const groups = orderHandGroups(groupHandCards(entries)).map((group, i) => ({ ...group, displayIndex: i }));
  const layer = mountHandLayer(UI.el.ovBody, '', snapshot.battleToken, () => {});
  updateHand(snapshot, null, groups, [], { mode: 'encounter', spellBonus: 0 });
  return { snapshot, groups, layer };
}
