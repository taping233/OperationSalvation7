import { esc, escAttr } from '../core/shared.js';
import { motionTiming } from './motion-presets.js';
import '../../css/operation-notice.css';

let nextNotice = 0;
// Each owner has one channel. A newer result replaces the old timer and message.
// Warnings persist until explicitly replaced or cleared by their owner.
export function createOperationNotice() {
  const id = `operation-${++nextNotice}`;
  let text = '', tone = 'ok', timer;
  const sync = () => {
    document.querySelectorAll(`[data-operation-notice="${id}"]`).forEach(node => {
      node.textContent = text;
      /** @type {HTMLElement} */ (node).dataset.noticeTone = tone;
    });
  };
  const clear = () => { clearTimeout(timer); text = ''; sync(); };
  return {
    get text() { return text; },
    get tone() { return tone; },
    clear,
    set(message, type = 'ok') {
      clearTimeout(timer);
      text = String(message || ''); tone = type === 'warn' ? 'warn' : 'ok';
      sync();
      if (text && tone !== 'warn') timer = setTimeout(clear, motionTiming.notice);
    },
    html({ className = '', tag = 'p', elementId = '', keepEmpty = false } = {}) {
      if (!text && !keepEmpty) return '';
      const element = ['p', 'span', 'div', 'aside'].includes(tag) ? tag : 'p';
      return `<${element}${elementId ? ` id="${escAttr(elementId)}"` : ''} class="operation-notice ${escAttr(className)}" data-operation-notice="${id}" data-notice-tone="${tone}" role="status" aria-live="polite" aria-atomic="true">${esc(text)}</${element}>`;
    },
  };
}
