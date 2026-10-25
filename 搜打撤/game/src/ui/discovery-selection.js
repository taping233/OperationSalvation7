import { registerScreenOwner } from './screen-owner.js';
import { escAttr, esc } from '../core/shared.js';
import '../../css/discovery-selection.css';

export function discoveryActionsHTML({ confirmAct, cancelAct, cancelLabel = '取消', confirmLabel = '确认' }) {
  return `<div class="ov-btns discovery-selection-actions"><button type="button" class="ov-btn" data-act="${escAttr(cancelAct)}" data-cancel="true">${esc(cancelLabel)}</button><button type="button" class="ov-btn ok" data-act="${escAttr(confirmAct)}" data-cancel="false" disabled>${esc(confirmLabel)}</button></div>`;
}

/** @type {WeakMap<HTMLElement, {dispose:()=>void, selected:()=>HTMLButtonElement|null}>} */
const bindings = new WeakMap();

/**
 * Selection is local presentation state. Only confirmation crosses the domain port.
 * Cancelling may reject synchronously or asynchronously without clearing selection.
 * @param {{ UI:{act:(name:string,handler:Function)=>void}, root:HTMLElement,
 * optionSelector:string, selectAct?:string, confirmAct:string, cancelAct:string, isCurrent:()=>boolean,
 * onConfirm:(data:DOMStringMap,button:HTMLButtonElement)=>unknown,
 * onCancel:()=>unknown, onError?:(error:unknown)=>void }} ports
 */
export function bindDiscoverySelection(ports) {
  const { UI, root, optionSelector, selectAct, confirmAct, cancelAct, isCurrent, onConfirm, onCancel, onError } = ports;
  const previous = bindings.get(root), previousSelection = previous?.selected();
  previous?.dispose();
  const options = [...root.querySelectorAll(optionSelector)].filter(node => node instanceof HTMLButtonElement);
  let selected = options.includes(previousSelection) ? previousSelection : null;
  let busy = false, submitted = false, disposed = false;
  const confirmButton = /** @type {HTMLButtonElement} */ (root.querySelector(`[data-act="${confirmAct}"]`));
  const cancelButton = /** @type {HTMLButtonElement} */ (root.querySelector(`[data-act="${cancelAct}"]`));
  let status = /** @type {HTMLElement|null} */ (root.querySelector('.discovery-selection-status'));
  options.forEach(button => {
    button.dataset.discoveryOption = '';
    if (!button.querySelector(':scope > .discovery-selection-frame')) {
      const frame = document.createElement('span'); frame.className = 'discovery-selection-frame'; frame.setAttribute('aria-hidden', 'true'); button.append(frame);
    }
    if (!button.querySelector(':scope > .discovery-selection-mark')) {
      const mark = document.createElement('span'); mark.className = 'discovery-selection-mark'; mark.textContent = '✓ 已选中'; mark.setAttribute('aria-hidden', 'true'); button.append(mark);
    }
  });
  const live = () => !disposed && root.isConnected && !root.closest('[inert], [hidden], .closing, [data-ui-closing]') && isCurrent();
  const available = button => button && button.isConnected && root.contains(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true';
  const paint = () => {
    options.forEach(button => {
      const chosen = button === selected;
      button.classList.toggle('discovery-selected', chosen);
      button.dataset.discoverySelected = String(chosen);
      button.setAttribute('aria-pressed', String(chosen));
    });
    if (confirmButton) confirmButton.disabled = busy || submitted || !selected;
    if (cancelButton) cancelButton.disabled = busy || submitted;
    root.setAttribute('data-discovery-busy', String(busy));
    root.setAttribute('aria-busy', String(busy));
  };
  const showStatus = message => {
    if (!live()) return;
    if (!status) { status = document.createElement('p'); status.className = 'discovery-selection-status'; status.setAttribute('role', 'status'); root.append(status); }
    status.textContent = message;
  };
  const reportError = (error, operation) => {
    showStatus(`${operation}未完成，请重试。`);
    try { onError?.(error); } catch { /* The primary failure is already visible. */ }
  };
  const select = button => {
    if (!live() || busy || submitted || !options.includes(button) || !available(button)) return false;
    selected = button; if (status) status.textContent = ''; paint(); return true;
  };
  const reveal = button => {
    for (let pane = button.parentElement; pane && root.contains(pane); pane = pane.parentElement) {
      if (pane.scrollWidth <= pane.clientWidth && pane.scrollHeight <= pane.clientHeight) continue;
      const item = button.getBoundingClientRect(), box = pane.getBoundingClientRect();
      pane.scrollLeft += item.left < box.left ? item.left - box.left : item.right > box.right ? item.right - box.right : 0;
      pane.scrollTop += item.top < box.top ? item.top - box.top : item.bottom > box.bottom ? item.bottom - box.bottom : 0;
    }
  };
  const confirm = async () => {
    if (!live() || busy || submitted || !selected || !available(selected)) return false;
    const button = selected;
    busy = true; paint();
    try {
      const result = await onConfirm(button.dataset, button);
      if (result !== false) submitted = true;
      else showStatus('确认未完成，请重试。');
      return result !== false;
    } catch (error) { reportError(error, '确认'); return false; }
    finally { busy = false; if (live()) paint(); else dispose(); }
  };
  const finishCancel = result => {
    busy = false;
    if (result !== false) {
      const returnFocus = selected;
      selected = null;
      if (live()) { paint(); if (returnFocus?.isConnected) returnFocus.focus({preventScroll:true}); }
      else dispose();
      return true;
    }
    if (live()) { showStatus('取消未完成，请重试。'); paint(); } else dispose();
    return false;
  };
  const cancel = () => {
    if (!live() || busy || submitted) return false;
    busy = true; paint();
    try {
      const result = onCancel();
      if (result && typeof /** @type {{then?:unknown}} */ (result).then === 'function') {
        return Promise.resolve(result).then(finishCancel, error => { reportError(error, '取消'); return finishCancel(false); });
      }
      return finishCancel(result);
    } catch (error) { reportError(error, '取消'); return finishCancel(false); }
  };
  // The battle keeps its final domain handler; DOM capture only stages candidates.
  if (selectAct) UI.act(selectAct, data => select(options.find(button => button.dataset.i === String(data?.i))));
  UI.act(confirmAct, confirm); UI.act(cancelAct, cancel);
  const handleClick = event => {
    if (!(event.target instanceof Element)) return;
    const option = event.target.closest(optionSelector);
    const action = event.target.closest('[data-act]')?.getAttribute('data-act');
    if (!option && action !== confirmAct && action !== cancelAct) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (option instanceof HTMLButtonElement) select(option);
    else if (action === confirmAct) void confirm();
    else void cancel();
  };
  const handleKeydown = event => {
    if (event.isComposing || event.keyCode === 229 || event.ctrlKey || event.altKey || event.metaKey
      || !(event.target instanceof Element) || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (!['ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(event.key)) return;
    if (event.key === 'Enter' && event.target.closest('button,a')
      && !event.target.closest(optionSelector) && event.target !== confirmButton && event.target !== cancelButton) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (!live() || busy || submitted) return;
    if (event.key === 'Escape') { void cancel(); return; }
    if (event.key === 'Enter') {
      const target = event.target.closest(optionSelector);
      if (target instanceof HTMLButtonElement) { if (select(target)) confirmButton?.focus({preventScroll:true}); }
      else if (event.target === cancelButton) void cancel();
      else void confirm();
      return;
    }
    const ready = options.filter(available);
    if (!ready.length) return;
    const focused = options.find(button => button === event.target);
    const index = ready.indexOf(selected || focused);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = index < 0 ? ready[direction > 0 ? 0 : ready.length - 1]
      : ready[(index + direction + ready.length) % ready.length];
    if (select(next)) { reveal(next); next.focus({preventScroll:true}); }
  };
  root.addEventListener('click', handleClick, true);
  root.addEventListener('keydown', handleKeydown, true);
  const releaseOwner = registerScreenOwner({ root, priority:30, isCurrent:live, onBack:() => {
    if (document.activeElement instanceof Element && root.contains(document.activeElement)
      && document.activeElement.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (live()) void cancel(); else dispose();
  } });
  const dispose = () => {
    if (disposed) return;
    disposed = true; releaseOwner();
    root.removeEventListener('click', handleClick, true);
    root.removeEventListener('keydown', handleKeydown, true);
    if (bindings.get(root)?.dispose === dispose) bindings.delete(root);
  };
  bindings.set(root, {dispose, selected:() => selected});
  paint();
  return { select, confirm, cancel, release:dispose };
}
