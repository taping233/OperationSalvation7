/* 手牌代价句式单一登记点契约（迭代评审 09-20）：
 * 「预检」（battle.rules handCostOf）与「结算」（effect-steps consume/play）必须同源——
 * 本文件锁住三件事：① 三个已知手牌代价卡全部命中登记点正则（审计据此归条件卡）；
 * ② 非代价句不误命中；③ 中日数词映射与历史行为一致。 */
import { describe, expect, it } from 'vitest';
import { HAND_COST_CONSUME_RE, HAND_COST_SELECT_RE, HAND_COST_PATTERNS, HAND_COST_CN_NUM } from '../game/src/hand-cost-patterns.js';

describe('手牌代价句式登记点', () => {
  it('已知手牌代价卡全部命中（审计条件卡白名单依据）', () => {
    expect(HAND_COST_CONSUME_RE.test('消耗 2 张初始攻击，攻击 3 次。')).toBe(true);   // 快意恩仇
    expect(HAND_COST_CONSUME_RE.test('消耗1 张装备牌，+10甲。')).toBe(true);          // 铸甲（无空格变体）
    expect(HAND_COST_SELECT_RE.test('攻+5，选择手牌中 1 张武术卡直接释放。')).toBe(true);   // 剑荡妖邪
  });

  it('非代价句不误命中（银河之旅为无前置条件卡，零效果走硬失败）', () => {
    const desc = '本场对战中，你的所有武术均为 1 费。';
    expect(HAND_COST_PATTERNS.some(re => re.test(desc))).toBe(false);
    expect(HAND_COST_PATTERNS.some(re => re.test('获得 2 点攻击力。'))).toBe(false);
  });

  it('数词映射与消耗句解析口径一致', () => {
    expect(HAND_COST_CN_NUM['一']).toBe(1);
    expect(HAND_COST_CN_NUM['两']).toBe(2);
    expect(HAND_COST_CN_NUM['二']).toBe(2);
    const m = HAND_COST_CONSUME_RE.exec('消耗 两 张牌，获得 3 币。');
    expect(m[1]).toBe('两');
    expect(m[2]).toBe('牌');
    expect(m[3]).toBe('获得 3 币。');
  });
});
