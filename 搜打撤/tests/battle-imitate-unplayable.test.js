import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { unplayableReasonFor } from '../game/src/battle/effects/battle.target-rules.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(20, 99, 15, 1, 99, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession, getPreviewContext } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const piles = await import('../game/src/battle/runtime/battle.runtime.piles.js');
const Cards = window.SDT.Cards;
const reason = '先打出一张武术牌，使本牌变形';
let game;

beforeAll(() => {
  for (const name of ['ensureSha', 'ensureStarters', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) Cards[name]();
});

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function idle() {
  for (let i = 0; i < 200; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (!state.busy && !state.actionQueueLength) return state;
  }
  throw new Error('imitate battle action did not settle');
}

const canonical = id => {
  const card = Cards.all().find(entry => entry.id === id);
  if (!card) throw new Error(`missing card ${id}`);
  return structuredClone(card);
};

async function start(boss) {
  game = {
    ownedCards: ['tt7-imitate', 'starter-attack', 'tt3-skewer'].map((id, index) => ({ uid: `imitate-${index}`, card: canonical(id), safe: false })),
    inventory: [], usedPocket: [], ...playerFields(40, 40, 5, 0, '侠客', null),
    logs: [], log(message) { this.logs.push(message); }, heal() {}, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'imitate-target', name: '验证靶', hp: 1000, atk: 0 }],
    { isBoss: boss, directBossStart: boss, name: '不变应万变禁用回归' });
  await idle();
}

afterEach(async () => {
  if (game?.battleActive) { BattleSession.commands.flee(); await idle(); }
  game = null;
});

describe.each([['普通', false], ['BOSS', true]])('%s战：不变应万变等待手牌变形', (_label, boss) => {
  it('原卡拒绝直接打出，预览给出相同短因，能量与所有牌区不变', async () => {
    await start(boss);
    const card = engine.findCard('imitate-0').card;
    const description = card.desc;
    const before = BattleSession.getSnapshot();
    expect(engine.unplayableReason(card)).toBe(reason);
    expect(getPreviewContext('imitate-0', 0).illegalReason).toContain(reason);
    for (const target of [undefined, 'self', 0]) BattleSession.commands.playCard('imitate-0', target);
    const after = await idle();
    expect(after.energy).toBe(before.energy);
    expect(after.hand).toEqual(before.hand);
    expect(after.discard).toEqual(before.discard);
    expect(after.foes[0].hp).toBe(before.foes[0].hp);
    expect(piles.played).toEqual([]);
    expect(engine.findCard('imitate-0').card.desc).toBe(description);
    expect(description).toContain('在手牌中时');
    expect(game.logs.some(line => line.includes(reason))).toBe(true);
  });

  it('在手中打出武术后解除禁用，复制牌按1费造成实际伤害', async () => {
    await start(boss);
    BattleSession.commands.playCard('imitate-1', 0);
    await idle();
    const card = engine.findCard('imitate-0').card;
    expect(card.id).toBe('starter-attack');
    expect(card.cost).toBe(1);
    expect(engine.unplayableReason(card)).toBe(null);
    expect(getPreviewContext('imitate-0', 0).illegalReason).toBe('');
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard('imitate-0', 0);
    const after = await idle();
    expect(after.energy).toBe(before.energy - 1);
    expect(after.hand).not.toContain('imitate-0');
    expect(after.foes[0].hp).toBeLessThan(before.foes[0].hp);
    expect(game.ownedCards[0].card.id).toBe('tt7-imitate');
  });

  it('已经变形后仍随下一张武术重变形，保持1费可用', async () => {
    await start(boss);
    BattleSession.commands.playCard('imitate-1', 0);
    await idle();
    expect(engine.findCard('imitate-0').card.id).toBe('starter-attack');
    BattleSession.commands.playCard('imitate-2', 0);
    await idle();
    const card = engine.findCard('imitate-0').card;
    expect(card.id).toBe('tt3-skewer');
    expect(card.cost).toBe(1);
    expect(engine.unplayableReason(card)).toBe(null);
    const before = BattleSession.getSnapshot();
    BattleSession.commands.playCard('imitate-0', 0);
    const after = await idle();
    expect(after.energy).toBe(before.energy - 1);
    expect(after.foes[0].hp).toBeLessThan(before.foes[0].hp);
  });
});

it('BOSS：打出武术后才抽入的原卡不追溯变形，仍拒绝无效消耗', async () => {
  await start(true);
  // 仅构造本测试的内存牌序，不操作浏览器或持久存档。
  piles.set$hand(piles.hand.filter(uid => uid !== 'imitate-0'));
  piles.set$drawPile(['imitate-0']);
  BattleSession.commands.playCard('imitate-1', 0);
  await idle();
  engine.drawCards(1);
  expect(engine.findCard('imitate-0').card.id).toBe('tt7-imitate');
  expect(engine.unplayableReason(engine.findCard('imitate-0').card)).toBe(reason);
  const before = BattleSession.getSnapshot();
  BattleSession.commands.playCard('imitate-0');
  const after = await idle();
  expect(after.energy).toBe(before.energy);
  expect(after.hand).toEqual(before.hand);
  expect(after.discard).toEqual(before.discard);
});

it('纯判定同时识别旧档原卡id与宿主标记，变形后的普通武术不受影响', () => {
  const raw = { id: 'tt7-imitate', type: '武术', desc: '展示文案', cost: 1 };
  const hosted = { ...raw, id: 'hosted-imitate', rules: { version: 1, battle: { hosted: ['imitate'] } } };
  expect(unplayableReasonFor(raw, 'normal')).toBe(reason);
  expect(unplayableReasonFor(hosted, 'boss')).toBe(reason);
  expect(unplayableReasonFor({ id: 'starter-attack', type: '武术', cost: 1 }, 'boss')).toBe(null);
});
