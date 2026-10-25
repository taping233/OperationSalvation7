import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { playFireRestFeedback } from '../game/src/ui/fire-rest-feedback.js';
import { motionTiming } from '../game/src/ui/motion-presets.js';

let root, scene;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.className = '';
  document.body.innerHTML = '<main><section class="sc-fire"><button>复原</button><button disabled>已使用</button></section></main>';
  root = document.querySelector('main'); scene = root.firstElementChild;
  scene.animate = vi.fn();
});
afterEach(() => { vi.useRealTimers(); document.body.replaceChildren(); });

it('回血演出使用实际生命差，期间锁定操作，超时收尾恢复原禁用状态', async () => {
  const result = playFireRestFeedback(root, { kind:'heal', hpBefore:28, hpAfter:30, maxHp:30 });
  expect(scene.textContent).toContain('+2');
  expect(scene.textContent).toContain('28 → 30 / 30');
  expect([...scene.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
  expect(scene.getAttribute('aria-busy')).toBe('true');
  await vi.advanceTimersByTimeAsync(motionTiming.fireHeal + motionTiming.completionSlack);
  expect(await result).toBe(true);
  expect(scene.querySelector('.fire-rest-feedback')).toBeNull();
  expect([...scene.querySelectorAll('button')].map(button => button.disabled)).toEqual([false,true]);
  expect(scene.hasAttribute('aria-busy')).toBe(false);
});

it('复原呈现实际卡快照和重复张数，卡名转义且卡面不占焦点', async () => {
  const card = { name:'成长牌<一>', desc:'当前强化版本' };
  const result = playFireRestFeedback(root, { kind:'restore', cards:[card,card],
    cardHTML:entry => `<div tabindex="0">${entry.desc}</div>` });
  expect(scene.querySelectorAll('.fire-rest-reveal-card')).toHaveLength(2);
  expect(scene.textContent).toContain('2 张');
  expect(scene.querySelector('.fire-rest-reveal-card > span').textContent).toBe(card.name);
  expect(scene.querySelector('.fire-rest-reveal-card [tabindex]')).toBeNull();
  await vi.advanceTimersByTimeAsync(motionTiming.fireRestore + motionTiming.completionSlack);
  expect(await result).toBe(true);
});

it('子动画结束不提前结束整场演出，主动画结束后释放计时器', async () => {
  const result = playFireRestFeedback(root, { kind:'heal' });
  const event = () => { const end = new Event('animationend', { bubbles:true }); Object.defineProperty(end,'animationName',{value:'fire-rest-feedback'}); return end; };
  scene.querySelector('.fire-heal-sigil').dispatchEvent(event());
  expect(scene.querySelector('.fire-rest-feedback')).not.toBeNull();
  scene.querySelector('.fire-rest-feedback').dispatchEvent(event());
  expect(await result).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it('切页后取消旧演出，不改写替换页面', async () => {
  const result = playFireRestFeedback(root, { kind:'restore', cards:[{name:'牌'}] });
  root.innerHTML = '<section id="next"><button>设置</button></section>';
  await Promise.resolve();
  expect(await result).toBe(false);
  expect(root.innerHTML).toBe('<section id="next"><button>设置</button></section>');
  expect(vi.getTimerCount()).toBe(0);
});

it('减少动态效果下直接显示结算结果，不锁定按钮或排队等待', async () => {
  document.body.classList.add('reduce-motion');
  expect(await playFireRestFeedback(root, { kind:'heal' })).toBe(false);
  expect(scene.querySelector('.fire-rest-feedback')).toBeNull();
  expect(scene.querySelector('button').disabled).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
