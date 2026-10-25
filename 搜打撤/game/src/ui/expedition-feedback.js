import { esc } from '../core/shared.js';
import { completeSurfaceMotion } from './motion-completion.js';

// Session-only presentation. Rewards have already been settled by the sender.
export function installExpeditionFeedback({ isCurrentCell }) {
  let timer;
  let panel;
  let retiring = null, cancelExit = null;
  const overlay = document.getElementById('overlay');
  const dismiss = (immediate = false) => {
    clearTimeout(timer);
    cancelExit?.(); cancelExit = null;
    retiring?.remove(); retiring = null;
    const previous = panel;
    panel = null;
    if (!previous) return;
    previous.inert = true;
    previous.classList.add('expedition-feedback-leaving');
    retiring = previous;
    cancelExit = completeSurfaceMotion(previous, () => {
      previous.remove();
      if (retiring === previous) retiring = null;
    }, { name:'expeditionFeedbackOut', duration:140, immediate });
  };
  const onNavigate = event => {
      if (!(event.target instanceof Element)) return;
    if ((panel || retiring) && !panel?.contains(event.target) && event.target.closest?.('#routePanel button, #game, #btnHome')) dismiss(true);
  };
  const observer = new MutationObserver(() => {
    if ((panel || retiring) && overlay && !overlay.hidden) dismiss(true);
  });
  if (overlay) observer.observe(overlay, { attributes:true, attributeFilter:['hidden'] });
  const show = (/** @type {CustomEvent} */ event) => {
    const { detail } = event;
    if (!detail || detail.kind !== 'fire' || !isCurrentCell(detail.cellKey)) return;
    dismiss(true);
    panel = document.createElement('section');
    panel.className = `expedition-feedback expedition-feedback-${detail.kind}`;
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    const cards = Array.isArray(detail.cards) ? detail.cards : [];
    const summary = `生命 +${Number(detail.hpGain) || 0} · ${detail.hp}/${detail.maxHp} · 复原 ${cards.length} 张`;
    panel.innerHTML = `<header><b>${esc(detail.title || '探索反馈')}</b><button type="button" aria-label="关闭探索反馈">×</button></header>
      <p>${esc(summary)}</p>${detail.reason ? `<small>${esc(detail.reason)}</small>` : ''}
      `;
    /** @type {NodeListOf<HTMLButtonElement>} */ (panel.querySelectorAll('button')).forEach(button => button.addEventListener('click', () => dismiss()));
    document.getElementById('viewport')?.append(panel);
    timer = setTimeout(dismiss, 6000);
  };
  window.addEventListener('sdt:expedition-feedback', show);
  document.addEventListener('click', onNavigate, true);
  return () => {
    window.removeEventListener('sdt:expedition-feedback', show);
    document.removeEventListener('click', onNavigate, true);
    observer.disconnect(); dismiss(true);
  };
}
