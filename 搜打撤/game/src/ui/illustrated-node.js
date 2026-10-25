import { esc, escAttr } from '../core/shared.js';
import '../../css/illustrated-node.css';

// Presentation only. Callers retain action identifiers, admission and persistence.
const ghosts = {
  search:'<circle cx="47" cy="36" r="23" fill="none" stroke="currentColor" stroke-width="8"/><path d="M72 26a23 23 0 1 1-14 42M25 58a23 23 0 0 0 38 20" fill="none" stroke="currentColor" stroke-width="8"/>',
  breach:'<path d="m9 9 45 24-12 9 7 15L0 31zm60 30 51 28-16 27-49-28 15-10-8-8zM42 72l8 2-5 11-8-3zm-17-9 7 3-4 7-7-3z"/>',
  heal:'<path d="M40 18h28v20h20v28H68v20H40V66H20V38h20z"/>',
  cards:'<path d="m22 14 52 7-9 65-52-7zm15 15-3 24 21 3 3-24zM82 30l23 8-19 56-14-5z" fill-rule="evenodd"/>',
  chest:'<path d="M14 39 28 16h63l16 23v46H14zm40-14v25h13V25zM22 56v8h76v-8z" fill-rule="evenodd"/>',
  leave:'<path d="M14 15h49v17H31v47h32v17H14zM64 37l29 19-29 19V63H41V49h23z"/>',
  fight:'<path d="m21 10 63 61-12 13L10 22zm75 0L45 63 32 51l51-41zM13 67l10-10 25 26-10 10zm60-10 11 11-25 25-11-10z"/>',
  explore:'<path d="m14 26 31-12 29 12 31-12v66L74 92 45 80 14 92zm31 0v41l29 12V39z" fill-rule="evenodd"/>',
};
export function illustratedGhostHTML(kind = 'explore', className = 'choice-ghost') {
  return `<svg class="${escAttr(className)}" data-choice-art="${escAttr(kind)}" viewBox="0 0 120 100" aria-hidden="true" fill="currentColor">${ghosts[kind] || ghosts.explore}</svg>`;
}

export function choiceArtFor(text = '') {
  if (/冒险|挖|深入|破拆|深处/.test(text)) return 'breach';
  if (/战斗|应战|攻击|反击/.test(text)) return 'fight';
  if (/离开|返回|放弃|绕行|逃/.test(text)) return 'leave';
  if (/生命|治疗|休息|救助|回复/.test(text)) return 'heal';
  if (/复原|卡牌|职业|法术|招式/.test(text)) return 'cards';
  if (/箱|开启|储备|补给/.test(text)) return 'chest';
  if (/币|搜寻|搜刮|支付|购买|交易/.test(text)) return 'search';
  return 'explore';
}

export function illustratedChoiceContent({ label, detail = '', art, labelClass = '', detailClass = '' }) {
  return `<b${labelClass ? ` class="${escAttr(labelClass)}"` : ''}>${esc(label)}</b><span class="choice-detail${detailClass ? ` ${escAttr(detailClass)}` : ''}">${detail}</span>${illustratedGhostHTML(art || choiceArtFor(label + ' ' + detail))}`;
}

export function illustratedChoiceHTML({ action, label, detail = '', art, className = '', disabled = false, attrs = '' }) {
  return `<button type="button" class="illustrated-choice ${escAttr(className)}" data-act="${escAttr(action)}"${disabled ? ' disabled' : ''}${attrs ? ` ${attrs}` : ''}>${illustratedChoiceContent({ label, detail:esc(detail), art })}</button>`;
}

// Reuse real action nodes and their public classes/attributes across page families.
export function decorateIllustratedChoices(template, { confirm = false } = {}) {
  const options = [...template.content.querySelectorAll('.evt-opt[data-act]')];
  for (const option of options) {
    const label = option.querySelector('b');
    const copy = option.querySelector('.evt-opt-copy');
    const detail = copy ? copy.querySelector('.evt-opt-detail') : option.querySelector(':scope > span:not(.evt-opt-index):not(.evt-opt-state)');
    const state = option.querySelector('.evt-opt-state');
    const detailHTML = detail?.innerHTML || '';
    option.classList.add('illustrated-choice');
    option.innerHTML = illustratedChoiceContent({ label:label?.textContent || option.textContent,
      detail:detailHTML, art:option.dataset.choiceArt || choiceArtFor((label?.textContent || '') + ' ' + (detail?.textContent || '')) });
    if (state && option.dataset.optionState !== 'ready') option.querySelector('.choice-detail').append(state);
    if (confirm && options.length > 1) {
      const unit = template.ownerDocument.createElement('div');
      unit.className = 'illustrated-choice-unit';
      option.replaceWith(unit); unit.append(option);
    }
  }
  return options.length;
}

export function illustratedNodeLayout({ story, content, footer = '', context = '', contentClass = '' }) {
  return `<div class="node-panel illustrated-node-layout">${context}
    <section class="event-story" aria-label="地点与叙事">${illustratedGhostHTML('explore', 'event-emblem')}${story}</section>
    <section class="event-decisions ${escAttr(contentClass)}"><div class="node-main"><div class="node-summary">${content}</div></div>${footer ? `<footer class="node-foot">${footer}</footer>` : ''}</section>
  </div>`;
}
