import { afterAll, describe, expect, it } from 'vitest';
import { calculateEffectiveCardCost, pocketSpellDiscountFor } from '../game/src/battle.card-cost.js';
import { isAreaEffect, targetSideFor } from '../game/src/battle.rules.js';
import { validateCardRules } from '../game/src/card-rules.schema.js';
import { KEY as CARDS_KEY, TT12_KEY } from '../game/src/cards.consts.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

const Cards = window.SDT.Cards;
const RULES_KEY = 'sdt-cards-tt12-preplay-v1-seeded';
const ONPLAY_KEY = 'sdt-cards-tt12-onplay-v1-seeded';

function cost(card, state = {}) {
  return calculateEffectiveCardCost(card, undefined, {
    unlimitedRune: false,
    zeroFeeTurn: undefined,
    turn: 1,
    cosmosForm: 0,
    spellCost1: false,
    meleeCost1: false,
    lastPlayedType: '',
    playedMartialThisTurn: 0,
    armor: null,
    pocketDiscount: 0,
    consumedSpellCount: 0,
    ...state,
  });
}

describe('TT12 结构化出牌前规则', () => {
  const previousCards = JSON.parse(JSON.stringify(Cards.all()));
  const previousKeys = new Map([CARDS_KEY, TT12_KEY, RULES_KEY, ONPLAY_KEY].map(key => [key, localStorage.getItem(key)]));

  afterAll(() => {
    Cards.saveAll(previousCards);
    for (const [key, value] of previousKeys) {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
  });

  it('新档播种获得两个规则数据定义', () => {
    Cards.saveAll([]);
    localStorage.removeItem(TT12_KEY);
    localStorage.removeItem(RULES_KEY);
    localStorage.removeItem(ONPLAY_KEY);

    Cards.seedBatch(Cards.TABLETOP12, TT12_KEY, 'tt12');
    Cards.ensureTT12PreplayRules();

    expect(Cards.all().find(card => card.id === 'tt12-barriermend').rules).toMatchObject({
      version: 1,
      battle: {
        target: { side: 'self', area: false },
        costModifiers: [{ kind: 'armorZeroFree' }],
      },
    });
    expect(Cards.all().find(card => card.id === 'tt12-backupcell').rules).toMatchObject({
      version: 1,
      battle: {
        target: { side: null, area: false },
        costModifiers: [{ kind: 'consumedSpellDiscount', amount: 1 }],
      },
    });
    expect(Cards.all().find(card => card.id === 'tt12-barriermend').rules.triggers.onPlay)
      .toEqual([{ op: 'armor', amountField: 'armor' }]);
    expect(Cards.all().find(card => card.id === 'tt12-firecracker').rules).toMatchObject({
      battle: { target: { side: 'enemy', area: true } },
      triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }] },
    });
  });

  it('marker 已存在但同步覆盖清掉规则时仍按定版修复并保留玩家字段', () => {
    Cards.saveAll([
      { id: 'tt12-barriermend', name: '玩家屏障名', type: '法术', cost: 1, armor: 6, desc: '玩家改写屏障描述', customField: 'keep-barrier' },
      { id: 'tt12-backupcell', name: '玩家能源名', type: '法术', cost: 6, draw: 2, desc: '玩家改写能源描述', customField: 'keep-cell' },
      { id: 'tt12-firecracker', name: '玩家烟火名', type: '法术', cost: 0, dmg: 1, dmgType: 'fixed', desc: '玩家改写烟火描述', customField: 'keep-firecracker' },
      { id: 'unrelated-card', name: '旁卡', desc: '保持原样', customField: 'keep-unrelated' },
    ]);
    localStorage.setItem(TT12_KEY, '1');
    localStorage.setItem(RULES_KEY, '1');
    localStorage.setItem(ONPLAY_KEY, '1');

    Cards.ensureTT12PreplayRules();
    const barrier = Cards.all().find(card => card.id === 'tt12-barriermend');
    const backup = Cards.all().find(card => card.id === 'tt12-backupcell');
    const firecracker = Cards.all().find(card => card.id === 'tt12-firecracker');
    expect(localStorage.getItem(RULES_KEY)).toBe('1');
    expect(localStorage.getItem(ONPLAY_KEY)).toBe('1');
    for (const card of [barrier, firecracker]) {
      const definition = Cards.TABLETOP12.find(entry => entry.id === card.id);
      expect(card.rules.triggers).toEqual(definition.rules.triggers);
      expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [], pending: [] });
    }
    for (const card of [barrier, backup]) {
      const definition = Cards.TABLETOP12.find(entry => entry.id === card.id);
      expect(card.rules.version).toBe(definition.rules.version);
      expect(card.rules.battle).toEqual(definition.rules.battle);
      expect(Object.keys(card.rules).sort()).toEqual(card.id === 'tt12-barriermend'
        ? ['battle', 'triggers', 'version']
        : ['battle', 'version']);
      expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [], pending: [] });
    }
    expect(barrier).toMatchObject({ name: '玩家屏障名', desc: '玩家改写屏障描述', armor: 6, customField: 'keep-barrier' });
    expect(backup).toMatchObject({ name: '玩家能源名', desc: '玩家改写能源描述', draw: 2, customField: 'keep-cell' });
    expect(Cards.all().find(card => card.id === 'unrelated-card')).toMatchObject({ desc: '保持原样', customField: 'keep-unrelated' });

    expect(targetSideFor(barrier, Cards.DMG_TYPES)).toBe('self');
    expect(isAreaEffect(barrier)).toBe(false);
    expect(cost(barrier, { armor: 0 })).toBe(0);
    expect(cost(barrier, { armor: 6 })).toBe(1);

    expect(targetSideFor(backup, Cards.DMG_TYPES)).toBe(null);
    expect(isAreaEffect(backup)).toBe(false);
    expect(pocketSpellDiscountFor(backup)).toBe(1);
    expect(cost(backup, { consumedSpellCount: 0 })).toBe(6);
    expect(cost(backup, { consumedSpellCount: 4 })).toBe(2);

    expect(firecracker).toMatchObject({ name: '玩家烟火名', desc: '玩家改写烟火描述', dmg: 1, dmgType: 'fixed', customField: 'keep-firecracker' });
    expect(firecracker.rules.battle.target).toEqual({ side: 'enemy', area: true });
    expect(targetSideFor(firecracker, Cards.DMG_TYPES)).toBe('enemy');
    expect(isAreaEffect(firecracker)).toBe(true);

    barrier.desc = '任意改写后的屏障文字';
    backup.desc = '任意改写后的能源文字';
    expect(targetSideFor(barrier, Cards.DMG_TYPES)).toBe('self');
    expect(isAreaEffect(barrier)).toBe(false);
    expect(cost(barrier, { armor: 0 })).toBe(0);
    expect(cost(barrier, { armor: 6 })).toBe(1);
    expect(targetSideFor(backup, Cards.DMG_TYPES)).toBe(null);
    expect(isAreaEffect(backup)).toBe(false);
    expect(pocketSpellDiscountFor(backup)).toBe(1);
    expect(cost(backup, { consumedSpellCount: 4 })).toBe(2);
  });

  it('补齐重复执行不重复追加 modifiers', () => {
    Cards.ensureTT12PreplayRules();
    Cards.ensureTT12PreplayRules();
    localStorage.removeItem(ONPLAY_KEY);
    Cards.ensureTT12PreplayRules();
    expect(Cards.all().find(card => card.id === 'tt12-barriermend').rules.battle.costModifiers)
      .toEqual([{ kind: 'armorZeroFree' }]);
    expect(Cards.all().find(card => card.id === 'tt12-backupcell').rules.battle.costModifiers)
      .toEqual([{ kind: 'consumedSpellDiscount', amount: 1 }]);
    expect(Cards.all().find(card => card.id === 'tt12-barriermend').rules.triggers.onPlay)
      .toEqual([{ op: 'armor', amountField: 'armor' }]);
    expect(Cards.all().find(card => card.id === 'tt12-firecracker').rules.triggers.onPlay)
      .toEqual([{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }]);
  });
});
