import '../../css/home-linked-interactions.css';
import './motion-presets.js';
import { esc, escAttr } from '../core/shared.js';

/* 导航外观统一；目的地和退出生命周期仍由调用页面负责。 */
/** @param {string} action @param {string} label @param {string} [className] @param {string} [type] @param {{shortcut?: string, text?: string, cancel?: boolean}} [options] */
export function linkedBackHTML(action, label, className = '', type = 'button', { shortcut = 'Esc', text = '', cancel } = {}) {
  return `<button type="${type === 'submit' ? 'submit' : 'button'}" class="archive-back ${escAttr(className)}" data-act="${escAttr(action)}"${cancel == null ? '' : ` data-cancel="${cancel}"`} aria-label="${escAttr(label)}" title="${escAttr(label)}${shortcut ? `（${escAttr(shortcut)}）` : ''}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>${text ? `<span>${esc(text)}</span>` : ''}</button>`;
}

/* 资源数值由调用页提供，共用持有/需要与不足标记，不参与扣款。 */
export function linkedCostsHTML(rows, note = '持有 / 需要') {
  return `<dl class="camp-costs">${rows.map(row => `<div${row.need != null && row.have < row.need ? ' class="missing"' : ''}><dt>${esc(row.name)}</dt><dd>${esc(row.have)} / ${row.need == null ? '—' : esc(row.need)}<small>${esc(note)}</small></dd></div>`).join('')}</dl>`;
}

const linkedAnimations = new Set();
const pausedAnimations = new Set();
function releaseLinkedAnimation(animation) {
  linkedAnimations.delete(animation);
  pausedAnimations.delete(animation);
}
function cancelDetachedAnimation(animation) {
  if (animation.effect?.target?.isConnected !== false) return false;
  releaseLinkedAnimation(animation);
  animation.cancel();
  return true;
}
export function trackLinkedAnimation(animation) {
  if (!animation) return animation;
  linkedAnimations.add(animation);
  const release = () => releaseLinkedAnimation(animation);
  animation.finished.then(release, release);
  // pending also includes a caller's pause request; only running belongs to this clock.
  if (document.hidden && animation.playState === 'running') {
    animation.pause();
    pausedAnimations.add(animation);
  }
  return animation;
}
export function linkedAnimate(node, frames, options) {
  return trackLinkedAnimation(node?.animate?.(frames, options));
}
const syncVisibility = () => {
  document.body.classList.toggle('linked-backgrounded', document.hidden);
  if (document.hidden) {
    for (const animation of linkedAnimations) {
      if (animation.playState !== 'running' || cancelDetachedAnimation(animation)) continue;
      animation.pause();
      pausedAnimations.add(animation);
    }
  } else {
    for (const animation of pausedAnimations) {
      if (!cancelDetachedAnimation(animation) && animation.playState === 'paused') animation.play();
    }
    pausedAnimations.clear();
  }
};
syncVisibility();
document.addEventListener('visibilitychange', syncVisibility);
