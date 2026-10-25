import { afterEach, expect, it, vi } from 'vitest';
import { bindDiscoverySelection, discoveryActionsHTML } from '../game/src/ui/discovery-selection.js';

let controls;
afterEach(() => { controls?.release(); document.body.replaceChildren(); });
function setup() {
  document.body.innerHTML = `<section><button data-act="pick" data-i="0">候选</button>${discoveryActionsHTML({ confirmAct:'confirm', cancelAct:'cancel' })}<button data-extra>其他操作</button><input></section>`;
  const root = document.querySelector('section'), onConfirm = vi.fn(() => true);
  controls = bindDiscoverySelection({ UI:{act() {}}, root, optionSelector:'[data-act="pick"]', confirmAct:'confirm', cancelAct:'cancel',
    isCurrent:() => true, onConfirm, onCancel:() => true });
  return { root, onConfirm, option:root.querySelector('[data-act="pick"]'), confirm:root.querySelector('[data-act="confirm"]') };
}

it('holding Enter to select cannot activate the newly focused confirmation button through native repeat', async () => {
  const h = setup();
  h.option.focus();
  h.option.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  expect(document.activeElement).toBe(h.confirm);
  const repeated = new KeyboardEvent('keydown', { key:'Enter', repeat:true, bubbles:true, cancelable:true });
  // Model the browser's native button activation only when keydown was not cancelled.
  if (h.confirm.dispatchEvent(repeated)) h.confirm.click();
  await Promise.resolve();
  expect(repeated.defaultPrevented).toBe(true);
  expect(h.onConfirm).not.toHaveBeenCalled();
  h.confirm.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
  await Promise.resolve();
  expect(h.onConfirm).toHaveBeenCalledOnce();
});

it('does not suppress repeated Enter in independent controls or text editing', () => {
  const h = setup();
  for (const target of [h.root.querySelector('[data-extra]'), h.root.querySelector('input')]) {
    const event = new KeyboardEvent('keydown', { key:'Enter', repeat:true, bubbles:true, cancelable:true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  }
});
