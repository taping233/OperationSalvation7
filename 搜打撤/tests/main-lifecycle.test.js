import { afterEach, expect, it, vi } from 'vitest';
import { releaseMainPage, trackMainPagePreparation } from './helpers/main-lifecycle.js';

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

it('awaits the real map preparation and its cancelled visual finally before releasing the page', async () => {
  document.body.innerHTML = '<div id="overlay" hidden><div id="ovBody"></div></div>';
  const overlay = document.getElementById('overlay');
  let resolvePreparation;
  const preparation = new Promise(resolve => { resolvePreparation = resolve; });
  const prepare = vi.fn(() => preparation);
  window.SDT = { Renderer: { prepare } };
  trackMainPagePreparation();
  const { stageMapReturn } = await import('../game/src/ui/page-visual-ready.js');
  const remove = vi.spyOn(window, 'removeEventListener');
  stageMapReturn({ el: { overlay, ovBody: document.getElementById('ovBody') } }, {
    discoveredPairs: [], runActive: true, battleActive: false, nestActive: false,
  });
  await vi.waitFor(() => expect(prepare).toHaveBeenCalledOnce());
  const released = releaseMainPage();
  const checkpoint = (async () => {
    for (let frame = 0; frame < 4; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    return 'preparation-pending';
  })();
  expect(await Promise.race([released.then(() => 'page-released'), checkpoint])).toBe('preparation-pending');
  expect(document.querySelector('.page-visual-handoff')).toBeNull();
  const removals = remove.mock.calls.length;
  resolvePreparation(false);
  await released;
  expect(remove.mock.calls.length).toBeGreaterThan(removals);
  expect(window.SDT.Renderer.prepare).toBe(prepare);
  expect(document.body.childElementCount).toBe(0);
});
