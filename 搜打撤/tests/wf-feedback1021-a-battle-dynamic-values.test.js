/* 反馈#11（2026-10-21 老板实测 12 条）：
 * 「所有卡牌的数值要实际计算显示 在战斗中」（反馈点为悬停卡牌长描述）。
 * 口径：战斗内描述里的伤害数字按当前实际加成重算（攻击力+攻击强化、法伤+法术强化，
 * 与 combat.dealDamage 同式）；无加成时与基础值一致；非战斗（地图/图鉴/文档）保持静态。
 * 覆盖：纯提供器单测 + 真实 BattleSession 内祝福加成后的手牌/悬停描述联动。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import {
  registerBattleValueProvider, readBattleValues,
} from '../game/src/cards/battle-value-context.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 10, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 3, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Combat = await import('../game/src/battle/core/combat.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

/** 注册测试提供器并在结束时原样恢复（不覆盖引擎在装配时注册的提供器）。 */
function withValues(values, run) {
  const previous = registerBattleValueProvider(() => values);
  try {
    run();
  } finally {
    registerBattleValueProvider(previous);
  }
}

const ATTACK_RAW = '造成（你的攻击力 + 2）点攻击伤害；对目标附加 1 层流血。';
const SPELL_RAW = '造成 4 点法术伤害。';
const byId = id => {
  const card = C.all().find(value => value.id === id);
  if (!card) throw new Error(`缺少现役卡 ${id}`);
  return card;
};

describe('反馈#11 非战斗场景保持静态', () => {
  it('未注册提供器时，伤害数字逐字静态（地图/图鉴/文档生成口径）', () => {
    expect(readBattleValues()).toBeNull();
    expect(displayCardDescription(ATTACK_RAW, 'wf-no-provider')).toBe(ATTACK_RAW);
    expect(displayCardDescription(SPELL_RAW, 'wf-no-provider')).toBe(SPELL_RAW);
    expect(displayCardDescription(byId('tt3-reshot').desc, 'tt3-reshot', byId('tt3-reshot')))
      .toBe('造成（你的攻击力 + 2）点攻击伤害。');
  });

  it('提供器存在但战斗未激活时仍走静态', () => {
    withValues({ active: false, atk: 99, spellPower: 99 }, () => {
      expect(readBattleValues()).toBeNull();
      expect(displayCardDescription(ATTACK_RAW, 'wf-inactive')).toBe(ATTACK_RAW);
    });
  });
});

describe('反馈#11 战斗内按当前实际加成计算', () => {
  it('攻击句/法术句按 atk 与法伤重算；无法伤时与基础值一致', () => {
    withValues({ active: true, atk: 5, spellPower: 0 }, () => {
      expect(displayCardDescription(ATTACK_RAW, 'wf-atk')).toBe('造成 7 点攻击伤害；对目标附加 1 层流血。');
      expect(displayCardDescription('造成等同于你的攻击力的攻击伤害。', 'wf-sha')).toBe('造成 5 点攻击伤害。');
      expect(displayCardDescription(SPELL_RAW, 'wf-sp0')).toBe('造成 4 点法术伤害。');   // 无加成 = 基础值
    });

    withValues({ active: true, atk: 8, spellPower: 3 }, () => {
      expect(displayCardDescription(ATTACK_RAW, 'wf-atk')).toBe('造成 10 点攻击伤害；对目标附加 1 层流血。');
      expect(displayCardDescription(SPELL_RAW, 'wf-sp')).toBe('造成 7 点法术伤害。');
      expect(displayCardDescription('5′，附加冰冻。', 'wf-prime')).toBe('8′，附加冰冻。');   // 原始素记号同样重算
    });
  });

  it('真实战斗：手牌/悬停长描述随攻击强化祝福变化，战斗结束后回落静态', async () => {
    const game = {
      ownedCards: [
        { uid: 'dyn-0', card: byId('tt3-reshot'), safe: false },
        { uid: 'dyn-1', card: byId('tt3-ice-spike'), safe: false },
      ],
      hp: 50, maxHp: 50, atk: 5, spellPower: 2, coins: 0,
      myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
      lastBattleEnd: null,
      log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
      addItem() {}, onBattleEnd() {},
    };
    BattleSession.start(game, [{ id: 'dyn-foe', name: '数值靶', hp: 9999, atk: 1 }], { isBoss: false, name: '动态数值' });
    await new Promise(resolve => setTimeout(resolve, 40));
    const describeCard = card => displayCardDescription(card.desc, card.id, card);

    // 基础：攻 5 + 2、法伤 2 + 2 —— 悬停长描述按当前实际值显示
    expect(describeCard(byId('tt3-reshot'))).toBe('造成 7 点攻击伤害。');
    expect(describeCard(byId('tt3-ice-spike'))).toBe('造成 4 点法术伤害；对目标附加冰冻。');

    // 制造加成状态：攻击强化 +3 → 数值随之变化
    Combat.addBlessing(R.pstat, 'atkUp', 3);
    expect(describeCard(byId('tt3-reshot'))).toBe('造成 10 点攻击伤害。');
    expect(describeCard(byId('tt3-ice-spike')), '法术句不受攻击强化影响').toBe('造成 4 点法术伤害；对目标附加冰冻。');

    // 法术强化 +2 → 法术数值随之变化
    Combat.addBlessing(R.pstat, 'spellUp', 2);
    expect(describeCard(byId('tt3-ice-spike'))).toBe('造成 6 点法术伤害；对目标附加冰冻。');

    BattleSession.commands.flee();
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(readBattleValues(), '战斗结束后提供器应失效').toBeNull();
    expect(describeCard(byId('tt3-reshot'))).toBe('造成（你的攻击力 + 2）点攻击伤害。');
  });
});
