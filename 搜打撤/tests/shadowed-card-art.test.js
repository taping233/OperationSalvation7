import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import artMapping from '../game/data/art-mapping.json';
import thumbnails from '../game/src/generated/thumb-manifest.js';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';

const originals = RUNTIME_REDUNDANCY_REVIEW.candidates
  .filter(candidate => candidate.category === 'shadowed-card-art' && candidate.path.startsWith('cards/'))
  .map(candidate => ({ path: candidate.path, id: candidate.path.replace(/^cards\/(?:spell|equip)-|\.webp$/g, '') }));
const oldPaths = new Set(originals.flatMap(candidate => [candidate.path, `thumbs/${candidate.path}`]));
const renderedPath = html => /(?:src|data-lib-src)="([^"]+)"/.exec(html)?.[1].split('?')[0].replace(/^assets\//, '');

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  window.SDT = { Icons: { img: () => '', TYPE_ART: {} } };
  vi.stubGlobal('scheduler', { postTask: vi.fn(() => Promise.resolve()) });
  vi.stubGlobal('requestIdleCallback', vi.fn());
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  vi.doUnmock('../game/src/generated/thumb-manifest.js');
});
async function load(removeReplacementThumbnails = false) {
  const replacementPaths = new Set(originals.map(candidate => artMapping.cardArtOverrides[candidate.id]));
  const retained = thumbnails.filter(asset => !oldPaths.has(`thumbs/${asset}`)
    && (!removeReplacementThumbnails || !replacementPaths.has(asset)));
  vi.doMock('../game/src/generated/thumb-manifest.js', () => ({ default: retained }));
  await import('../game/src/cards/cards.js');
  await import('../game/src/core/art.js');
  const { DATA } = await import('../game/src/core/data-loader.js');
  const { Cards, Art } = window.SDT;
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  window.SDT.Icons.TYPE_ART = Cards.TYPE_ART;
  return { Art, Cards, DATA };
}

describe('published shadowed card artwork stays visually unchanged', () => {
  it('renders full, low and deferred images using the immutable override for live and incomplete historical cards', async () => {
    const { Art, Cards, DATA } = await load();
    expect(originals).toHaveLength(15);
    expect(Object.isFrozen(DATA.art.cardArtOverrides)).toBe(true);
    for (const candidate of originals) {
      const active = Cards.all().find(card => card.id === candidate.id);
      expect(active).toBeTruthy();
      for (const card of [active, { id: candidate.id }, { ...active, cls: null, art: candidate.path, type: '生物' }]) {
        for (const low of [false, true]) for (const defer of [false, true]) {
          const html = Art.cardIcon(card, { low, defer });
          expect(renderedPath(html)).toBe(`${low ? 'thumbs/' : ''}${artMapping.cardArtOverrides[candidate.id]}`);
          expect(html).toContain(`data-asset-key="card-${candidate.id}"`);
          expect(html).not.toContain(candidate.path);
          if (defer) expect(html).toContain('data-lib-src=');
        }
      }
      expect(Cards.cardHTML(active)).toContain(`assets/${artMapping.cardArtOverrides[candidate.id]}`);
      expect(Cards.cardHTML(active, '', { low: true })).toContain(`assets/thumbs/${artMapping.cardArtOverrides[candidate.id]}`);
    }
  });

  it('falls back to the current override original when a replacement thumbnail is absent', async () => {
    const { Art } = await load(true);
    for (const candidate of originals) {
      const html = Art.cardIcon({ id: candidate.id }, { low: true });
      expect(renderedPath(html)).toBe(artMapping.cardArtOverrides[candidate.id]);
      expect(html).not.toContain(candidate.path);
    }
  });

  it('never renders or collects a retired original or thumbnail for the entire live card catalog', async () => {
    const { Art, Cards } = await load();
    const all = Cards.all(); expect(all.length).toBeGreaterThan(200);
    for (const card of all) for (const low of [false, true]) {
      expect(oldPaths.has(renderedPath(Art.cardIcon(card, { low })))).toBe(false);
    }
    for (const url of Art.collectCardAssets(all)) expect(oldPaths.has(url.split('?')[0].replace(/^assets\//, ''))).toBe(false);
  });
});
