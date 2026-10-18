/* battle.target-session 公共契约回归：会话开启、hover 转换、选择/取消、
 * 战局失效及一次性结算；敌人实例排除覆盖 select/selectDirect/hitAt。
 * hitAt 用 elementFromPoint 桩验证目标筛选，不代表真实布局或原生坐标命中。 */
import { describe, expect, it } from 'vitest';
import { createTargetSession, isTargetableEnemy } from '../game/src/battle/core/battle.target-session.js';

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


describe('target-session excludes combat instances rather than species IDs', () => {
  const foes = () => [{ id: 'grass_el', dead: false }, { id: 'grass_el', dead: false }, { id: 'grass_el', dead: true }];
  function pendingSession() {
    return createTargetSession({ side:'enemy', snapshot:{ foes:foes(), pendingTarget:{ excludedTargetIndex:0 } }, isBattleCurrent:() => true });
  }
  it('shared highlight predicate allows the other same-species instance only', () => {
    const list = foes();
    expect(list.map((foe, index) => isTargetableEnemy(foe, index, 0))).toEqual([false, true, false]);
    for (const index of [-1, 0.5, NaN, undefined, '1']) expect(isTargetableEnemy(list[1], index, 0)).toBe(false);
    expect(isTargetableEnemy(undefined, 99, 0)).toBe(false);
    expect(isTargetableEnemy(list[0], 0, -1)).toBe(true);
    expect(isTargetableEnemy({ id:null, dead:false }, 0, 0)).toBe(false);
    expect(isTargetableEnemy({ id:null, dead:false }, 1, 0)).toBe(true);
  });
  it('selectDirect rejects the first/dead/out-of-range instances without settling', async () => {
    const session = pendingSession();
    for (const index of [0, 2, -1, 99, 0.5, NaN, '1']) {
      expect(session.selectDirect('enemy', index)).toBe(false);
      expect(session.settled).toBe(false);
    }
    expect(session.selectDirect('enemy', 1)).toBe(true);
    await expect(session.promise).resolves.toEqual({ status:'selected', target:{ kind:'enemy', idx:1 } });
  });
  it('select uses the same instance filter', () => {
    const session = pendingSession();
    expect(session.select({ kind:'enemy', idx:0 })).toBe(false);
    expect(session.select({ kind:'enemy', idx:2 })).toBe(false);
    expect(session.select({ kind:'enemy', idx:1 })).toBe(true);
  });
  it('hitAt uses the same instance filter before native event dispatch', () => {
    const session = pendingSession();
    const original = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');
    const slot = document.createElement('div');
    slot.className = 'bt-foe';
    Object.defineProperty(document, 'elementFromPoint', { configurable:true, value:() => slot });
    try {
      for (const index of [0, 2, -1, 99]) {
        slot.dataset.eidx = String(index);
        expect(session.hitAt(10, 10)).toBeNull();
      }
      slot.dataset.eidx = '1';
      expect(session.hitAt(10, 10)).toEqual({ kind:'enemy', idx:1, el:slot });
      session.cancel();
      expect(session.hitAt(10, 10)).toBeNull();
    } finally {
      if (original) Object.defineProperty(document, 'elementFromPoint', original);
      else delete document.elementFromPoint;
    }
  });
});
