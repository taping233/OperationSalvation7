import { vi } from 'vitest';

const preparations = new Set();
const renderers = new Map();

// Keep the real implementation and returned Promise; observe readiness work so
// teardown can await a map-return continuation already inside Renderer.prepare.
export function trackMainPagePreparation() {
  const renderer = window.SDT?.Renderer;
  if (!renderer?.prepare || renderers.has(renderer)) return;
  const original = renderer.prepare;
  const wrapped = function (...args) {
    const result = original.apply(this, args);
    if (result && typeof result.then === 'function') {
      const task = Promise.resolve(result);
      preparations.add(task);
      task.then(() => preparations.delete(task), () => preparations.delete(task));
    }
    return result;
  };
  renderers.set(renderer, { original, wrapped });
  renderer.prepare = wrapped;
}

// Release a real main.js page before jsdom destroys its globals. Observers must
// consume the final DOM changes and finish their next-frame work while it exists.
export async function releaseMainPage() {
  const [{ cancelPendingPageEntries }, { cancelPageVisual }] = await Promise.all([
    import('../../game/src/ui/page-entry-cancellation.js'),
    import('../../game/src/ui/page-visual-ready.js'),
  ]);
  cancelPendingPageEntries();
  cancelPageVisual();
  await vi.dynamicImportSettled();
  const ui = window.SDT?.UI;
  document.getElementById('cardZoom')?._closeCardZoom?.(true);
  ui?.hideOverlay?.({ immediate: true });
  ui?.endRoom?.();
  cancelPageVisual();
  if (vi.isFakeTimers()) {
    await vi.waitFor(() => {
      if (preparations.size) throw new Error('Map preparation is still running during page teardown');
    }, { timeout: 5000, interval: 50 });
  } else {
    while (preparations.size) await Promise.all([...preparations]);
  }
  // The awaiting visual body must run its finally after the preparation settles.
  await Promise.resolve();
  document.body.replaceChildren();
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(50);
  else await new Promise(resolve => setTimeout(resolve, 50));
  for (const [renderer, { original, wrapped }] of renderers) {
    if (renderer.prepare === wrapped) renderer.prepare = original;
  }
  renderers.clear();
}
