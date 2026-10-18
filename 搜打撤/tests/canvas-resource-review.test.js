import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
const html = readFileSync('game/dev/canvas-resource-review.html', 'utf8');
function fixture(query = '') {
  const paint = vi.fn(), raf = vi.fn(() => 7), cancel = vi.fn();
  const dom = new JSDOM(html, { url: `https://example.test/dev/canvas-resource-review.html${query}`, runScripts: 'dangerously',
    beforeParse(window) {
      window.HTMLCanvasElement.prototype.getContext = () => ({ fillRect: paint });
      window.requestAnimationFrame = raf; window.cancelAnimationFrame = cancel;
      window.setInterval = vi.fn();
    } });
  return { dom, doc: dom.window.document, paint, raf, cancel };
}
describe('isolated canvas resource review', () => {
  it('default is one static canvas without game styles or ongoing RAF', () => {
    const { dom, doc, paint, raf } = fixture();
    expect(doc.querySelectorAll('canvas')).toHaveLength(1);
    expect(doc.querySelectorAll('link')).toHaveLength(0);
    expect(paint).toHaveBeenCalledTimes(2); expect(raf).not.toHaveBeenCalled();
    expect(doc.querySelector('#status').textContent).toContain('Canvas=static'); dom.window.close();
  });
  it('CSS-only mode preserves viewport pseudo-element selectors without a canvas', () => {
    const { dom, doc, paint, raf } = fixture('?css=map&canvas=none');
    expect(doc.querySelector('canvas')).toBeNull(); expect(doc.querySelector('#viewport')).not.toBeNull();
    expect([...doc.querySelectorAll('link')].some(link => link.href.endsWith('/css/expedition-map.css'))).toBe(true);
    doc.querySelector('#dynamic').click(); expect(paint).not.toHaveBeenCalled(); expect(raf).not.toHaveBeenCalled();
    doc.querySelector('#cssToggle').click(); expect(doc.body.classList.contains('probe-stop-css')).toBe(true); dom.window.close();
  });
  it('can start paused with only the snow stylesheet', () => {
    const { dom, doc, raf } = fixture('?css=snow-only&canvas=none&paused=1');
    expect(doc.querySelectorAll('link')).toHaveLength(1);
    expect(doc.body.classList.contains('probe-stop-css')).toBe(true);
    expect(raf).not.toHaveBeenCalled(); dom.window.close();
  });
  it.each(['stop-snow', 'only-snow'])('exposes selective ambient mode %s', mode => {
    const { dom, doc } = fixture('?css=map&canvas=none&ambient=' + mode);
    expect(doc.body.classList.contains('probe-' + mode)).toBe(true);
    expect(doc.querySelector('#status').textContent).toContain('ambient=' + mode); dom.window.close();
  });
  it('dynamic RAF is explicit, deduplicated and cancellable', () => {
    const { dom, doc, raf, cancel } = fixture('?css=map');
    doc.querySelector('#dynamic').click(); doc.querySelector('#dynamic').click(); expect(raf).toHaveBeenCalledTimes(1);
    doc.querySelector('#static').click(); expect(cancel).toHaveBeenCalledWith(7);
    expect(doc.querySelector('#status').textContent).toContain('Canvas=static'); dom.window.close();
  });
});
