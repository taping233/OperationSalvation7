/* 覆盖缺口补测 U8（find-C-0100 #2）：battle.clock 演出时序调度。
 * 取舍说明：isTestRuntime()（process.env.VITEST==='true'）是调用时旁路——
 * 本文件在 beforeEach 临时摘除该环境变量驱动真实调度路径（零生产改动），afterEach 恢复；
 * 旁路本身作为契约单测一条（测试运行时必须立即结算，否则全套件会挂起）。
 * 前置统一复位：pace=1（demoMs 恒等/80ms 下限可见）、turbo 关闭。
 * 模块级 pauseDepth/waits 跨用例共享，每个用例必须把新建的等待全部推进到结算再结束。
 * 时间推进用 fake timers；断言不依赖 performance.now 的真假（不测亚毫秒边界）。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pausePresentation,
  schedulePresentation,
  schedulePresentationMs,
  waitHitStop,
  waitPresentationMs,
} from '../game/src/battle/runtime/battle.clock.js';
import { setPace } from '../game/src/battle/runtime/battle.pace.js';
import { setTurbo } from '../game/src/core/turbo.js';

const REAL_VITEST_ENV = process.env.VITEST;

beforeEach(() => {
  delete process.env.VITEST; // 关闭 isTestRuntime 旁路，驱动真实调度路径
  setPace(1);
  setTurbo(false);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  if (REAL_VITEST_ENV === undefined) delete process.env.VITEST;
  else process.env.VITEST = REAL_VITEST_ENV;
});

describe('waitPresentationMs 真实调度', () => {
  it('按毫秒真实等待：未到点不结算，到点结算', async () => {
    let done = false;
    const p = waitPresentationMs(300).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(299);
    expect(done, '299ms 时不应结算').toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
    expect(vi.getTimerCount(), '结算后不应残留定时器').toBe(0);
  });

  it('非正时长立即结算，不挂定时器', async () => {
    await waitPresentationMs(0);
    await waitPresentationMs(-5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('测试运行时旁路：VITEST=true 时不挂定时器立即结算', async () => {
    process.env.VITEST = 'true'; // 显式恢复旁路再断言
    await waitPresentationMs(60_000);
    expect(vi.getTimerCount(), '测试运行时长等待必须短路，否则套件挂起').toBe(0);
  });

  it('abort 后以 signal.reason 原因拒绝，事前已中止同样拒绝', async () => {
    const reason = new Error('用户取消');
    const pre = new AbortController();
    pre.abort(reason);
    await expect(waitPresentationMs(300, pre.signal), '事前已中止应同步拒绝').rejects.toBe(reason);

    const ctrl = new AbortController();
    const p = waitPresentationMs(300, ctrl.signal);
    ctrl.abort(reason);
    await expect(p).rejects.toBe(reason);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('schedulePresentation / schedulePresentationMs', () => {
  it('回调到点执行一次', async () => {
    const cb = vi.fn();
    schedulePresentation(cb, 200);
    await vi.advanceTimersByTimeAsync(199);
    expect(cb).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cb, '到点应恰好执行一次').toHaveBeenCalledTimes(1);
  });

  it('80ms 下限：短时长也至少等 demoMs 下限', async () => {
    const cb = vi.fn();
    schedulePresentation(cb, 10); // demoMs(10)=max(80,10)=80
    await vi.advanceTimersByTimeAsync(79);
    expect(cb, '不足 80ms 不应执行').not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('schedulePresentationMs 按原始毫秒直排，不经 80ms 下限', async () => {
    const cb = vi.fn();
    schedulePresentationMs(cb, 30);
    await vi.advanceTimersByTimeAsync(30);
    expect(cb, 'Ms 变体不走 demoMs 换算').toHaveBeenCalledTimes(1);
  });

  it('返回取消函数：取消后回调不再执行', async () => {
    const cb = vi.fn();
    const cancel = schedulePresentation(cb, 100);
    cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(cb, '取消后回调不应执行').not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('pausePresentation 挂起/恢复', () => {
  it('暂停期间等待冻结，恢复后续跑至结算', async () => {
    let done = false;
    const p = waitPresentationMs(500).then(() => { done = true; });
    const release = pausePresentation();
    await vi.advanceTimersByTimeAsync(2000);
    expect(done, '暂停期间推进时钟不应结算').toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(done, '恢复后应按剩余时长续跑至结算').toBe(true);
  });

  it('恢复句柄可重复调用（幂等），释放后新等待正常计时', async () => {
    let done = false;
    const p = waitPresentationMs(500).then(() => { done = true; });
    const release = pausePresentation();
    release();
    release(); // 重复释放应无副作用
    await vi.advanceTimersByTimeAsync(500);
    await p;
    expect(done).toBe(true);

    let done2 = false;
    const p2 = waitPresentationMs(100).then(() => { done2 = true; });
    await vi.advanceTimersByTimeAsync(100);
    await p2;
    expect(done2, 'pauseDepth 归零后新等待应正常计时').toBe(true);
  });

  it('先行暂停：暂停期间新建的等待不启动，恢复后才开始计时', async () => {
    const release = pausePresentation();
    let done = false;
    const p = waitPresentationMs(500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(5000);
    expect(done, '暂停持有期间新建等待不应计时').toBe(false);
    release();
    await vi.advanceTimersByTimeAsync(499);
    expect(done, '恢复后未满全额时长不应结算').toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(done).toBe(true);
  });

  it('嵌套暂停：外层释放前不恢复', async () => {
    let done = false;
    const p = waitPresentationMs(200).then(() => { done = true; });
    const r1 = pausePresentation();
    const r2 = pausePresentation();
    r1();
    await vi.advanceTimersByTimeAsync(5000);
    expect(done, '内层暂停仍持有，不应恢复').toBe(false);
    r2();
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(done).toBe(true);
  });
});

describe('waitHitStop 顿帧窗口', () => {
  it('顿帧窗口内并发等待被冻结，窗口结束自动恢复后续跑', async () => {
    let hitDone = false;
    const hit = waitHitStop(200).then(() => { hitDone = true; }); // 内部 pausePresentation 冻结并发等待
    let done = false;
    const wait = waitPresentationMs(1000).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(150);
    expect(hitDone, '顿帧窗口未到点不应结算').toBe(false);
    expect(done, '顿帧窗口内并发等待应被冻结').toBe(false);
    await vi.advanceTimersByTimeAsync(100); // t=250：顿帧到点
    await hit;
    expect(done, '顿帧到点只恢复并发等待，不应直接替它结算').toBe(false);
    await vi.advanceTimersByTimeAsync(2000); // 恢复后按剩余时长续跑
    await wait;
    expect(done, '顿帧结束应自动恢复并发等待至结算').toBe(true);
  });

  it('嵌套顿帧共享暂停生命周期：两窗都结束才恢复', async () => {
    let done = false;
    const wait = waitPresentationMs(300).then(() => { done = true; });
    const h1 = waitHitStop(100);
    const h2 = waitHitStop(250);
    await vi.advanceTimersByTimeAsync(150);
    await h1;
    expect(done, '外层顿帧未结束时不应恢复').toBe(false);
    await vi.advanceTimersByTimeAsync(100); // t=250：h2 到点
    await h2;
    await vi.advanceTimersByTimeAsync(1000);
    await wait;
    expect(done, '顿帧全部结束后并发等待应续跑至结算').toBe(true);
  });

  it('abort 立即打断顿帧并解除暂停', async () => {
    const reason = new Error('cancel');
    let done = false;
    const wait = waitPresentationMs(300).then(() => { done = true; });
    const ctrl = new AbortController();
    const hit = waitHitStop(500, ctrl.signal);
    ctrl.abort(reason);
    await expect(hit).rejects.toBe(reason);
    await vi.advanceTimersByTimeAsync(300);
    expect(done, '顿帧被打断后并发等待应已恢复').toBe(true);
    await wait;
  });
});
