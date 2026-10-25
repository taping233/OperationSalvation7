import { afterEach, expect, it, vi } from 'vitest';
import { showRewardCompletionReceipt, clearRewardCompletionReceipt } from '../game/src/ui/reward-card-feedback.js';
import { rewardSceneHTML } from '../game/src/ui/reward-scene-view.js';
afterEach(() => { clearRewardCompletionReceipt(); vi.useRealTimers(); document.body.replaceChildren(); });
it('acknowledges a successful receipt without focus, actions or another confirmation', () => {
  vi.useFakeTimers(); document.body.innerHTML = '<button id="map">地图</button>';
  const map = document.getElementById('map'); map.focus();
  showRewardCompletionReceipt([{ name:'<img src=x>' }]);
  const receipt = document.querySelector('.reward-completion-receipt');
  expect(receipt.textContent).toBe('已收下');
  expect(receipt.getAttribute('role')).toBe('status'); expect(receipt.querySelector('img,button')).toBeNull();
  expect(document.activeElement).toBe(map); vi.advanceTimersByTime(1800); expect(receipt.isConnected).toBe(false);
});
it('replaces old receipts and clears them when a new overlay mode opens', () => {
  vi.useFakeTimers(); showRewardCompletionReceipt([{name:'甲'}]); vi.advanceTimersByTime(1000);
  showRewardCompletionReceipt([{name:'乙'}]); vi.advanceTimersByTime(801);
  expect(document.querySelectorAll('.reward-completion-receipt')).toHaveLength(1);
  expect(document.querySelector('.reward-completion-receipt').textContent).toBe('已收下');
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', {detail:'battle'}));
  expect(document.querySelector('.reward-completion-receipt')).toBeNull();
});
it('shares the explicit compact layout between chest and standalone rewards without affecting choice defaults', () => {
  for (const className of ['reward-v14', 'reward-v14 reward-standalone-picker']) {
    document.body.innerHTML = rewardSceneHTML({ title:'收获', cards:'<article>卡</article>', actions:'', count:1, className, compact:true });
    expect(document.querySelector('.reward-compact .reward-objects').textContent).toBe('卡');
  }
  expect(rewardSceneHTML({title:'三选一', cards:'', actions:'', count:3})).not.toContain('reward-compact');
});
