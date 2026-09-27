import { afterEach, describe, expect, it } from 'vitest';

const overlay = document.createElement('div');
overlay.id = 'overlay';
overlay.hidden = true;
overlay.innerHTML = '<h2 id="ovTitle"></h2><div id="ovBody"></div>';
document.body.append(overlay);

const ovBody = overlay.querySelector('#ovBody');
const actions = new Map();
let rafQueue = [];
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: { overlay, ovBody, ovTitle: overlay.querySelector('#ovTitle') },
  _lastMode: null,
  showOverlay(title, html, mode) {
    this.el.ovTitle.innerHTML = rich(title);
    ovBody.innerHTML = rich(html);
    overlay.hidden = false;
    this._lastMode = mode;
  },
  hideOverlay() { overlay.hidden = true; },
  hideTooltip() {},
  showTooltip() {},
  refresh() {},
  log() {},
  act(name, fn) { actions.set(name, fn); },
};
window.SDT = {
  UI,
  Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} },
  Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} },
};

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
await import('../game/src/battle/battle.view.js');
const { waitForFeedback, clearFeedback } = await import('../game/src/battle/battle.feedback.js');

function makeFixture() {
  return {
    ownedCards: [], inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
}

function startBattle() {
  const game = makeFixture();
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'e2-hp-foe', name: '血量回归靶子', hp: 50, atk: 1 }], { isBoss: false });
  return game;
}

function flushFrame() {
  const callback = rafQueue.shift();
  if (!callback) throw new Error('Expected a queued battle render');
  callback(performance.now());
}

function renderedHp() {
  return ovBody.querySelector('.sts-foe .sts-hp > span')?.textContent;
}

function renderedHpBars() {
  const wrap = ovBody.querySelector('.sts-foe .bt-hpwrap');
  return {
    main: wrap?.querySelector('.sts-hp-main')?.style.width,
    ghost: wrap?.querySelector('.sts-hp-ghost')?.style.width,
  };
}

afterEach(() => {
  clearFeedback();
  BattleSession.commands.flee();
  overlay.hidden = true;
  actions.clear();
  rafQueue = [];
  window.requestAnimationFrame = originalRequestAnimationFrame;
});

const originalRequestAnimationFrame = window.requestAnimationFrame;

describe('E2 battle HP rendering recovery', () => {
  it('keeps the normal damage feedback hpAfter visible', async () => {
    rafQueue = [];
    window.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length; };
    startBattle();
    flushFrame();
    BattleSession.commands.dev('damageAll', 9);
    flushFrame();
    expect(renderedHp()).toBe('50/50'); // pre-feedback phase stages hpBefore
    BattleSession.commands.setPendingHint('animation-retained'); // normal connected rerender
    flushFrame();
    expect(renderedHp()).toBe('50/50'); // connected diffs must not swallow the damage animation
    await waitForFeedback();

    expect(BattleSession.getSnapshot().foes[0].hp).toBe(41);
    expect(renderedHp()).toBe('41/50');
    expect(renderedHpBars()).toEqual({ main: '82%', ghost: '82%' });
  });

  it('reconciles authoritative HP after a feedback-time panel replaces and restores the battle DOM', async () => {
    rafQueue = [];
    window.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length; };
    startBattle();
    flushFrame();
    BattleSession.commands.dev('damageAll', 9);
    flushFrame();

    expect(BattleSession.getSnapshot().foes[0].hp).toBe(41);
    expect(renderedHp()).toBe('50/50'); // hit animation deliberately stages hpBefore

    BattleSession.commands.openGrave(); // removes the target while hpAfter feedback is queued
    flushFrame();
    await waitForFeedback();
    BattleSession.commands.closeGrave();
    flushFrame();

    expect(BattleSession.getSnapshot().foes[0].hp).toBe(41);
    expect(renderedHp()).toBe('41/50');
    expect(renderedHpBars()).toEqual({ main: '82%', ghost: '82%' });
  });
});
