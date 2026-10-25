import { TERM_TIPS } from './term-definitions.js';
import { allowsTermTip } from './term-tip-policy.js';
// @ts-check
// Loaded on the first tooltip interaction. Content and placement retain the shared rules.
import SDT from '../core/sdt-facade.js';
import { BASE_W, BASE_H, scale } from './ui-scale.js';

/** 词条讲解条目（TERM_TIPS 值形状；icon 仅部分词条有，缺省 = 纯文字无图标）。
 * @typedef {{name: string, icon?: string, text: string}} TermMeta
 */

/** @type {Record<string, TermMeta>} */


/** 词条 key → 讲解条目；未知 key 返回 null。
 * @param {string} key
 * @returns {TermMeta|null}
 */
function termMeta(key) { return TERM_TIPS[key] || null; }

/** @typedef {TermMeta & {note?: string, dynamic?: boolean}} TipMeta */

/** @param {() => void} onHide @param {(el: Element|null) => boolean} isLive */
export function createTermTipRenderer(onHide, isLive) {
/** @type {HTMLDivElement|null} */
let tipEl = null;
/** @type {Element|null} */
let curEl = null;
/** @type {Element|null} */
let describedEl = null;
/** @type {number|null} */
let followFrame = null;
/** @type {TipMeta|null} */
let renderedMeta = null;

/** @param {Element} el @returns {TipMeta|null} */
function metaFor(el) {
  if (!allowsTermTip(el)) return null;
  if (!el.hasAttribute('data-ui-tip')) return termMeta(el.getAttribute('data-term') || '');
  const name = el.getAttribute('data-ui-tip-title') || '';
  const text = el.getAttribute('data-ui-tip-text') || '';
  return name || text ? { name, text, note:el.getAttribute('data-ui-tip-note') || '', dynamic:true } : null;
}

/** Remove only this tooltip's token, preserving other accessibility descriptions. */
function unlinkDescription() {
  if (!describedEl) return;
  const ids = (describedEl.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== 'sdt-term-tip');
  if (ids.length) describedEl.setAttribute('aria-describedby', ids.join(' '));
  else describedEl.removeAttribute('aria-describedby');
  describedEl = null;
}

/** @param {Element} el */
function linkDescription(el) {
  const target = el.hasAttribute('tabindex') || el.matches('button, a, input')
    ? el : /** @type {HTMLButtonElement} */ (el.querySelector('button, a, input, [tabindex]')) || el;
  if (describedEl === target) return;
  unlinkDescription();
  const ids = (target.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
  target.setAttribute('aria-describedby', [...new Set([...ids, 'sdt-term-tip'])].join(' '));
  describedEl = target;
}

/** 惰性创建全局讲解浮框（单例，挂在 document.body）。
 * @returns {HTMLDivElement}
 */
function ensureTip() {
  if (tipEl?.isConnected) return tipEl;
  tipEl = document.createElement('div');
  tipEl.id = 'sdt-term-tip';
  tipEl.className = 'term-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  renderedMeta = null;
  return tipEl;
}

/** @param {HTMLDivElement} tip @param {TipMeta} meta */
function renderContent(tip, meta) {
  if (renderedMeta && renderedMeta.name === meta.name && renderedMeta.text === meta.text
      && renderedMeta.icon === meta.icon && renderedMeta.note === meta.note && renderedMeta.dynamic === meta.dynamic) return;
  // Snapshot only the fields actually painted; dynamic help may change in place.
  renderedMeta = { name:meta.name, text:meta.text, icon:meta.icon, note:meta.note, dynamic:meta.dynamic };
  tip.replaceChildren();
  tip.classList.toggle('is-action-tip', !!meta.dynamic);
  const icon = meta.icon && SDT.Icons && /** @type {{img?: (name: string) => string}} */ (SDT.Icons).img ? /** @type {{img: (name: string) => string}} */ (SDT.Icons).img(meta.icon) : '';
  if (icon) tip.insertAdjacentHTML('beforeend', icon);
  const title = document.createElement('b'); title.textContent = meta.name; tip.appendChild(title);
  if (meta.dynamic) {
    const text = document.createElement('span'); text.className = 'term-tip-text'; text.textContent = meta.text; tip.appendChild(text);
    if (meta.note) { const note = document.createElement('small'); note.textContent = meta.note; tip.appendChild(note); }
  } else {
    const separator = document.createElement('span'); separator.className = 'term-tip-sep'; separator.textContent = '——';
    tip.append(separator, document.createTextNode(meta.text));
  }
}

/** Body-mounted fixed positioning escapes transformed/clipped battle descendants.
 * @param {Element} el @param {HTMLDivElement} tip
 */
function positionTip(el, tip) {
  const sc = scale() || 1;
  const vw = Math.min(BASE_W, window.innerWidth / sc), vh = Math.min(BASE_H, window.innerHeight / sc);
  const inset = 8;
  const maxWidth = `${Math.max(1, vw - inset * 2)}px`, maxHeight = `${Math.max(1, vh - inset * 2)}px`;
  if (tip.style.getPropertyValue('--term-tip-max-width') !== maxWidth) tip.style.setProperty('--term-tip-max-width', maxWidth);
  if (tip.style.getPropertyValue('--term-tip-max-height') !== maxHeight) tip.style.setProperty('--term-tip-max-height', maxHeight);
  const r = el.getBoundingClientRect();
  const x = r.left / sc, y = r.top / sc, w = r.width / sc, h = r.height / sc;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  /** @param {number} value @param {number} size @param {number} bound */
  const clamp = (value, size, bound) => Math.min(Math.max(value, inset), Math.max(inset, bound - size - inset));
  const left = clamp(x + w / 2 - tw / 2, tw, vw);
  const above = y - inset, below = vh - y - h - inset;
  const top = clamp(above >= th || above >= below ? y - th - inset : y + h + inset, th, vh);
  const nextLeft = `${Math.round(left)}px`, nextTop = `${Math.round(top)}px`;
  if (tip.style.left !== nextLeft) tip.style.left = nextLeft;
  if (tip.style.top !== nextTop) tip.style.top = nextTop;
}

/** Active only while a tooltip is visible: follow animation transforms and live action state. */
function followAnchor() {
  followFrame = null;
  if (!curEl || !tipEl || tipEl.hidden) return;
  const meta = isLive(curEl) && metaFor(curEl);
  if (!meta) { onHide(); return; }
  renderContent(tipEl, meta); positionTip(curEl, tipEl);
  if (typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
}

// Observe only during display. Removed/replaced anchors disappear at the mutation boundary.
const anchorObserver = new MutationObserver(() => { if (curEl && !isLive(curEl)) onHide(); });

/** @param {Element} el */
function show(el) {
  const meta = isLive(el) && metaFor(el);
  if (!meta) { onHide(); return; }
  const tip = ensureTip();
  // Overlay background isolation may have marked this passive body sibling inert.
  tip.removeAttribute('inert');
  curEl = el; renderContent(tip, meta); linkDescription(el);
  tip.hidden = false; positionTip(el, tip);
  anchorObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden', 'inert', 'aria-hidden'] });
  if (followFrame === null && typeof window.requestAnimationFrame === 'function') followFrame = window.requestAnimationFrame(followAnchor);
}


function hide() {
  curEl = null;
  if (followFrame !== null) window.cancelAnimationFrame(followFrame);
  followFrame = null; anchorObserver.disconnect(); unlinkDescription();
  if (tipEl) tipEl.hidden = true;
}
function resize() { if (curEl && tipEl && !tipEl.hidden) positionTip(curEl, tipEl); }
return { show, hide, resize };
}
