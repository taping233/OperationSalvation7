import { describe, expect, it } from 'vitest';
import { rewardCardState, rewardProgress, rewardCardStatus, rewardBoxSummary } from '../game/src/ui/reward-state.js';
import { rewardClaimHTML, rewardReturnHTML } from '../game/src/ui/reward-scene-view.js';
import { chestRewardFrameHTML } from '../game/src/ui/chest-reward-overview.js';

describe('奖励呈现共享契约', () => {
  it('同一结算记录派生卡状态、回执和剩余数，不改变原记录', () => {
    const cards = ['基础A', '基础B', '基础C', '宠物蛋'].map(name => ({ name }));
    const taken = new Set([0]), lost = new Set([1, 2]);
    const progress = rewardProgress(cards, taken, lost);
    expect(progress).toEqual({ received:[cards[0]], pending:[cards[3]], takenCount:1, lostCount:2, cardCount:4 });
    expect(cards.map((_, i) => rewardCardStatus(rewardCardState(taken, lost, i), i < 3))).toEqual(['✓ 已选择 · 已入背包', '已永久放弃', '已永久放弃', '']);
    expect(rewardBoxSummary({ ...progress, choice:true })).toBe('已领取 1 张 · 其余 2 张已放弃 · 剩余 1 张待处理');
    expect([...taken]).toEqual([0]); expect([...lost]).toEqual([1, 2]);
  });
  it.each([
    [false, true, 'chestTake1', '收下'],
    [true, true, 'chestPick', '选择这张'],
    [false, false, 'chestMakeRoom', '整理背包'],
    [true, false, 'chestMakeRoom', '整理背包'],
  ])('卡下与放大入口共用动作 choice=%s fits=%s', (choice, fits, action, label) => {
    for (const zoom of [false, true]) {
      document.body.innerHTML = rewardClaimHTML({ index:2, cardName:`卡"名'<&>`, choice, fits, zoom });
      const button = document.querySelector('button');
      expect(button.dataset).toMatchObject({ act:action, i:'2', cancel:'false' });
      expect(button.textContent).toBe(label);
      expect(button.getAttribute('aria-label')).toBe(`${label}：卡"名'<&>`);
      expect(button.getAttributeNames().sort()).toEqual(['aria-label', 'class', 'data-act', 'data-cancel', 'data-i', 'type']);
      expect(button.className).toBe(zoom ? 'ov-btn ok' : 'reward-claim');
      expect(!!document.querySelector('.reward-choice-warning')).toBe(zoom && choice);
    }
  });
  it.each(['received', 'forfeited'])('已处理%s不重新提供领取按钮', state => {
    document.body.innerHTML = rewardClaimHTML({ index:1, state, choice:true });
    expect(document.querySelector('button')).toBeNull();
    expect(document.body.textContent).toBe(state === 'received' ? '已选择' : '已放弃');
  });
  it('确认放弃中禁用领取；取消回到拥有者，不与放弃混用', () => {
    document.body.innerHTML = rewardClaimHTML({ index:0, disabled:true });
    expect(document.querySelector('button').disabled).toBe(true);
    document.body.innerHTML = rewardReturnHTML({ action:'return', organize:true }) + chestRewardFrameHTML({ picker:'卡牌' });
    expect([...document.querySelectorAll('button')].map(button => button.dataset.cancel)).toEqual(['true', 'true']);
    expect(document.querySelector('[data-organize="return"]')).not.toBeNull();
    expect(document.querySelector('[data-act="chestClosePicker"]')).not.toBeNull();
  });
});
