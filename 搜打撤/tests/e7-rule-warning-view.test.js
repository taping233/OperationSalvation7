import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

const overlay = document.createElement('div');
overlay.id = 'overlay';
overlay.hidden = true;
overlay.innerHTML = '<h2 id="ovTitle"></h2><div id="ovBody"></div>';
document.body.append(overlay);
const ovBody = overlay.querySelector('#ovBody');
const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: { overlay, ovBody, ovTitle: overlay.querySelector('#ovTitle') }, _lastMode: null,
  showOverlay(title, html, mode) {
    this.el.ovTitle.innerHTML = rich(title); ovBody.innerHTML = rich(html);
    overlay.hidden = false; this._lastMode = mode;
  },
  hideOverlay() { overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act(name, fn) { actions.set(name, fn); },
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const engine = await import('../game/src/battle/battle.engine.js');
const runtime = await import('../game/src/battle/battle.runtime.js');
const { render } = await import('../game/src/battle/battle.view.js');
const { clearThoughtBubble } = await import('../game/src/battle/battle.hover.js');
const { clearFeedback } = await import('../game/src/battle/battle.feedback.js');
const Bus = (await import('../game/src/core/event-bus.js')).default;
const originalRaf = window.requestAnimationFrame;
const originalAnimate = window.Element.prototype.animate;
let frames = [], game;
const bubble = () => ovBody.querySelector('.bt-thought-bubble');
function flushFrames() {
  for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now());
  expect(frames).toHaveLength(0);
}
async function idle() {
  for (let i = 0; i < 100; i++) {
    flushFrames();
    await new Promise(resolve => setTimeout(resolve, 5));
    if (!BattleSession.getSnapshot().busy && !BattleSession.getSnapshot().actionQueueLength) {
      flushFrames(); return;
    }
  }
  throw new Error('E7 battle did not settle');
}
const unsupportedOp = () => ({ op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'hand', act: 'play' });
const supported = () => ({ id: 'e7-source', name: 'E7规则牌', type: '法术', cost: 2, desc: '',
  rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [{ op: 'coins', n: 7 }] } } });
function unsupported() {
  const card = supported();
  card.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '法术' }];
  card.rules.triggers.onPlay.push(unsupportedOp());
  return card;
}
async function start(card) {
  game = {
    ownedCards: [card, { id: 'payment', name: '支付牌', type: '法术', cost: 0, desc: '' },
      { id: 'fuel', name: '燃料牌', type: '法术', cost: 0, desc: '' },
      { id: 'barrier', name: '队列前牌', type: '法术', cost: 0, desc: '' }]
      .map((value, index) => ({ uid: `e7-${index}`, card: value })),
    inventory: [], hp: 48, maxHp: 50, atk: 4, spellPower: 0, coins: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message, level) { this.logs.push({ message, level }); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'e7-foe', name: '拒绝提示靶子', hp: 1000, atk: 1 }], { isBoss: false });
  await idle();
  expect(ovBody.querySelector('.battle-stage')?._battleToken).toBe(BattleSession.getSnapshot().battleToken);
  expect(ovBody.querySelector('#btSelf')).not.toBeNull();
}
function resources() {
  return { hand: [...runtime.hand], consumed: [...runtime.consumed], played: [...runtime.played],
    grave: [...runtime.grave], energy: runtime.energy, coins: game.coins,
    fuels: runtime.infuseFuels, hp: game.hp, foes: runtime.foes.map(foe => foe.hp) };
}
function expectRejected(before, text) {
  expect(resources()).toEqual(before);
  expect(BattleSession.getSnapshot()).toMatchObject({ handSelecting: null, infusing: null, pendingTarget: null });
  expect(bubble()?.textContent).toBe(text);
  expect(bubble()?.closest('#overlay .battle-stage')).not.toBeNull();
  expect(overlay.hidden).toBe(false);
}
beforeEach(() => {
  frames = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  window.Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
});
afterEach(async () => {
  clearThoughtBubble(); clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await idle();
  overlay.hidden = true; actions.clear(); frames = [];
  window.requestAnimationFrame = originalRaf;
  window.Element.prototype.animate = originalAnimate;
  vi.restoreAllMocks();
});

describe('E7 rule refusal reaches the real battle view', () => {
  it.each(['unsupported', 'invalid'])('shows short %s feedback without paying through real playCard', async kind => {
    const card = unsupported();
    if (kind === 'invalid') card.rules.version = 999;
    expect(inspectCardRuleCapability(card).kind).toBe(kind);
    await start(card);
    const before = resources();
    expect(BattleSession.commands.playCard('e7-0')).toBe(false);
    await idle();
    expectRejected(before, `无法打出：${kind === 'invalid' ? '规则格式非法' : '规则尚未支持'}`);
    expect(game.logs.some(line => line.message.includes('rules.'))).toBe(true);
    expect(bubble().textContent).not.toMatch(/rules\.|&(?:lt|gt|amp);/);
  });
  it('shows unsupported beginInfusion feedback before selecting fuel', async () => {
    const card = { id: 'e7-infuse', name: '注能拒绝', type: '法术', cost: 2, infuse: 1, desc: '',
      rules: { version: 1, triggers: { onDraw: [unsupportedOp()] } } };
    expect(inspectCardRuleCapability(card).kind).toBe('unsupported');
    await start(card);
    const before = resources();
    expect(BattleSession.commands.beginInfusion('e7-0')).toBe(false);
    expectRejected(before, '无法打出：规则尚未支持');
  });
  it('notifies from queue preflight before opening mandatory payment', async () => {
    const card = unsupported();
    await start(card);
    const before = resources();
    expect(engine.queueCardExecution('e7-0', card, ['e7-2'], null, false)).toBe(false);
    expectRejected(before, '无法打出：规则尚未支持');
  });
  it('notifies on the real queued recheck before payment, energy or fuel', async () => {
    const card = supported();
    card.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '法术' }];
    await start(card);
    const before = resources();
    BattleSession.commands.playCard('e7-3'); // This real action holds the async runner until its next continuation.
    engine.queueCardExecution('e7-0', card, ['e7-2'], null, false, true, ['e7-1']);
    expect(BattleSession.getSnapshot().actionQueueLength).toBeGreaterThan(0);
    card.rules.triggers.onPlay.push(unsupportedOp());
    await idle();
    const after = resources();
    expect(after).toEqual({ ...before, hand: before.hand.filter(uid => uid !== 'e7-3'), played: [...before.played, 'e7-3'] });
    expect(bubble()?.textContent).toBe('无法打出：规则尚未支持');
    expect(BattleSession.getSnapshot()).toMatchObject({ handSelecting: null, infusing: null, pendingTarget: null });
  });
  it('ignores stale snapshots, wrong stage ownership, hidden overlays and completed battles', async () => {
    await start(supported());
    const oldToken = BattleSession.getSnapshot().battleToken;
    BattleSession.commands.flee(); await idle();
    await start(supported());
    const token = BattleSession.getSnapshot().battleToken;
    const stage = ovBody.querySelector('.battle-stage');
    const send = battleToken => Bus.emit('battle:rule-rejected', { battleToken, message: '无法打出：规则尚未支持' });
    expect(token).not.toBe(oldToken);
    send(oldToken); expect(bubble()).toBeNull();
    stage._battleToken = oldToken; send(token); expect(bubble()).toBeNull();
    stage._battleToken = token;
    overlay.hidden = true; send(token); expect(bubble()).toBeNull(); overlay.hidden = false;
    UI._lastMode = 'page'; send(token); expect(bubble()).toBeNull(); UI._lastMode = 'battle';
    stage.remove(); send(token); expect(stage.querySelector('.bt-thought-bubble')).toBeNull();
    ovBody.append(stage); send(token); expect(bubble()?.textContent).toBe('无法打出：规则尚未支持');
    clearThoughtBubble();
    BattleSession.commands.flee(); await idle();
    overlay.hidden = false; send(token); expect(bubble()).toBeNull();
  });
  it('keeps one subscription across repeated renders and emits exactly once', async () => {
    await start(unsupported());
    const listenersBefore = Bus.listeners().get('battle:rule-rejected')?.size;
    expect(listenersBefore).toBe(1);
    for (let i = 0; i < 4; i++) render();
    expect(Bus.listeners().get('battle:rule-rejected')?.size).toBe(listenersBefore);
    const events = [];
    const off = Bus.on('battle:rule-rejected', value => events.push(value));
    try {
      BattleSession.commands.playCard('e7-0');
      expect(events).toEqual([{ battleToken: BattleSession.getSnapshot().battleToken, message: '无法打出：规则尚未支持' }]);
      expect(ovBody.querySelectorAll('.bt-thought-bubble')).toHaveLength(1);
    } finally { off(); }
  });
  it.each(['supported', 'legacy'])('does not warn for %s and keeps its real effect', async kind => {
    const card = kind === 'supported' ? supported() : structuredClone(window.SDT.Cards.STARTERS.find(c => c.id === 'starter-emergency-bandage'));
    // Ordinary battle startup separates items from hand cards. Match the E7
    // browser sample: place the unchanged production bandage on an existing UID.
    await start(kind === 'legacy' ? supported() : card);
    if (kind === 'legacy') { runtime.cardOverrides.set('e7-0', card); render(); }
    expect(runtime.hand).toContain('e7-0');
    const events = [];
    const off = Bus.on('battle:rule-rejected', value => events.push(value));
    try {
      BattleSession.commands.playCard('e7-0', kind === 'legacy' ? 'self' : undefined); await idle();
      expect(events).toEqual([]); expect(bubble()).toBeNull();
      expect(game.coins).toBe(kind === 'supported' ? 7 : 0);
      expect(game.hp).toBe(kind === 'legacy' ? 50 : 48);
      expect(runtime.energy).toBe(kind === 'supported' ? 7 : 9);
      expect(runtime.played).toContain('e7-0');
    } finally { off(); }
  });
});
