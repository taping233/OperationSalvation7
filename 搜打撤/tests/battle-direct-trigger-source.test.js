import { afterEach, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 9, battleHandMax: 8, bossDeckSize: 1, starterSha: 0,
    battleStartDraw: 0, battleTurnDraw: 0, diceSides: 6 }, items: {},
};
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');

let game;
function begin(card) {
  if (card.rules) {
    expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
    expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });
  }
  game = {
    ownedCards: [{ uid: 'direct-trigger', card }], hp: 100, maxHp: 100, atk: 5,
    spellPower: 0, coins: 0, myClass: '战士', state: 'idle', battleActive: false,
    log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'trigger-foe', name: '靶子', hp: 1000, atk: 1 }], { isBoss: false });
  runtime.set$mode('boss');
  runtime.set$hand([]);
  runtime.set$drawPile(['direct-trigger']);
  runtime.set$discard([]);
}

afterEach(() => {
  if (game?.battleActive) BattleSession.commands.flee();
  game = null;
});

const drawCard = triggers => ({
  id: 'direct-draw', name: '抽到触发测试牌', type: '法术', cost: 0,
  desc: '抽到时施放：获得 4 点能量。',
  ...(triggers && { rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers } }),
});

describe('direct trigger source in the real battle engine', () => {
  it('显式空 onDraw 合法且抑制描述触发，卡牌正常入手', () => {
    begin(drawCard({ onDraw: [] }));
    expect(engine.drawCards(1)).toBe(1);
    expect(runtime.energy).toBe(9);
    expect(runtime.hand).toEqual(['direct-trigger']);
    expect(runtime.lastDrawnUids).toEqual(['direct-trigger']);
    expect(runtime.discard).toEqual([]);
    expect(runtime.consumed).toEqual([]);
  });

  it('非空 onDraw 只结算一次结构化效果，沿用离手和入弃牌堆语义', () => {
    begin(drawCard({ onDraw: [{ op: 'energy', n: 2 }] }));
    expect(engine.drawCards(1)).toBe(1);
    expect(runtime.energy).toBe(11);
    expect(runtime.hand).toEqual([]);
    expect(runtime.lastDrawnUids).toEqual([]);
    expect(runtime.discard).toEqual(['direct-trigger']);
    expect(runtime.consumed).toEqual([]);
  });

  it.each([undefined, { onPlay: [] }])('未声明 onDraw 仍兼容旧文本触发：%j', triggers => {
    begin(drawCard(triggers));
    expect(engine.drawCards(1)).toBe(1);
    expect(runtime.energy).toBe(13);
    expect(runtime.hand).toEqual([]);
    expect(runtime.discard).toEqual(['direct-trigger']);
  });

  it('手牌上限仍先于 onDraw 判断，满手时不抽取或触发', () => {
    begin(drawCard({ onDraw: [{ op: 'energy', n: 2 }] }));
    const fullHand = Array.from({ length: 8 }, (_, index) => `full-${index}`);
    runtime.set$hand(fullHand);
    expect(engine.drawCards(1)).toBe(0);
    expect(runtime.energy).toBe(9);
    expect(runtime.hand).toEqual(fullHand);
    expect(runtime.drawPile).toEqual(['direct-trigger']);
    expect(runtime.discard).toEqual([]);
  });

  it('灰烬满手直释仍先于旧文本 onDraw，不额外回放触发句', () => {
    begin(drawCard());
    runtime.applyRuneFlag('ash');
    const fullHand = Array.from({ length: 9 }, (_, index) => `ash-full-${index}`);
    runtime.set$hand(fullHand);
    expect(engine.drawCards(1)).toBe(1);
    expect(runtime.energy).toBe(9);
    expect(runtime.hand).toEqual(fullHand);
    expect(runtime.discard).toEqual(['direct-trigger']);
    expect(runtime.consumed).toEqual([]);
  });

  it.each([
    [{ triggers: { onConsume: [{ op: 'energy', n: 2 }] } }, 2],
    [{ triggers: { onConsume: [] } }, 0],
    [{ equip: { onEquip: [] } }, 0],
    [{ triggers: { onPlay: [] } }, 4],
    [null, 4],
  ])('消耗触发与抽到触发共用互斥来源，保留装备抑制：%j', (rules, energy) => {
    const card = {
      id: 'direct-consume', name: '消耗触发测试牌', type: '法术', cost: 0,
      desc: '消耗该牌时：获得 4 点能量。',
      ...(rules && { rules: { version: 1, ...rules } }),
    };
    begin(card);
    engine.fireConsumeTriggers(card, runtime.foes[0]);
    expect(runtime.energy).toBe(9 + energy);
  });
});
