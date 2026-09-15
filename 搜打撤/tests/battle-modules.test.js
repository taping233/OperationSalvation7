import { describe, expect, it } from 'vitest';
import { refillDrawPile } from '../game/src/battle.deck.js';
import { isAreaEffect, targetSideFor, unplayableReasonFor } from '../game/src/battle.rules.js';
import { createEffectExecutor } from '../game/src/battle.effects.js';

describe('战斗牌堆与出牌规则模块', () => {
  it('只在抽牌堆为空时回收弃牌堆', () => {
    const deck = [];
    const discard = ['a', 'b', 'c'];
    expect(refillDrawPile(deck, discard)).toBe(3);
    expect(new Set(deck)).toEqual(new Set(['a', 'b', 'c']));
    expect(discard).toEqual([]);

    const occupied = ['ready'];
    const waiting = ['later'];
    expect(refillDrawPile(occupied, waiting)).toBe(0);
    expect(occupied).toEqual(['ready']);
    expect(waiting).toEqual(['later']);
  });

  it('把群体、伤害和自疗卡分配到正确目标侧', () => {
    const damageTypes = ['武术'];
    expect(isAreaEffect({ desc: '对所有敌人造成 3 点伤害' })).toBe(true);
    expect(targetSideFor({ type: '武术', desc: '攻击 2' }, damageTypes)).toBe('enemy');
    expect(targetSideFor({ type: '法术', desc: '回复 3 点生命' }, damageTypes)).toBe('self');
    expect(targetSideFor({ type: '法术', desc: '抽 1 张牌' }, damageTypes)).toBe(null);
    // 2026-09-15 老板定向：纯群体效果牌拖战场空白处即可打出（无单体伤害 → 无指向）
    expect(targetSideFor({ type: '法术', desc: '冰冻所有敌人。' }, damageTypes)).toBe(null);
    expect(targetSideFor({ type: '法术', desc: '冰冻所有敌人，持续 1 回合。' }, damageTypes)).toBe(null);
    // 带伤害的群体牌仍指向敌人（保留伤害预览）
    expect(targetSideFor({ type: '武术', dmg: 1, dmgType: 'attack', desc: '攻1，全体攻击。' }, damageTypes)).toBe('enemy');
  });

  it('按普通战斗与 BOSS 战限制卡牌', () => {
    expect(unplayableReasonFor({ type: '资源' }, 'normal')).toContain('资源卡');
    expect(unplayableReasonFor({ type: '道具' }, 'boss')).toContain('BOSS');
    expect(unplayableReasonFor({ type: '法术', desc: '将其洗入牌库' }, 'normal')).toContain('牌库');
    expect(unplayableReasonFor({ type: '法术', desc: '抽 1 张牌' }, 'boss')).toBe(null);
  });
});

describe('冰封千里：群体冰冻结算（2026-09-15 修复）', () => {
  // 最小执行器：只记录 addCurse 调用，其余哑端口（与 effect-verbs.test.js 样板同源）
  function makeFreezeExecutor(foes) {
    const frozen = [];
    const applyTextEffects = createEffectExecutor({
      combat: { TYPES: {}, TYPE_NAME: {}, CURSES: [], CURSE_META: {}, addCurse: (t, k, n) => frozen.push([t.name, k, n]), addBlessing() {}, purify() {}, hasCurse: () => false, dealDamage: () => ({ dealt: 0, log: [] }) },
      getAlive: () => foes.filter(f => !f.dead),
      getPlayerStatus: () => ({ hp: 30, status: {}, defense: { shield: 0, armor: 0, guard: false } }),
      getPlayerDefense: () => ({ shield: 0, armor: 0, guard: false }),
      getMode: () => 'normal',
      log: () => {},
      escapeHtml: (s) => String(s),
      heal: () => {}, pushFloat: () => {}, drawCards: () => 0,
      getPlayerHp: () => 30, getHandSize: () => 0, getHandCards: () => [],
      getPlayerClass: () => '法师', getPlayerCaster: () => ({ atk: 0, spellPower: 1 }),
      allCards: () => [], random01: () => 0.5,
    });
    return { applyTextEffects, frozen };
  }

  it('「冰冻所有敌人」对全体存活敌人施加冰冻（无指定目标也能全体生效）', () => {
    const foes = [{ name: '靶子', dead: false }, { name: '二号位', dead: false }, { name: '尸体', dead: true }];
    const { applyTextEffects, frozen } = makeFreezeExecutor(foes);
    const r = applyTextEffects({ name: '冰封千里', type: '法术' }, '冰冻所有敌人。', null, {});
    expect(r.did).toBe(true);
    expect(frozen).toEqual([['靶子', 'freeze', 1], ['二号位', 'freeze', 1]]);
  });

  it('「冰冻所有敌人，持续 1 回合」同样全体生效且带持续回合', () => {
    const foes = [{ name: '靶子', dead: false }, { name: '二号位', dead: false }];
    const { applyTextEffects, frozen } = makeFreezeExecutor(foes);
    const r = applyTextEffects({ name: '冰封千里', type: '法术' }, '冰冻所有敌人，持续 1 回合。', null, {});
    expect(r.did).toBe(true);
    expect(frozen).toEqual([['靶子', 'freeze', 1], ['二号位', 'freeze', 1]]);
  });
});
