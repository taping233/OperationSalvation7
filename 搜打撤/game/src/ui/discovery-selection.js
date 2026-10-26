import { registerScreenOwner } from './screen-owner.js';
import { isAvailableControl } from './action-dispatch.js';
import { escAttr, esc } from '../core/shared.js';
import '../../css/discovery-selection.css';

export function discoveryActionsHTML({ confirmAct, cancelAct, cancelLabel = '取消', confirmLabel = '确认' }) {
  return `<div class="ov-btns discovery-selection-actions"><button type="button" class="ov-btn" data-act="${escAttr(cancelAct)}" data-cancel="true">${esc(cancelLabel)}</button><button type="button" class="ov-btn ok" data-act="${escAttr(confirmAct)}" data-cancel="false" disabled>${esc(confirmLabel)}</button></div>`;
}

/** @typedef {{selected:HTMLButtonElement|null,busy:boolean,submitted:boolean,message:string}} DiscoverySession */
/** @type {WeakMap<HTMLElement, {dispose:()=>void,live:()=>boolean,paint:()=>void,options:HTMLButtonElement[],optionSelector:string,confirmAct:string,cancelAct:string,state:DiscoverySession,onError?:(error:unknown)=>void}>} */
const bindings = new WeakMap();

/**
 * Selection is local presentation state. Only confirmation crosses the domain port.
 * Cancelling may reject synchronously or asynchronously without clearing selection.
 * Rebinding the same live candidate nodes continues their selection and submission.
 * @param {{ UI:{act:(name:string,handler:Function)=>void}, root:HTMLElement,
 * optionSelector:string, selectAct?:string, confirmAct:string, cancelAct:string, isCurrent:()=>boolean,
 * onConfirm:(data:DOMStringMap,button:HTMLButtonElement)=>unknown,
 * onCancel:()=>unknown, onError?:(error:unknown)=>void }} ports
 */
export function bindDiscoverySelection(ports) {
  const { UI, root, optionSelector, selectAct, confirmAct, cancelAct, isCurrent, onConfirm, onCancel, onError } = ports;
  const previous = bindings.get(root);
  const options = [...root.querySelectorAll(optionSelector)].filter(node => node instanceof HTMLButtonElement);
  const sameSelection = previous?.live() && previous.optionSelector === optionSelector
    && previous.confirmAct === confirmAct && previous.cancelAct === cancelAct
    && previous.options.length === options.length && previous.options.every((button, index) => button === options[index]);
  const state = sameSelection ? previous.state : {selected:null,busy:false,submitted:false,message:''};
  previous?.dispose();
  let disposed = false;
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
  const available = button => button && button.isConnected && root.contains(button)
    && !button.closest('[aria-disabled="true"], .off') && isAvailableControl(button);
  const paint = () => {
    if (!available(state.selected)) state.selected = null;
    const {selected, busy, submitted} = state;
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
    if (state.message && !status) { status = document.createElement('p'); status.className = 'discovery-selection-status'; status.setAttribute('role', 'status'); root.append(status); }
    if (status) status.textContent = state.message;
  };
  const currentBinding = () => { const binding = bindings.get(root); return binding?.state === state ? binding : null; };
  const refresh = () => {
    const binding = currentBinding();
    if (binding?.live()) binding.paint(); else binding?.dispose();
  };
  const restoreActionFocus = (action, hadFocus) => {
    const doc = root.ownerDocument;
    if (!hadFocus || !currentBinding()?.live() || doc.activeElement !== doc.body) return;
    const button = /** @type {HTMLButtonElement|null} */ (root.querySelector(`[data-act="${action}"]`));
    if (available(button)) button.focus({preventScroll:true});
  };
  const showStatus = message => {
    state.message = message; refresh();
  };
  const reportError = (error, operation) => {
    const binding = currentBinding();
    if (!binding?.live()) return;
    showStatus(`${operation}未完成，请重试。`);
    try { binding.onError?.(error); } catch { /* The primary failure is already visible. */ }
  };
  const select = button => {
    if (!live() || state.busy || state.submitted || !options.includes(button) || !available(button)) return false;
    state.selected = button; state.message = ''; paint(); return true;
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
    if (!live() || state.busy || state.submitted || !state.selected || !available(state.selected)) return false;
    const button = state.selected;
    const hadFocus = root.ownerDocument.activeElement === confirmButton;
    state.busy = true; state.message = ''; paint();
    try {
      const result = await onConfirm(button.dataset, button);
      if (result !== false) state.submitted = true;
      else showStatus('确认未完成，请重试。');
      return result !== false;
    } catch (error) { reportError(error, '确认'); return false; }
    finally {
      state.busy = false; refresh();
      if (!state.submitted) restoreActionFocus(confirmAct, hadFocus);
    }
  };
  const finishCancel = (result, hadFocus = false) => {
    state.busy = false;
    if (result !== false) {
      const returnFocus = state.selected;
      state.selected = null; state.message = ''; refresh();
      if (currentBinding()?.live() && available(returnFocus)) returnFocus.focus({preventScroll:true});
      return true;
    }
    showStatus('取消未完成，请重试。');
    restoreActionFocus(cancelAct, hadFocus);
    return false;
  };
  const cancel = () => {
    if (!live() || state.busy || state.submitted) return false;
    const hadFocus = root.ownerDocument.activeElement === cancelButton;
    state.busy = true; state.message = ''; paint();
    try {
      const result = onCancel();
      if (result && typeof /** @type {{then?:unknown}} */ (result).then === 'function') {
        return Promise.resolve(result).then(value => finishCancel(value, hadFocus), error => { reportError(error, '取消'); return finishCancel(false, hadFocus); });
      }
      return finishCancel(result, hadFocus);
    } catch (error) { reportError(error, '取消'); return finishCancel(false, hadFocus); }
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
    if (!live() || state.busy || state.submitted) return;
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
    const index = ready.indexOf(state.selected || focused);
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
  bindings.set(root, {dispose,live,paint,options,optionSelector,confirmAct,cancelAct,state,onError});
  paint();
  return { select, confirm, cancel, release:dispose };
}
