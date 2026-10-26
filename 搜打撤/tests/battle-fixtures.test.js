// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { drainBattle } from './helpers/battle-fixtures.js';

const idle = { phase: 'player', busy: false, actionQueueLength: 0 };
const host = getSnapshot => ({ getSnapshot, commands: {
  pickDiscover: vi.fn(), pickChoice: vi.fn(), skipHandSelect: vi.fn(),
} });
afterEach(() => vi.useRealTimers());

describe('战斗测试的等待契约', () => {
  it('队列卡住必须失败，不能返回未完成快照', async () => {
    vi.useFakeTimers();
    const session = host(() => ({ phase: 'resolving', busy: true, actionQueueLength: 2 }));
    const result = expect(drainBattle(session, 2)).rejects.toThrow(/等待超时（2 轮）.*busy=true, queue=2/);
    await vi.runAllTimersAsync();
    await result;
  });

  it('跨调度间隙确认最新空闲快照', async () => {
    vi.useFakeTimers();
    const busy = { ...idle, busy: true, actionQueueLength: 1 };
    const read = vi.fn().mockReturnValueOnce(idle).mockReturnValueOnce(busy).mockReturnValue(idle);
    const result = drainBattle(host(read), 2);
    await vi.runAllTimersAsync();
    expect(await result).toBe(idle);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it.each(['discovering', 'choosing', 'handSelecting'])('等待 %s 面板时明确返回，保留用户选择', async key => {
    vi.useFakeTimers();
    const panel = { ...idle, busy: true, [key]: { options: [] } };
    const session = host(() => panel);
    const result = drainBattle(session, 2, { stopAt: [key] });
    await vi.runAllTimersAsync();
    expect(await result).toBe(panel);
    Object.values(session.commands).forEach(command => expect(command).not.toHaveBeenCalled());
  });

  it('确认间隙中新出现的发现面板也必须处理后才能返回', async () => {
    vi.useFakeTimers();
    const panel = { ...idle, discovering: { options: ['a'] } };
    const read = vi.fn().mockReturnValueOnce(idle).mockReturnValueOnce(panel).mockReturnValueOnce(panel).mockReturnValue(idle);
    const session = host(read);
    const result = drainBattle(session, 3);
    await vi.runAllTimersAsync();
    expect(await result).toBe(idle);
    expect(session.commands.pickDiscover).toHaveBeenCalledExactlyOnceWith(0);
  });
});
