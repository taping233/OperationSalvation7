import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { battleRules } from './helpers/environment-fixtures.js';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { registerBattleValueProvider } from '../game/src/cards/battle-value-context.js';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(99, 99, 8, 0, 99, 1) } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
const byId = id => structuredClone(Cards.all().find(card => card.id === id));
const evidence = path.resolve('docs/evidence/2026-10-25-card-effect-consistency');

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});
afterEach(async () => {
  if (BattleSession.getSnapshot().battleActive) {
    BattleSession.commands.flee();
    await drain();
  }
});
async function drain() {
  for (let attempt = 0; attempt < 300; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await new Promise(resolve => setTimeout(resolve, 30));
      const latest = BattleSession.getSnapshot();
      if (!latest.busy && latest.actionQueueLength === 0) return latest;
    }
  }
  throw Error('牌效一致性检查未完成战斗动作');
}
async function start(card, spellPower = 2) {
  const game = { ownedCards: [{ uid: 'consistency-card', card }], inventory: [], usedPocket: [],
    hp: 50, maxHp: 50, atk: 5, spellPower, coins: 0, state: 'idle', battleActive: false,
    myClass: '降临者', log() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'consistency-target', name: '审查靶', hp: 1000, atk: 0 }], { isBoss: false });
  await drain();
  return game;
}

describe('卡面展示数值与生产战斗效果一致', () => {
  it('不稳定射线显示完整加成区间，实际伤害落在该区间', async () => {
    const card = byId('tt12-unstableray');
    await start(card);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('造成 6-8 点法术伤害。');
    BattleSession.commands.playCard('consistency-card', 0);
    const snapshot = await drain();
    expect(1000 - snapshot.foes[0].hp).toBeGreaterThanOrEqual(6);
    expect(1000 - snapshot.foes[0].hp).toBeLessThanOrEqual(8);
  });

  it('爆燃火球按两倍法伤加成显示，与生产伤害9一致', async () => {
    const card = byId('tt7-burnharvest');
    await start(card);
    expect(displayCardDescription(card.desc, card.id, card)).toBe('造成 9 点法术伤害；本牌受到的法伤加成翻倍。');
    const holder = document.createElement('div');
    holder.innerHTML = Cards.cardHTML(card, 'sm', { dmgOverride: { bonus: 2 } });
    expect(holder.querySelector('.hsc-dmg b').textContent).toBe("9'");
    expect(holder.querySelector('.hsc-dmg').title).toContain('法伤加成 +4');
    BattleSession.commands.playCard('consistency-card', 0);
    expect(1000 - (await drain()).foes[0].hp).toBe(9);
  });

  it('圣疗使用费用一词，区分材料费用与出售价格', () => {
    const card = byId('tt7-holyheal');
    expect(displayCardDescription(card.desc, card.id, card)).toBe('注能（1）：你回复等同于被注能卡牌费用 2 倍的生命。');
  });

  it('负法伤按实际伤害下限显示，双素记号真实伤害不吃法伤', () => {
    const previous = registerBattleValueProvider(() => ({ active: true, atk: 5, spellPower: -8 }));
    try {
      expect(displayCardDescription('造成 4-6 点法术伤害；造成 3 点固定伤害；造成 9 点真实伤害。', 'custom'))
        .toBe('造成 0-0 点法术伤害；造成 3 点固定伤害；造成 9 点真实伤害。');
      expect(displayCardDescription('12′′；4-6′', 'custom')).toBe('12′′；0-0′');
    } finally { registerBattleValueProvider(previous); }
  });

  it('记录本轮实际运行卡库和展示文案，保留逐卡核对入口', () => {
    const previous = registerBattleValueProvider(null);
    try {
      const catalog = Cards.all().map(card => ({ id: card.id, name: card.name, type: card.type,
        cost: card.cost, value: card.value, rarity: card.rarity, cls: card.cls,
        dmg: card.dmg, dmgType: card.dmgType, heal: card.heal, armor: card.armor,
        draw: card.draw, infuse: card.infuse, raw: card.desc,
        displayed: displayCardDescription(card.desc, card.id, card),
        rules: card.rules || null }));
      expect(catalog.length).toBeGreaterThan(100);
      expect(catalog.every(card => card.id && typeof card.displayed === 'string')).toBe(true);
      fs.mkdirSync(evidence, { recursive: true });
      fs.writeFileSync(path.join(evidence, 'runtime-card-catalog.json'), JSON.stringify(catalog, null, 2));
    } finally { registerBattleValueProvider(previous); }
  });
});
