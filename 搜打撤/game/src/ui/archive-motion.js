// 选档专用编排；只装饰已有页面，不延迟路由、不写存档。
import '../../css/archive-motion.css';

let cleanup = null;

export function clearArchiveMotion(overlay) {
  cleanup?.();
  cleanup = null;
  if (overlay) delete overlay.dataset.archiveMotion;
}

export function enterArchive(overlay, body, reduced) {
  clearArchiveMotion(overlay);
  const page = body?.querySelector('.slot-page:not(.camp-entry-ghost)');
  if (!page) return;
  overlay.dataset.archiveMotion = '1';
  const cards = [...page.querySelectorAll('.slot-card')];
  cards.forEach((card, index) => {
    card.style.setProperty('--archive-offset', `${(2 - index) * 22}px`);
    card.style.setProperty('--archive-delay', `${220 + index * 50}ms`);
    card.style.setProperty('--archive-detail-delay', `${420 + index * 50}ms`);
  });
  // 捕获真实按钮输入，选中标记也适用于键盘激活和异步读档。
  const pick = event => {
    const button = event.target.closest?.('[data-act="enterSlot"], [data-act="newSlot"]');
    const card = button?.closest('.slot-card');
    if (!card || !page.contains(card)) return;
    page.querySelector('[data-archive-picked]')?.removeAttribute('data-archive-picked');
    card.dataset.archivePicked = '1';
  };
  page.addEventListener('click', pick, true);
  const timer = reduced ? null : setTimeout(() => {
    if (page.isConnected && !overlay.hidden && !overlay.dataset.uiClosing
      && !document.body.classList.contains('reduce-motion')
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      window.SDT?.Sound?.sfx('scene');
    }
  }, 840);
  cleanup = () => { clearTimeout(timer); page.removeEventListener('click', pick, true); };
}
