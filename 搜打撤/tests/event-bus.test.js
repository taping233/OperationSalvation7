/* 模块间事件总线（批次 5）：battle.core 广播 battle:end，game.bag 订阅消费。
 * 这里只验总线本身的契约：订阅/派发/退订/计数/异常隔离。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emit, off, on, reset } from '../game/src/event-bus.js';

describe('事件总线', () => {
  beforeEach(() => reset());

  it('on 订阅后 emit 按订阅顺序同步派发并透传参数', () => {
    const order = [];
    on('demo', (...args) => order.push(['a', ...args]));
    on('demo', (...args) => order.push(['b', ...args]));
    expect(emit('demo', 1, 'x')).toBe(2);
    expect(order).toEqual([['a', 1, 'x'], ['b', 1, 'x']]);
  });

  it('emit 返回成功执行的订阅者数量，无订阅时为 0（调用方据此走回退路径）', () => {
    expect(emit('nobody')).toBe(0);
    on('demo', () => {});
    expect(emit('demo')).toBe(1);
    const unsubscribe = on('demo', () => {});
    unsubscribe();
    expect(emit('demo')).toBe(1);
  });

  it('on 返回的退订句柄与 off 等价，退订后不再收到事件', () => {
    const fn = vi.fn();
    const unsubscribe = on('demo', fn);
    emit('demo');
    unsubscribe();
    emit('demo');
    expect(fn).toHaveBeenCalledTimes(1);

    on('demo', fn);
    off('demo', fn);
    emit('demo');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('同一函数重复订阅只算一个订阅者（Set 去重）', () => {
    const fn = vi.fn();
    on('demo', fn);
    on('demo', fn);
    expect(emit('demo')).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('单个订阅者抛错被隔离，其余订阅者照常执行且不计数', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const good = vi.fn();
    on('demo', () => { throw new Error('boom'); });
    on('demo', good);
    expect(emit('demo')).toBe(1);
    expect(good).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('派发过程中退订的订阅者本轮跳过，reset 清空全部订阅', () => {
    const late = vi.fn();
    on('demo', () => off('demo', late));
    on('demo', late);
    expect(emit('demo')).toBe(1);
    expect(late).not.toHaveBeenCalled();

    reset();
    expect(emit('demo')).toBe(0);
  });

  it('on 传入非函数直接报错，window.SDT.Bus 暴露同一实现', () => {
    expect(() => on('demo', null)).toThrow(TypeError);
    expect(window.SDT.Bus.emit).toBe(emit);
    expect(window.SDT.Bus.on).toBe(on);
  });
});
