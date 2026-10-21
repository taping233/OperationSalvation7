// 选档专用编排；只装饰已有页面，不延迟路由、不写存档。
import '../../css/archive-motion.css';

let cleanup = null;

export function clearArchiveMotion(overlay) {
  cleanup?.();
  cleanup = null;
  if (overlay) delete overlay.dataset.archiveMotion;
}

export function enterArchive(overlay, body, reduced = undefined) {
  void reduced; // Existing callers pass the current motion preference.
  clearArchiveMotion(overlay);
  const page = /** @type {HTMLElement} */ (body?.querySelector('.slot-page:not(.camp-entry-ghost)'));
  if (!page) return;
  overlay.dataset.archiveMotion = '1';
  const cards = [.../** @type {NodeListOf<HTMLElement>} */ (page.querySelectorAll('.slot-card'))];
  cards.forEach((card, index) => {
    card.style.setProperty('--archive-offset', `${(2 - index) * 22}px`);
    card.style.setProperty('--archive-delay', `${220 + index * 50}ms`);
    card.style.setProperty('--archive-detail-delay', `${420 + index * 50}ms`);
  });
  // 捕获真实按钮输入，选中标记也适用于键盘激活和异步读档。
  const pick = event => {
      if (!(event.target instanceof Element)) return;
    const button = event.target.closest?.('[data-act="enterSlot"], [data-act="newSlot"]');
    const card = button?.closest('.slot-card');
    if (!card || !page.contains(card)) return;
    /** @type {HTMLElement} */ (page.querySelector('[data-archive-picked]'))?.removeAttribute('data-archive-picked');
    card.dataset.archivePicked = '1';
  };
  page.addEventListener('click', pick, true);
  cleanup = () => page.removeEventListener('click', pick, true);
}
