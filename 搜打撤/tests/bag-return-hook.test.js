/* 背包来源页返回钩子契约（迭代评审 09-20 C-P1）：
 * 事件页/物资格页/商店开背包再关闭后恢复原页面——钩子取走即清空，防陈旧钩子误触发。 */
import { describe, expect, it, vi } from 'vitest';
import { setBagReturnHook, takeBagReturnHook } from '../game/src/bag-return-hook.js';

describe('背包来源恢复钩子', () => {
  it('登记后可取走，且取走即清空（防二次误触发）', () => {
    const restore = vi.fn();
    setBagReturnHook(restore);
    expect(takeBagReturnHook()).toBe(restore);
    expect(takeBagReturnHook()).toBeNull();   // 消费后为空
    expect(restore).not.toHaveBeenCalled();   // 钩子只登记不代调，调用权在 closeBackpack
  });

  it('传 null / 非函数视为清空', () => {
    setBagReturnHook(() => {});
    setBagReturnHook(null);
    expect(takeBagReturnHook()).toBeNull();
    setBagReturnHook('not-a-function');
    expect(takeBagReturnHook()).toBeNull();
  });

  it('后登记覆盖先登记（事件页叠物资格页场景）', () => {
    const first = vi.fn();
    const second = vi.fn();
    setBagReturnHook(first);
    setBagReturnHook(second);
    expect(takeBagReturnHook()).toBe(second);
  });
});
