// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattleSelectionFlow } from '../game/src/battle/core/battle.selection-flow.js';
import { createBattleCardInspection } from '../game/src/battle/effects/battle.card-inspection.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

function setup() {
  const card = { id: 'test-spell', name: '测试法术', type: '法术', cost: 3, desc: '' };
  const entries = ['selected', 'same-template'].map(uid => ({ uid, card }));
  runtime.resetCastOverrides();
  runtime.set$turn(2);
  runtime.set$hand(entries.map(entry => entry.uid));
  runtime.set$consumed([]);
  runtime.set$discoverQueue([]);
  runtime.set$discovering(null);
  runtime.set$choosing(null);
  runtime.set$G({ battleActive: true, ownedCards: entries, log: vi.fn() });
  const cards = { all: () => [card], isRandomObtainable: () => true, sellPrice: () => 0 };
  const inspection = createBattleCardInspection({ cards, curseMeta: {}, readState: () => ({
    game: runtime.G, granted: [], cardOverrides: runtime.cardOverrides,
    zeroFeeUntil: runtime.zeroFeeUntil, turn: runtime.turn, consumed: runtime.consumed,
  }) });
  const flow = createBattleSelectionFlow({
    cards, deny: vi.fn(), random01: () => 0, throwIfActionCancelled: vi.fn(),
    session: { handSelectQueue: [], choiceQueue: [] }, requestBattleRender: vi.fn(),
    findCard: inspection.findCard,
  });
  const select = (uid = 'selected') => {
    runtime.set$handSelecting({ act: 'zero', n: 1, type: null });
    flow.pickHandSelect(uid);
  };
  return { card, flow, select, cost: uid => inspection.effCostOf(card, uid) };
}

afterEach(() => {
  runtime.resetCastOverrides();
  runtime.set$turn(1);
  runtime.set$hand([]);
  runtime.set$consumed([]);
  runtime.set$handSelecting(null);
  runtime.set$G(null);
});

describe('自然法杖：选牌到实例费用查询', () => {
  it('选择当回合不免费，仅指定下一回合免费，过期恢复原费', () => {
    const { select, cost, card } = setup();
    select();
    expect(runtime.zeroFeeUntil.get('selected')).toBe(3);
    expect(runtime.hand).toEqual(['selected', 'same-template']);
    expect(runtime.consumed).toEqual([]);
    expect(cost('selected')).toBe(3);
    runtime.set$turn(3);
    expect(cost('selected')).toBe(0);
    expect(cost('selected')).toBe(0); // 查询不消耗效果。
    expect(cost('same-template')).toBe(3);
    expect(cost(undefined)).toBe(3);
    expect(card.cost).toBe(3);
    runtime.set$turn(4);
    expect(cost('selected')).toBe(3);
  });

  it('同回合重复选择不叠加时长，旧选择回调不能重复提交', () => {
    const { select, flow, cost } = setup();
    select();
    select();
    expect([...runtime.zeroFeeUntil]).toEqual([['selected', 3]]);
    runtime.set$turn(3);
    flow.pickHandSelect('selected');
    expect(runtime.zeroFeeUntil.get('selected')).toBe(3);
    expect(cost('selected')).toBe(0);
    runtime.set$turn(4);
    expect(cost('selected')).toBe(3);
  });

  it('已离手或已消耗的实例不能被旧候选选中；同模板其他实例不继承', () => {
    const { select, cost } = setup();
    runtime.set$hand(['same-template']);
    runtime.set$consumed(['selected']);
    select();
    expect(runtime.zeroFeeUntil.size).toBe(0);
    runtime.set$turn(3);
    expect(cost('same-template')).toBe(3);
  });

  it('战斗存档还原保留指定回合，战斗重置清除零费映射', () => {
    const { select, cost } = setup();
    select();
    const saved = JSON.parse(JSON.stringify({ zeroFeeUntil: [...runtime.zeroFeeUntil] }));
    runtime.resetCastOverrides();
    runtime.restorePilesBookkeeping(saved);
    expect(cost('selected')).toBe(3);
    runtime.set$turn(3);
    expect(cost('selected')).toBe(0);
    runtime.resetCastOverrides();
    expect(cost('selected')).toBe(3);
  });
});
