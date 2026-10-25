import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindEndTurnHold } from '../game/src/ui/end-turn-hold.js';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.setItem('sdt-end-turn-hold', '1');
  document.body.innerHTML = '<div id="overlay"><button>结束回合</button></div>';
});
afterEach(() => {
  window.dispatchEvent(new Event('blur'));
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  localStorage.clear(); document.body.innerHTML = '';
});
const begin = () => {
  const button = document.querySelector('button'), run = vi.fn();
  bindEndTurnHold(button, run);
  button.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
  return { button, run };
};

describe('长按结束回合的失效边界', () => {
  it('窗口失焦后停止计时，重新长按仍能完成', async () => {
    const { button, run } = begin();
    await vi.advanceTimersByTimeAsync(300);
    window.dispatchEvent(new Event('blur'));
    await vi.advanceTimersByTimeAsync(400);
    expect(run).not.toHaveBeenCalled();
    expect(button.classList.contains('is-holding')).toBe(false);
    button.dispatchEvent(new MouseEvent('pointerdown', { button: 0, bubbles: true }));
    await vi.advanceTimersByTimeAsync(650);
    expect(run).toHaveBeenCalledOnce();
  });
  it('指针在按钮之外释放也取消长按', async () => {
    const { run } = begin();
    window.dispatchEvent(new MouseEvent('pointerup', { button: 0 }));
    await vi.advanceTimersByTimeAsync(700);
    expect(run).not.toHaveBeenCalled();
  });
  it('按钮仍连接但原页面隐藏时不执行', async () => {
    const { run } = begin();
    document.getElementById('overlay').hidden = true;
    await vi.advanceTimersByTimeAsync(700);
    expect(run).not.toHaveBeenCalled();
  });
  it('确认层使原页面不可交互时不执行', async () => {
    const { run } = begin();
    document.getElementById('overlay').setAttribute('inert', '');
    await vi.advanceTimersByTimeAsync(700);
    expect(run).not.toHaveBeenCalled();
  });
});
