import { afterEach, expect, it, vi } from 'vitest';
import { bindDiscoverySelection, discoveryActionsHTML } from '../game/src/ui/discovery-selection.js';

const markup = () => `<div class="choices"><button data-act="pick" data-i="0">甲</button><button data-act="pick" data-i="1">乙</button></div>${discoveryActionsHTML({confirmAct:'confirm',cancelAct:'cancel'})}`;
const bindings = [];
afterEach(() => { bindings.splice(0).forEach(binding => binding.release()); document.body.replaceChildren(); });
function bind(root, {onConfirm=vi.fn(() => true), onCancel=vi.fn(() => true), onError=vi.fn()} = {}) {
  const acts = {};
  const controls = bindDiscoverySelection({UI:{act:(name, handler) => {acts[name]=handler;}},root,
    optionSelector:'[data-act="pick"]',selectAct:'pick',confirmAct:'confirm',cancelAct:'cancel',
    isCurrent:() => true,onConfirm,onCancel,onError});
  bindings.push(controls);
  return {controls,acts,onConfirm,onCancel,onError};
}
function setup(ports) {
  document.body.innerHTML = `<section>${markup()}</section>`;
  const root=document.querySelector('section');
  return {root,...bind(root,ports)};
}

it('keeps one pending confirmation across rebinds and retries the same selected card in place', async () => {
  let finish;
  const first=setup({onConfirm:vi.fn(() => new Promise(resolve => {finish=resolve;}))});
  const choice=first.root.querySelector('[data-i="1"]'), row=first.root.querySelector('.choices');
  first.controls.select(choice); row.scrollLeft=120; row.scrollTop=70;
  const pending=first.controls.confirm(), next=bind(first.root);
  expect(first.root.getAttribute('aria-busy')).toBe('true');
  expect(await next.acts.confirm()).toBe(false);
  expect(next.acts.cancel()).toBe(false);
  first.root.querySelector('[data-act="confirm"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
  expect(next.onConfirm).not.toHaveBeenCalled();
  finish(false); expect(await pending).toBe(false);
  expect(first.root.getAttribute('aria-busy')).toBe('false');
  expect(choice.dataset.discoverySelected).toBe('true');
  expect(row.scrollLeft).toBe(120); expect(row.scrollTop).toBe(70);
  expect(await next.acts.confirm()).toBe(true);
  expect(next.onConfirm).toHaveBeenCalledExactlyOnceWith(choice.dataset,choice);
});

it('retains a successful submission after the same live choices are rebound', async () => {
  const first=setup(); first.controls.select(first.root.querySelector('[data-i="0"]'));
  expect(await first.controls.confirm()).toBe(true);
  const next=bind(first.root);
  expect(first.root.querySelector('[data-act="confirm"]').disabled).toBe(true);
  expect(await next.acts.confirm()).toBe(false);
  expect(next.onConfirm).not.toHaveBeenCalled();
});

it('keeps asynchronous cancellation busy through a rebind and preserves a rejected selection', async () => {
  let finish;
  const first=setup({onCancel:vi.fn(() => new Promise(resolve => {finish=resolve;}))});
  const choice=first.root.querySelector('[data-i="0"]'); first.controls.select(choice);
  const pending=first.controls.cancel(), next=bind(first.root);
  expect(await next.controls.confirm()).toBe(false); expect(next.controls.cancel()).toBe(false);
  expect(next.onConfirm).not.toHaveBeenCalled(); expect(next.onCancel).not.toHaveBeenCalled();
  finish(false); expect(await pending).toBe(false);
  expect(choice.dataset.discoverySelected).toBe('true');
  expect(first.root.querySelector('[data-act="confirm"]').disabled).toBe(false);
  expect(next.controls.cancel()).toBe(true);
  expect(choice.dataset.discoverySelected).toBe('false'); expect(document.activeElement).toBe(choice);
});

it('settles a carried confirmation into the active binding exactly once', async () => {
  let finish;
  const first=setup({onConfirm:vi.fn(() => new Promise(resolve => {finish=resolve;}))});
  first.controls.select(first.root.querySelector('[data-i="0"]'));
  const pending=first.controls.confirm(), next=bind(first.root);
  finish(true); expect(await pending).toBe(true);
  expect(first.root.getAttribute('aria-busy')).toBe('false');
  expect(first.root.querySelector('[data-act="confirm"]').disabled).toBe(true);
  expect(await next.controls.confirm()).toBe(false); expect(next.onConfirm).not.toHaveBeenCalled();
});

it('keeps a replacement candidate set independent of an old rejected request', async () => {
  let rejectOld, finishNew;
  const first=setup({onConfirm:vi.fn(() => new Promise((_resolve,reject) => {rejectOld=reject;}))});
  first.controls.select(first.root.querySelector('[data-i="0"]'));
  const oldPending=first.controls.confirm();
  first.root.innerHTML=markup();
  const next=bind(first.root,{onConfirm:vi.fn(() => new Promise(resolve => {finishNew=resolve;}))});
  const choice=first.root.querySelector('[data-i="1"]'); next.controls.select(choice);
  const newPending=next.controls.confirm();
  rejectOld(new Error('old save failed')); expect(await oldPending).toBe(false);
  expect(first.onError).not.toHaveBeenCalled(); expect(next.onError).not.toHaveBeenCalled();
  expect(first.root.getAttribute('aria-busy')).toBe('true');
  expect(choice.dataset.discoverySelected).toBe('true');
  expect(first.root.querySelector('[role="status"]')).toBeNull();
  finishNew(false); expect(await newPending).toBe(false);
  expect(first.root.getAttribute('aria-busy')).toBe('false');
  expect(first.root.querySelector('[role="status"]').textContent).toContain('确认未完成');
});

it('clears a rebound selection when the original candidate is no longer available', () => {
  const first=setup(), choice=first.root.querySelector('[data-i="0"]'); first.controls.select(choice);
  choice.disabled=true; const next=bind(first.root);
  expect(choice.dataset.discoverySelected).toBe('false');
  expect(first.root.querySelector('[data-act="confirm"]').disabled).toBe(true);
  expect(next.controls.cancel()).toBe(true);
});
