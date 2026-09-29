// U13（2026-09-29 夜班 F-003）：battle.layers.js document 级 keydown Esc 分支的
// 输入法组合守卫——组合态（isComposing / keyCode 229）Esc 只取消拼音组合，
// 不得取消瞄准/点选/注能；非组合态 Esc 行为全部保持现状。
// 降级说明：驱动真实瞄准/点选态需完整战斗实例（成本过高，派单已允许降级），
// 这里用 document 级合成 Esc 事件 + battle.core 快照/命令 mock，覆盖守卫行可测的面：
// 有待决态时组合态不取消（反例）、非组合态照常取消（正例）、空闲态不误触发（防回归）。
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/core/battle.core.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSnapshot: vi.fn(() => ({
      battleToken: 'u13-esc-ime',
      pendingTarget: null, pendingItem: null, slamPending: null, dartPending: null, infusing: null,
    })),
    commands: { ...actual.commands, cancelPendingTarget: vi.fn(), cancelInfusion: vi.fn() },
  };
});

const idleSnap = () => ({
  battleToken: 'u13-esc-ime',
  pendingTarget: null, pendingItem: null, slamPending: null, dartPending: null, infusing: null,
});
const pendingSnap = () => ({ ...idleSnap(), pendingTarget: { uid: 'card-u13' } });

let core;

function escEvent({ isComposing = false, keyCode = null } = {}) {
  const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing });
  if (isComposing && ev.isComposing !== true) Object.defineProperty(ev, 'isComposing', { value: true });
  if (keyCode != null) Object.defineProperty(ev, 'keyCode', { value: keyCode });
  return ev;
}

beforeEach(async () => {
  vi.clearAllMocks();
  if (!window.SDT) window.SDT = { UI: {} };
  document.body.innerHTML = '<div id="ovBody"><section class="battle-stage"></section></div>';
  window.SDT.UI.el = { ovBody: document.getElementById('ovBody') };
  core = await import('../game/src/battle/core/battle.core.js');
  // battle.layers.js 的 document 级 keydown 监听器在模块求值时注册（只发生一次）
  await import('../game/src/battle/view/battle.layers.js');
});

describe('battle Esc IME guard (F-003)', () => {
  it('组合态（isComposing）Esc 不取消点选/瞄准态，也不 preventDefault', () => {
    core.getSnapshot.mockReturnValue(pendingSnap());
    const ev = escEvent({ isComposing: true });
    document.dispatchEvent(ev);
    expect(core.commands.cancelPendingTarget).not.toHaveBeenCalled();
    expect(core.commands.cancelInfusion).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('组合态（keyCode 229）Esc 不取消点选/瞄准态', () => {
    core.getSnapshot.mockReturnValue(pendingSnap());
    const ev = escEvent({ keyCode: 229 });
    document.dispatchEvent(ev);
    expect(core.commands.cancelPendingTarget).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });

  it('非组合态 Esc 照常取消点选并 preventDefault（现状保持）', () => {
    core.getSnapshot.mockReturnValue(pendingSnap());
    const ev = escEvent();
    document.dispatchEvent(ev);
    expect(core.commands.cancelPendingTarget).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('非组合态且无待决状态时 Esc 不误触发取消（现状保持）', () => {
    core.getSnapshot.mockReturnValue(idleSnap());
    const ev = escEvent();
    document.dispatchEvent(ev);
    expect(core.commands.cancelPendingTarget).not.toHaveBeenCalled();
    expect(ev.defaultPrevented).toBe(false);
  });
});
