import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { startDepartureHandoff } from '../game/src/ui/departure-transition.js';

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML='<section id="depMain">整备</section>';
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(performance.now()),16));
});
afterEach(() => { vi.useRealTimers();vi.unstubAllGlobals();document.body.replaceChildren();document.body.className=''; });

it('开始新局前已挂出发遮层，正式目的画面可绘制后才释放', async () => {
  const source=document.getElementById('depMain');
  const start=vi.fn(() => {
    expect(document.querySelector('.departure-handoff')).not.toBeNull();
    source.remove();
    document.body.insertAdjacentHTML('afterbegin','<section class="city-run-transition">正式入城过场</section>');
    return true;
  });
  const pending=startDepartureHandoff(start,source);
  expect(start).not.toHaveBeenCalled();
  const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  document.body.dispatchEvent(key);expect(key.defaultPrevented).toBe(true);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(true);
  expect(start).toHaveBeenCalledTimes(1);
  expect(document.querySelector('.departure-handoff')).toBeNull();
  expect(document.querySelector('.city-run-transition')).not.toBeNull();
});

it('双击共享一次出发，来源页已被替换时不启动旧出发', async () => {
  const source=document.getElementById('depMain');const start=vi.fn();
  const first=startDepartureHandoff(start,source);
  expect(startDepartureHandoff(start,source)).toBe(first);
  source.remove();await vi.runAllTimersAsync();
  expect(await first).toBe(false);expect(start).not.toHaveBeenCalled();
  expect(document.querySelector('.departure-handoff')).toBeNull();
});

it('保存失败恢复可操作的原准备页', async () => {
  const source=document.getElementById('depMain');
  const pending=startDepartureHandoff(()=>false,source);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(false);expect(source.isConnected).toBe(true);
  const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  document.body.dispatchEvent(key);expect(key.defaultPrevented).toBe(false);
});

it('跳过演出仍等待出发事务，不提前暴露未就绪地图', async () => {
  let finish;
  const pending=startDepartureHandoff(() => new Promise(resolve => { finish=resolve; }),document.getElementById('depMain'));
  await vi.advanceTimersByTimeAsync(1000);
  document.querySelector('.departure-film-skip').click();
  await vi.advanceTimersByTimeAsync(5000);
  expect(document.querySelector('.departure-film')).not.toBeNull();
  finish(true);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(true);
  expect(document.querySelector('.departure-film')).toBeNull();
});

it('目的地准备好后仍完整呈现短片，键盘可跳过且不会穿透到地图', async () => {
  const pending=startDepartureHandoff(() => true,document.getElementById('depMain'));
  await vi.advanceTimersByTimeAsync(1200);
  expect(document.querySelector('.departure-film-playing')).not.toBeNull();
  const key=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});
  window.dispatchEvent(key);
  expect(key.defaultPrevented).toBe(true);
  await vi.runAllTimersAsync();
  expect(await pending).toBe(true);
  expect(document.querySelector('.departure-film')).toBeNull();
});

it('减少动态效果不等待插画和短片；异常仍释放输入并归还原焦点', async () => {
  document.body.classList.add('reduce-motion');
  const source=document.getElementById('depMain');
  source.innerHTML='<button>确认出发</button>';
  const original=source.querySelector('button'); original.focus();
  const start=vi.fn(() => true);
  const pending=startDepartureHandoff(start,source);
  expect(start).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(100);
  expect(await pending).toBe(true);
  expect(document.activeElement).toBe(original);
  const failed=startDepartureHandoff(() => { throw new Error('storage rejected'); },source);
  await expect(failed).rejects.toThrow('storage rejected');
  expect(document.querySelector('.departure-film')).toBeNull();
  const key=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
  window.dispatchEvent(key);expect(key.defaultPrevented).toBe(false);
  expect(document.activeElement).toBe(original);
});
