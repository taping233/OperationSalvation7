// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { navigationChange, navigationState, navigationTiming } from '../game/src/ui/navigation-motion.js';
import { pageMotionProfile, pageMotionBlocks } from '../game/src/ui/page-motion-profiles.js';
import { enterSurface } from '../game/src/ui/surface-motion.js';
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

it('returning through room and detail navigation reverses the spatial direction', () => {
  const cards = { room: 'stash', view: 'stash/cards' };
  const pocket = { room: 'stash', view: 'stash/pocket' };
  const shop = { room: 'shop', view: 'shop/goods' };
  expect(navigationChange(cards, pocket)).toMatchObject({ detail: true, x: 14, duration: 220 });
  expect(navigationChange(pocket, cards).x).toBe(-14);
  expect(navigationChange(cards, shop)).toMatchObject({ detail: false, x: 28 });
  expect(navigationChange(shop, cards).x).toBe(-28);
  expect(navigationChange(cards, cards).changed).toBe(false);
});

it('base entry has bounded travel independent of viewport position and includes the heading', () => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><main id="hubMain" class="base-camp" data-page="stash"><button class="hub-tab on" data-tab="stash"></button><section class="hub-page" data-view="stash/cards"><header class="camp-section-head">Cards</header><nav class="warehouse-controls-v12">Filters</nav><div class="warehouse-inventory-v12">Inventory</div><aside class="warehouse-reading-v12">Details</aside></section></main></div></div>';
  const root = document.getElementById('overlay');
  const hub = document.getElementById('hubMain');
  expect(navigationState(hub)).toEqual({ room: 'stash', view: 'stash/cards' });
  const profile = pageMotionProfile(root.querySelector('#ovBody'));
  for (const { el } of pageMotionBlocks(profile)) vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => { throw new Error('Navigation must not measure offscreen travel'); });
  enterSurface(root, { navigation: navigationChange({ room: 'shop', view: 'shop/goods' }, navigationState(hub)) });
  const regions = [...root.querySelectorAll('[data-surface-role]')];
  expect(regions).toHaveLength(4);
  expect(regions[0].dataset.surfaceRole).toBe('heading');
  for (const region of regions) {
    expect(region.style.getPropertyValue('--base-region-x')).toBe('-28px');
    expect(parseFloat(region.style.getPropertyValue('--surface-delay'))).toBeLessThanOrEqual(navigationTiming.staggerMax);
  }
  enterSurface(root, { navigation: navigationChange(navigationState(hub), { room: 'stash', view: 'stash/pocket' }) });
  expect(regions[0].style.getPropertyValue('--base-region-x')).toBe('14px');
  expect(regions[0].style.getPropertyValue('--surface-region-in')).toBe('220ms');
});
