/* SYS-03 物资事务审计（2026-10-03 老板 SYS-03）：钥匙复原链（消耗区→卡牌仓库）钉现状。
 * 链路：基地页「复原 ×N」按钮（game.hub.pages.js 按 pocketKeyCost 预检 afford disabled）
 *   → UI.act('restoreCard')（game.hub.js:278，按返回值分笔回执：true/'sha'/'full'/nokey）
 *   → Base.restore（base.js）：钥匙不足 nokey 拒绝、仓库满 full 拒绝、mutate 事务内
 *   扣钥匙+口袋移除+入仓（保存失败不污染运行态，base-mutation）。
 * 独立无 mock 环境：sys03-altar-restore-txn.test.js 的 game.storage mock 与本链的存档事务冲突。
 * 口径：古朴 1 / 稀有 2 / 史诗 3 / 传说 4，整堆复原 = 单张价 × 张数（base.js POCKET_KEY_COST）。 */
import { afterEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || {};
window.SDT.Icons = { rich: x => x };
window.SDT.MAP = { rules: { stashMax: 20, stashStart: 10, stashUpgradeSlots: 5, bagMax: 20, bagSize: 10, safeMax: 8, safeStart: 4 } };
window.SDT.Sound = { sfx: vi.fn() };
window.SDT.UI = { log: vi.fn() };
await import('../game/src/hub/base.js');
const BaseApi = window.SDT.Base;   // base.js 经 sdtDefine 挂门面，无 named export

function freshSlot() {
  localStorage.clear();
  BaseApi.use(4);
  return { card: { id: 'k1', name: '消耗卡', rarity: '稀有', type: '法术' }, count: 2 };
}

afterEach(() => {
  localStorage.clear();
});

describe('SYS-03 钥匙复原链（base.restore / pocketKeyCost）', () => {
  it('pocketKeyCost：按稀有度 × 张数计价（稀有 2 × 2 张 = 4）', () => {
    const stack = freshSlot();
    BaseApi.data.pocket = [stack];
    expect(BaseApi.pocketKeyCost(stack)).toBe(4);
    expect(BaseApi.pocketKeyCost({ card: { rarity: '传说' }, count: 1 })).toBe(4);
    expect(BaseApi.pocketKeyCost({ card: { rarity: '古朴' }, count: 3 })).toBe(3);
    expect(BaseApi.pocketKeyCost(null)).toBe(0);
  });

  it('钥匙不足：nokey 拒绝，口袋与钥匙原样不动（未领/已领不搞混）', () => {
    const stack = freshSlot();
    BaseApi.data.pocket = [stack];
    BaseApi.data.keys = 3;   // 3 < 4
    expect(BaseApi.restore(0)).toEqual({ why: 'nokey', cost: 4 });
    expect(BaseApi.data.keys).toBe(3);
    expect(BaseApi.data.pocket).toHaveLength(1);
  });

  it('仓库满：full 拒绝且不扣钥匙', () => {
    const stack = freshSlot();
    BaseApi.data.pocket = [stack];
    BaseApi.data.keys = 10;
    BaseApi.data.stash = Array.from({ length: 10 }, (_, i) => ({ card: { id: 'f' + i, name: '满' + i }, count: 1 }));
    expect(BaseApi.restore(0)).toBe('full');
    expect(BaseApi.data.keys).toBe(10);
    expect(BaseApi.data.pocket).toHaveLength(1);
  });

  it('复原成功：mutate 事务内扣钥匙+口袋移除+整堆入仓；无效序号不动作', () => {
    const stack = freshSlot();
    BaseApi.data.pocket = [stack];
    BaseApi.data.keys = 10;
    BaseApi.data.stash = [];
    expect(BaseApi.restore(0)).toBe(true);
    expect(BaseApi.data.keys).toBe(6);   // 10 - 4
    expect(BaseApi.data.pocket).toHaveLength(0);
    expect(BaseApi.data.stash).toEqual([{ card: { id: 'k1', name: '消耗卡', rarity: '稀有', type: '法术' }, count: 2 }]);
    expect(BaseApi.restore(99)).toBe(false);
    expect(BaseApi.data.keys).toBe(6);
  });
});
