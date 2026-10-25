// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../game/src/ui/motion-transitions.js', () => ({}));
import data from '../game/data/achievements.json';
import { achievementGalleryHTML, bindAchievementGallery } from '../game/src/ui/achievement-gallery.js';
import { overlayMethods } from '../game/src/ui/overlay.js';

const inertDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'inert');
afterEach(() => {
  if (inertDescriptor) Object.defineProperty(HTMLElement.prototype, 'inert', inertDescriptor);
  else delete HTMLElement.prototype.inert;
  document.body.replaceChildren();
});
function gallery() {
  Object.defineProperty(HTMLElement.prototype, 'inert', { configurable: true,
    get() { return this.hasAttribute('inert'); },
    set(value) { this.toggleAttribute('inert', !!value); },
  });
  document.body.className = 'reduce-motion';
  document.body.innerHTML = '<div id="overlay" tabindex="-1"><div id="ovBody"></div></div>';
  const overlay = document.querySelector('#overlay');
  const body = document.querySelector('#ovBody');
  body.innerHTML = achievementGalleryHTML({ achievements: data.achievements, base: null, slot: null,
    isUnlocked: () => false, backs: [], cards: [], random: () => 0 });
  const root = body.firstElementChild;
  bindAchievementGallery(root);
  const UI = { ...overlayMethods, _lastMode: 'page', el: { overlay, ovBody: body } };
  const leaveGallery = vi.fn();
  root.querySelector('[data-act="achBack"]').addEventListener('click', leaveGallery);
  const tile = root.querySelector('[data-gallery-item]');
  const detail = root.querySelector('.ag-detail');
  tile.click();
  return { root, tile, detail, UI, overlay, leaveGallery };
}

describe('achievement nested detail dismissal', () => {
  it('provides a visible cancel action to shared Escape while keeping navigation interactive', () => {
    const { root, tile, detail, UI, leaveGallery } = gallery();
    expect(root.querySelector('.ag-header').hasAttribute('inert')).toBe(false);
    expect(UI._findCancelBtn()?.closest('.ag-detail')).toBe(detail);
    expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(detail.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    expect(leaveGallery).not.toHaveBeenCalled();
  });
  it('the capture-phase shared route closes only the detail and restores its trigger', () => {
    const { detail, tile, overlay, UI, leaveGallery } = gallery();
    overlay.addEventListener('keydown', event => {
      if (event.key === 'Escape' && UI.closeTopOverlayByEsc()) {
        event.preventDefault(); event.stopPropagation();
      }
    }, true);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    detail.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(detail.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    expect(leaveGallery).not.toHaveBeenCalled();
    expect(overlay.hidden).toBe(false);
  });

  it('the visible close button preserves cached content and the detail has no modal backdrop', () => {
    const { root, tile, detail, leaveGallery } = gallery();
    const content = detail.querySelector('.ag-detail-content').firstElementChild;
    detail.querySelector('[data-gallery-dismiss]').click();
    expect(detail.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    tile.click();
    expect(detail.querySelector('.ag-detail-content').firstElementChild).toBe(content);
    expect(root.querySelector('.ag-detail-backdrop')).toBeNull();
    detail.querySelector('[data-gallery-dismiss]').click();
    expect(detail.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    expect(leaveGallery).not.toHaveBeenCalled();
  });

  it('standalone Escape closes the detail, but composition and repeated keys do not', () => {
    const { detail, tile, leaveGallery } = gallery();
    for (const options of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }]) {
      detail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, ...options }));
      expect(detail.hidden).toBe(false);
    }
    detail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(detail.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    expect(leaveGallery).not.toHaveBeenCalled();
  });

});
