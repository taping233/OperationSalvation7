/* 覆盖缺口补测 U8（find-C-0100 #1）：battle.target-session 出牌瞄准会话状态机。
 * 测公共契约：会话开启、hover 转换回调、select/selectDirect 确认、cancel、
 * 战局失效自取消、settled 一次性。hitAt 的 elementFromPoint 拾取半边依赖真实布局
 * （jsdom 无布局），不在可测面，仅测其不碰 DOM 的前置守卫分支。零生产改动。 */
import { describe, expect, it } from 'vitest';
import { createTargetSession } from '../game/src/battle/core/battle.target-session.js';

// hover 目标桩：源码按 next?.el 引用判重，只需身份可比
function hoverEl(tag) { return { kind: 'enemy', idx: 0, el: { id: tag } }; }

// 会话工厂：默认 side='enemy'、2 活 1 死敌、战局进行中
function makeSession({ side = 'enemy', foes, getTargets, onHover, battleCurrent = true } = {}) {
  let current = battleCurrent;
  const session = createTargetSession({
    side,
    snapshot: { foes: foes ?? [{ dead: false }, { dead: false }, { dead: true }] },
    isBattleCurrent: () => current,
    ...(getTargets ? { getTargets } : {}),
    ...(onHover ? { onHover } : {}),
  });
  return { session, setCurrent: v => { current = v; } };
}

describe('target-session 会话开启与一次性结果', () => {
  it('新会话：settled=false、hover 为空、isCurrent 为真、promise 挂起', async () => {
    const { session } = makeSession();
    expect(session.settled).toBe(false);
    expect(session.hover).toBe(null);
    expect(session.isCurrent()).toBe(true);
    let settledResult = 'pending';
    session.promise.then(r => { settledResult = r; });
    await Promise.resolve();
    expect(settledResult, '未做任何选择前 promise 不应结算').toBe('pending');
  });

  it('select 合法目标：返回 true，promise 以 selected 结算', async () => {
    const { session } = makeSession();
    const ok = session.select({ kind: 'enemy', idx: 0 });
    expect(ok).toBe(true);
    expect(session.settled).toBe(true);
    await expect(session.promise).resolves.toEqual({ status: 'selected', target: { kind: 'enemy', idx: 0 } });
  });

  it('select 后会话终结：再次 select/cancel 拒绝且不改已结算结果', async () => {
    const { session } = makeSession();
    expect(session.select({ kind: 'enemy', idx: 0 })).toBe(true);
    const result = await session.promise;
    expect(session.select({ kind: 'enemy', idx: 1 }), '结算后 select 应拒绝').toBe(false);
    expect(session.cancel(), '结算后 cancel 应拒绝').toBe(false);
    expect(session.isCurrent()).toBe(false);
    await expect(session.promise).resolves.toBe(result);
  });
});

describe('target-session 目标校验（拒绝后会话保持存活）', () => {
  it('越界 idx 拒绝，会话仍可继续选择', () => {
    const { session } = makeSession();
    expect(session.select({ kind: 'enemy', idx: 99 })).toBe(false);
    expect(session.settled, '越界拒绝不应终结会话').toBe(false);
    expect(session.select({ kind: 'enemy', idx: 0 })).toBe(true);
  });

  it('死亡 foe 拒绝，存活 foe 可选', () => {
    const { session } = makeSession();
    expect(session.select({ kind: 'enemy', idx: 2 })).toBe(false);
    expect(session.settled).toBe(false);
    expect(session.select({ kind: 'enemy', idx: 1 })).toBe(true);
  });

  it('select(null) 拒绝', () => {
    const { session } = makeSession();
    expect(session.select(null)).toBe(false);
    expect(session.settled).toBe(false);
  });

  it('getTargets 优先于 snapshot 作为敌表数据源', async () => {
    let targets = [{ dead: true }];
    const { session } = makeSession({ getTargets: () => targets });
    expect(session.select({ kind: 'enemy', idx: 0 }), 'getTargets 报死则拒，即便 snapshot[0] 活').toBe(false);
    targets = [{ dead: false }];
    expect(session.select({ kind: 'enemy', idx: 0 }), 'getTargets 报活则可选').toBe(true);
    await expect(session.promise).resolves.toEqual({ status: 'selected', target: { kind: 'enemy', idx: 0 } });
  });
});

describe('target-session selectDirect 的 kind/side 匹配门', () => {
  it("side='enemy'：只放行 enemy 且校验存活", () => {
    const { session } = makeSession({ side: 'enemy' });
    expect(session.selectDirect('self')).toBe(false);
    expect(session.selectDirect('any')).toBe(false);
    expect(session.selectDirect('enemy', 2), '死亡 foe 拒绝').toBe(false);
    expect(session.selectDirect('enemy', 0)).toBe(true);
  });

  it("side=null：只放行 'any'", () => {
    const { session } = makeSession({ side: null });
    expect(session.selectDirect('enemy', 0)).toBe(false);
    expect(session.selectDirect('self')).toBe(false);
    expect(session.selectDirect('any')).toBe(true);
  });

  it("side='self'：只放行 self", () => {
    const { session } = makeSession({ side: 'self' });
    expect(session.selectDirect('any')).toBe(false);
    expect(session.selectDirect('self')).toBe(true);
  });

  it('side 不匹配的拒绝不终结会话', () => {
    const { session } = makeSession({ side: 'enemy' });
    expect(session.selectDirect('self')).toBe(false);
    expect(session.settled).toBe(false);
    expect(session.selectDirect('enemy', 1)).toBe(true);
  });
});

describe('target-session hover 转换与清除回调', () => {
  it('切换目标按序回调 onHover(next, prev)，同 el 判重不重复回调', () => {
    const calls = [];
    const { session } = makeSession({ onHover: (next, prev) => calls.push([next, prev]) });
    const t0 = hoverEl('t0');
    const t1 = hoverEl('t1');
    expect(session.setHover(t0)).toBe(t0);
    expect(session.setHover(t1)).toBe(t1);
    expect(session.setHover(t1), '同 el 重复 hover 不应再回调').toBe(t1);
    expect(session.setHover(null)).toBe(null);
    expect(calls).toEqual([[t0, null], [t1, t0], [null, t1]]);
  });

  it('select 确认前清空 hover 并回调清除', async () => {
    const calls = [];
    const { session } = makeSession({ onHover: (next, prev) => calls.push([next, prev]) });
    const t0 = hoverEl('t0');
    session.setHover(t0);
    expect(session.hover).toBe(t0);
    session.select({ kind: 'enemy', idx: 0 });
    expect(session.hover, '确认后 hover 应清空').toBe(null);
    expect(calls.at(-1)).toEqual([null, t0]);
  });
});

describe('target-session cancel 与战局失效自取消', () => {
  it('cancel：true + promise 以 cancelled 结算 + hover 清空', async () => {
    const calls = [];
    const { session } = makeSession({ onHover: (next, prev) => calls.push([next, prev]) });
    session.setHover(hoverEl('t0'));
    expect(session.cancel()).toBe(true);
    await expect(session.promise).resolves.toEqual({ status: 'cancelled', target: null });
    expect(session.settled).toBe(true);
    expect(session.hover).toBe(null);
    expect(calls.at(-1)).toEqual([null, calls[0][0]]);
  });

  it('重复 cancel 第二次拒绝', async () => {
    const { session } = makeSession();
    expect(session.cancel()).toBe(true);
    expect(session.cancel()).toBe(false);
    await expect(session.promise).resolves.toEqual({ status: 'cancelled', target: null });
  });

  it('isBattleCurrent 变假：下一次触碰自取消（清 hover + 结算 cancelled）', async () => {
    const calls = [];
    const { session, setCurrent } = makeSession({ onHover: (next, prev) => calls.push([next, prev]) });
    const t0 = hoverEl('t0');
    session.setHover(t0);
    setCurrent(false);
    expect(session.isCurrent()).toBe(false);
    expect(session.settled, '战局失效应自终结会话').toBe(true);
    expect(session.hover, '自取消应清空 hover').toBe(null);
    expect(calls.at(-1)).toEqual([null, t0]);
    await expect(session.promise).resolves.toEqual({ status: 'cancelled', target: null });
  });

  it('自取消后再触碰不重复结算', async () => {
    const { session, setCurrent } = makeSession();
    setCurrent(false);
    expect(session.isCurrent()).toBe(false);
    expect(session.isCurrent()).toBe(false);
    expect(session.select({ kind: 'enemy', idx: 0 })).toBe(false);
    expect(session.cancel()).toBe(false);
    await expect(session.promise).resolves.toEqual({ status: 'cancelled', target: null });
  });
});

describe('target-session hitAt 的无 DOM 前置守卫', () => {
  it('已结算会话 hitAt 直接 null（isCurrent 短路）', () => {
    const { session } = makeSession();
    session.cancel();
    expect(session.hitAt(10, 10)).toBe(null);
  });

  it('side 为空且会话存活时 hitAt 返回 null（!side 短路）', () => {
    const { session } = makeSession({ side: null });
    expect(session.hitAt(10, 10)).toBe(null);
    expect(session.settled, '守卫短路不应终结会话').toBe(false);
  });
});
