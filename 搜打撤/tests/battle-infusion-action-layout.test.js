import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
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
const { render } = await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { forecastEnemyTurn } = await import('../game/src/battle/view/battle.turn-forecast.js');
const { renderCombatPiles } = await import('../game/src/battle/view/battle.piles.view.js');
const battleRuntime = await import('../game/src/battle/runtime/battle.runtime.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const bar = () => stage().querySelector(':scope > .bt-infuse');
const snapshot = () => BattleSession.getSnapshot();
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!snapshot().busy && !snapshot().actionQueueLength) { flush(); return; }
  }
  throw new Error('Infusion action did not settle');
}
function start({ name = '血蝠风暴', potion = false } = {}) {
  const infusion = { ...Cards.all().find(card => card.id === 'tt3sp-bloodstorm'), name };
  game = {
    ownedCards: [
      { uid: 'infusion', card: infusion }, { uid: 'fuel-a', card: Cards.SHA }, { uid: 'fuel-b', card: Cards.SHA },
      ...(potion ? [{ uid: 'potion', card: Cards.all().find(card => card.id === 'tt3-iceheart-potion') }] : []),
    ],
    inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log: vi.fn(), heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `foe-${i}`, name: `靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(() => {
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
  clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});

describe('shared infusion action bar', () => {
  it('groups all copy separately from the three original actions and explains the real material cost', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    expect([...bar().children].map(node => node.className)).toEqual(['bt-infuse-copy', 'bt-infuse-actions']);
    expect([...bar().childNodes].filter(node => node.nodeType === 3 && node.textContent.trim())).toHaveLength(0);
    expect(bar().querySelector('.bt-infuse-copy').textContent).toContain('选择 2 张手牌作材料');
    expect(bar().querySelector('.bt-infuse-copy').textContent).toContain('已选 0/2');
    expect(bar().textContent).toContain('材料战后进消耗区，道具、装备不可在火堆复原');
    expect(bar().textContent).not.toContain('才能打出');
    expect([...bar().querySelectorAll('.bt-infuse-actions button')].map(button => button.dataset.act)).toEqual(['btInfuseDirect', 'btInfuseGo', 'btInfuseCancel']);
    expect(bar().querySelector('[data-act="btInfuseDirect"]').dataset.uid).toBe('infusion');
  });

  it('updates exact material counts and preserves the disabled, cancel and reentry paths', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    const before = snapshot();
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    BattleSession.commands.selectInfusion('fuel-a'); flush();
    expect(bar().textContent).toContain('已选 1/2');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    BattleSession.commands.selectInfusion('fuel-b'); flush();
    expect(bar().textContent).toContain('已选 2/2');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(false);
    bar().querySelector('[data-act="btInfuseCancel"]').click(); flush();
    expect(bar()).toBeNull(); expect(snapshot().infusing).toBeNull();
    expect(snapshot().energy).toBe(before.energy); expect(snapshot().hand).toEqual(before.hand);
    BattleSession.commands.beginInfusion('infusion'); flush();
    expect(bar().textContent).toContain('已选 0/2');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
  });

  it('still dispatches direct play without consuming the selected materials', async () => {
    start(); BattleSession.commands.beginInfusion('infusion'); BattleSession.commands.selectInfusion('fuel-a'); flush();
    bar().querySelector('[data-act="btInfuseDirect"]').click(); flush();
    expect(snapshot().pendingTarget.uid).toBe('infusion'); expect(snapshot().energy).toBe(9);
    stage().querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
    expect(snapshot().infusing).toBeNull(); expect(bar()).toBeNull();
    expect(snapshot().hand).toEqual(expect.arrayContaining(['fuel-a', 'fuel-b']));
    expect(snapshot().hand).not.toContain('infusion'); expect(snapshot().energy).toBe(7);
  });

  it('still confirms the selected materials and spends them only after target confirmation', async () => {
    start(); BattleSession.commands.beginInfusion('infusion');
    BattleSession.commands.selectInfusion('fuel-a'); BattleSession.commands.selectInfusion('fuel-b'); flush();
    bar().querySelector('[data-act="btInfuseGo"]').click(); flush();
    expect(snapshot().pendingTarget.uid).toBe('infusion');
    expect(snapshot().hand).toEqual(expect.arrayContaining(['fuel-a', 'fuel-b']));
    stage().querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
    expect(snapshot().hand).not.toContain('fuel-a'); expect(snapshot().hand).not.toContain('fuel-b');
    expect(snapshot().energy).toBe(7); expect(bar()).toBeNull();
    expect(game.log).toHaveBeenCalledWith(expect.stringContaining('战后进消耗区；道具、装备不可在火堆复原'), 'sys');
  });

  it('escapes long card names and keeps counters correct through an ordinary rerender', () => {
    const name = '<img src=x onerror=alert(1)>很长的注能规则牌名';
    start({ name }); BattleSession.commands.beginInfusion('infusion'); flush();
    render();
    expect(bar().querySelector('.bt-infuse-title').textContent).toContain(name);
    expect(bar().querySelector('.bt-infuse-copy img')).toBeNull();
    expect(bar().querySelectorAll('[data-act="btInfuseCancel"]')).toHaveLength(1);
  });

  it('uses the same two groups for targeted items and preserves cancellation without spending the item', () => {
    start({ potion: true }); BattleSession.commands.usePotion('potion'); flush();
    expect(bar().classList.contains('bt-pick')).toBe(true);
    expect(bar().querySelector('.bt-infuse-copy').textContent).toContain('点击一名敌人');
    expect(bar().querySelectorAll('.bt-infuse-actions button')).toHaveLength(1);
    bar().querySelector('[data-act="btPickCancel"]').click(); flush();
    expect(snapshot().pendingItem).toBeNull(); expect(bar()).toBeNull();
    expect(game.ownedCards.some(entry => entry.uid === 'potion')).toBe(true);
  });

  it('hides the whole potion rail only during infusion and restores it after cancellation', () => {
    const selector = '#overlay .battle-stage.sts:has(>.bt-infuse:not(.bt-pick))>.bt-potions';
    const style = document.createElement('style');
    postcss.parse(readFileSync('game/css/battle-stage.css', 'utf8')).walkRules(rule => {
      if (rule.selector === selector) style.textContent = rule.toString();
    });
    expect(style.textContent).toContain('display:none'); document.head.appendChild(style);
    const potions = () => stage().querySelector(':scope > .bt-potions');
    try {
      start({ potion: true }); expect(window.getComputedStyle(potions()).display).not.toBe('none');
      BattleSession.commands.beginInfusion('infusion'); flush();
      expect(window.getComputedStyle(potions()).display).toBe('none');
      bar().querySelector('[data-act="btInfuseCancel"]').click(); flush();
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
      BattleSession.commands.usePotion('potion'); flush();
      expect(bar().classList.contains('bt-pick')).toBe(true);
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
      bar().querySelector('[data-act="btPickCancel"]').click(); flush();
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
    } finally { style.remove(); }
  });
});

describe('visible forecast uncertainty', () => {
  it('labels the unchanged damage as an estimate and always shows the excluded actions', () => {
    start();
    const before = snapshot(), expected = forecastEnemyTurn(before);
    expect(before.allies).toHaveLength(0);
    render();
    const forecast = stage().querySelector('.bt-turn-forecast');
    expect(forecast.querySelector('.bt-forecast-damage').textContent).toBe(`估算承伤 ${expected.damage}`);
    expect(forecast.querySelector('.bt-forecast-hp>b').textContent).toBe(String(expected.hpAfter));
    expect(forecast.querySelector('.bt-forecast-note').textContent).toBe('未计随从攻击与回合末触发');
    expect(forecast.querySelector('.bt-forecast-note').hidden).toBe(false);
    expect(forecast.title).toBe(expected.note); expect(forecast.classList.contains('lethal')).toBe(expected.lethal);
    expect(snapshot()).toEqual(before);
  });

  it('keeps possible-death language and the same estimate in the confirmation dialog', () => {
    start(); game.hp = 1; render();
    const expected = forecastEnemyTurn(snapshot()); expect(expected.lethal).toBe(true);
    stage().querySelector('[data-act="btEnd"]').click();
    expect(UI.el.ovBody.textContent).toContain(`估算承伤 ${expected.damage}`);
    expect(UI.el.ovBody.textContent).not.toContain('预计承伤');
    expect(UI.el.ovBody.querySelector('.battle-decision-head h3').textContent).toBe('回合结束可能致死');
    expect(UI.el.ovBody.querySelector('[data-act="btRiskBack"]')).not.toBeNull();
    expect(UI.el.ovBody.querySelector('[data-act="btRiskContinue"]')).not.toBeNull();
    UI.el.ovBody.querySelector('[data-act="btRiskBack"]').click();
    expect(stage().querySelector('.bt-forecast-warning').textContent).toBe('可能致死');
    expect(game.hp).toBe(1);
  });
});

describe('infusion reading and nonshrinking CSS contract', () => {
  const css = postcss.parse(readFileSync('game/css/battle-stage.css', 'utf8'));
  function declarations(selector) {
    const found = {};
    css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { found[decl.prop] = decl.value; }); });
    return found;
  }
  const prefix = '#overlay .battle-stage.sts';
  it('keeps the shared bar below the top header with wrapping copy and a separate action group', () => {
    expect(declarations(`${prefix}>.bt-infuse`)).toMatchObject({ top: '112px', left: '56px', right: '56px', display: 'flex', 'flex-wrap': 'wrap', 'font-size': '20px' });
    expect(declarations(`${prefix} .bt-infuse-copy`)).toMatchObject({ flex: '1 1 720px', 'min-width': '0', display: 'grid', 'overflow-wrap': 'anywhere' });
    expect(declarations(`${prefix} .bt-infuse-actions`)).toMatchObject({ flex: '0 0 auto', display: 'flex', 'flex-wrap': 'wrap', 'max-width': '100%' });
  });
  it('gives every action a readable minimum hit size and prevents vertical word wrapping or flex crushing', () => {
    expect(declarations(`${prefix} .bt-infuse-actions .mini-btn`)).toMatchObject({ flex: '0 0 auto', 'min-width': '96px', 'min-height': '48px', 'white-space': 'nowrap', margin: '0', font: '600 20px/1.3 var(--font-ui,sans-serif)' });
    expect(declarations(`${prefix} .bt-infuse-actions .mini-btn:disabled`)).toMatchObject({ opacity: '1', cursor: 'default' });
  });
  it('keeps the forecast limitation readable in the existing auto-sized tactics column', () => {
    expect(declarations(`${prefix} .bt-forecast-note`)).toMatchObject({ display: 'block', 'font-size': '18px', 'font-weight': '400', 'line-height': '1.4' });
    expect(declarations(`${prefix} .sts-tactics`)).toMatchObject({ 'grid-row': '3', 'align-self': 'end' });
  });
});


describe('discovery source presentation and restoration copy', () => {
  const showDiscover = (options, deckBottomUids = null) => render({ ...snapshot(), discovering: {
    options, n: 1, act: null, ...(deckBottomUids ? { deckBottom: true, deckBottomUids } : {}),
  } });
  it('projects both owned and temporary deck-bottom UIDs without changing cards or discovery state', () => {
    start(); battleRuntime.set$shaTransform('不朽斩');
    battleRuntime.granted.push({ uid: 'source-temp', card: { ...Cards.SHA } });
    const options = [{ ...Cards.SHA }, { ...Cards.SHA }];
    const beforeOptions = JSON.stringify(options), beforeOwned = JSON.stringify(game.ownedCards), before = snapshot();
    showDiscover(options, ['fuel-a', 'source-temp']);
    const candidates = [...UI.el.ovBody.querySelectorAll('[data-act="btDiscover"]')];
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate.getAttribute('aria-label')).toContain('不朽斩');
      expect(candidate.textContent).toContain('不朽斩');
      expect(candidate.textContent).not.toContain('初始攻击');
    }
    expect(candidates[0].getAttribute('aria-label')).toContain('随身牌来源');
    expect(candidates[1].getAttribute('aria-label')).toContain('本场临时牌来源');
    expect(UI.el.ovBody.textContent).toContain('来自当前牌库底 · 选中牌以本场临时副本入手，战后消散');
    expect(JSON.stringify(options)).toBe(beforeOptions);
    expect(JSON.stringify(game.ownedCards)).toBe(beforeOwned);
    expect(snapshot()).toEqual(before);
  });
  it('keeps the random-discovery temporary-card copy and supplied faces unchanged', () => {
    start(); battleRuntime.set$shaTransform('不朽斩');
    showDiscover([{ ...Cards.SHA }]);
    const candidate = UI.el.ovBody.querySelector('[data-act="btDiscover"]');
    expect(candidate.getAttribute('aria-label')).toContain('初始攻击');
    expect(candidate.title).not.toContain('来源');
    expect(UI.el.ovBody.textContent).toContain('战斗内临时牌 · 战后消散');
    expect(UI.el.ovBody.textContent).not.toContain('来自当前牌库底');
  });
  it('falls back to the supplied face without inventing ownership for an unresolved source UID', () => {
    start(); showDiscover([{ ...Cards.SHA }], ['unknown-source']);
    const candidate = UI.el.ovBody.querySelector('[data-act="btDiscover"]');
    expect(candidate.textContent).toContain('初始攻击');
    expect(candidate.title).not.toContain('随身牌来源');
    expect(candidate.title).not.toContain('本场临时牌来源');
  });
  it('states the item and equipment exceptions on the ordinary-battle grave badge', () => {
    const piles = renderCombatPiles({ mode: 'normal', drawCount: [], discardCount: [], graveCount: ['spent'],
      pileTip: () => '', cardBackHTML: '', escAttr: value => value });
    const host = document.createElement('div'); host.innerHTML = piles.rest;
    expect(host.querySelector('.bt-pile:last-child').title).toBe('墓地：被消耗的牌战后进消耗区，道具、装备不可在火堆复原');
  });
});
