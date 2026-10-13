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
