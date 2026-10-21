import { esc } from '../core/shared.js';

// Session-only presentation. Rewards have already been settled by the sender.
export function installExpeditionFeedback({ isCurrentCell }) {
  let timer;
  let panel;
  const overlay = document.getElementById('overlay');
  const dismiss = () => {
    clearTimeout(timer);
    panel?.remove();
    panel = null;
  };
  const onNavigate = event => {
      if (!(event.target instanceof Element)) return;
    if (panel && !panel.contains(event.target) && event.target.closest?.('#routePanel button, #game, #btnHome')) dismiss();
  };
  const observer = new MutationObserver(() => {
    if (panel && overlay && !overlay.hidden) dismiss();
  });
  if (overlay) observer.observe(overlay, { attributes:true, attributeFilter:['hidden'] });
  const show = (/** @type {CustomEvent} */ event) => {
    const { detail } = event;
    if (!detail || detail.kind !== 'fire' || !isCurrentCell(detail.cellKey)) return;
    dismiss();
    panel = document.createElement('section');
    panel.className = `expedition-feedback expedition-feedback-${detail.kind}`;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    const cards = Array.isArray(detail.cards) ? detail.cards : [];
    const summary = `生命 +${Number(detail.hpGain) || 0} · ${detail.hp}/${detail.maxHp} · 复原 ${cards.length} 张`;
    panel.innerHTML = `<header><b>${esc(detail.title || '探索反馈')}</b><button type="button" aria-label="关闭探索反馈">×</button></header>
      <p>${esc(summary)}</p>${detail.reason ? `<small>${esc(detail.reason)}</small>` : ''}
      `;
    /** @type {NodeListOf<HTMLButtonElement>} */ (panel.querySelectorAll('button')).forEach(button => button.addEventListener('click', dismiss));
    document.getElementById('viewport')?.append(panel);
    timer = setTimeout(dismiss, 6000);
  };
  window.addEventListener('sdt:expedition-feedback', show);
  document.addEventListener('click', onNavigate, true);
  return () => {
    window.removeEventListener('sdt:expedition-feedback', show);
    document.removeEventListener('click', onNavigate, true);
    observer.disconnect(); dismiss();
  };
}
