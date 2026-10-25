import { afterEach, expect, it, vi } from 'vitest';
import { createEventDiceController } from '../game/src/ui/event-dice.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function pendingOpen() {
  document.body.innerHTML = '<div id="ovBody"><main>原事件</main></div>';
  const body = document.getElementById('ovBody'), original = body.firstElementChild;
  let resolve;
  const saved = new Promise(done => { resolve = done; });
  const show = vi.fn(({body:html}) => { body.innerHTML = html; });
  const onLeave = vi.fn(() => { body.innerHTML = '<main>被旧事件关闭</main>'; });
  const controller = createEventDiceController({
    UI:{ el:{ ovBody:body }, act() {} }, SDT:{}, save:() => saved, show,
    bind:() => () => true, onLeave,
  });
  return { body, original, resolve, show, onLeave, controller };
}

it('a failed initial dice save cannot close a replacement run', async () => {
  const h = pendingOpen();
  let valid = true;
  const opening = h.controller.open({ owner:{}, key:'roll', title:'骰子', outcomes:[{label:'币',value:1}], current:() => valid });
  valid = false; h.body.innerHTML = '<main>新对局</main>';
  h.resolve(false);
  expect(await opening).toBe(false);
  expect(h.onLeave).not.toHaveBeenCalled();
  expect(h.body.textContent).toBe('新对局');
});

it.each([true,false])('an initial dice save result %s leaves a newly opened menu intact', async saved => {
  const h = pendingOpen();
  const opening = h.controller.open({ owner:{}, key:'roll', title:'骰子', outcomes:[{label:'币',value:1}],
    openingCurrent:() => h.body.firstElementChild === h.original });
  h.body.innerHTML = '<main>系统菜单</main>';
  h.resolve(saved);
  expect(await opening).toBe(false);
  expect(h.show).not.toHaveBeenCalled(); expect(h.onLeave).not.toHaveBeenCalled();
  expect(h.body.textContent).toBe('系统菜单');
});

it('a failed initial save still leaves the current event through its normal retry path', async () => {
  const h = pendingOpen();
  const opening = h.controller.open({ owner:{}, key:'roll', title:'骰子', outcomes:[{label:'币',value:1}] });
  h.resolve(false);
  expect(await opening).toBe(false);
  expect(h.onLeave).toHaveBeenCalledOnce();
});
