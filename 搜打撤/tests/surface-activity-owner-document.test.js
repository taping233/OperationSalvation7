// @vitest-environment node
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import { manageSurfaceActivity } from '../game/src/ui/surface-activity.js';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

it('uses the retained surface document for queued activity and motion preferences', async () => {
  const dom = new JSDOM('<main id="surface"></main>', { pretendToBeVisual:true });
  const win = dom.window, doc = win.document, root = doc.getElementById('surface');
  vi.stubGlobal('MutationObserver', win.MutationObserver);
  vi.stubGlobal('Element', win.Element);
  vi.stubGlobal('getComputedStyle', win.getComputedStyle.bind(win));
  expect(typeof document).toBe('undefined');
  root.getClientRects = () => [{ width:100, height:100 }];
  const animation = {
    effect:{ target:root, getTiming:() => ({ iterations:Infinity }) }, playState:'running',
    pause:vi.fn(() => { animation.playState = 'paused'; }),
    play:vi.fn(() => { animation.playState = 'running'; }),
  };
  root.getAnimations = () => [animation];
  const dispose = manageSurfaceActivity(root);
  try {
    expect(root.dataset.uiActivity).toBe('active');
    doc.body.classList.add('reduce-motion');
    await flush();
    expect(animation.pause).toHaveBeenCalledOnce();
    doc.body.classList.remove('reduce-motion');
    await flush();
    expect(animation.play).toHaveBeenCalledOnce();
    root.hidden = true;
    await flush();
    expect(root.dataset.uiActivity).toBe('paused');
    root.hidden = false;
    await flush();
    expect(root.dataset.uiActivity).toBe('active');
  } finally {
    dispose();
    dom.window.close();
  }
  await flush();
  expect(root.dataset.uiActivity).toBeUndefined();
});
