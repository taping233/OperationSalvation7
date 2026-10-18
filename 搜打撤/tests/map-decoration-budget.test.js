import { readFileSync } from 'node:fs';
import { parse } from 'postcss';
import { afterEach, describe, expect, it, vi } from 'vitest';
const cssFiles = ['performance-settings', 'expedition-map', 'map-edge-light'];
const css = cssFiles.map(name => parse(readFileSync(`game/css/${name}.css`, 'utf8')));
// Evaluate the explicit new pause gates independently of native CSS animation.
// Browser composition remains the separate real-page acceptance requirement.
function pauseGate(target, { quality = 'balanced', hidden = false } = {}) {
  document.body.dataset.renderQuality = quality;
  document.body.classList.toggle('linked-backgrounded', hidden);
  let paused = false;
  for (const sheet of css) sheet.walkRules(rule => {
    if (!rule.selectors?.some(selector => {
      if (!selector.endsWith(target)) return false;
      const body = selector.slice(0, -target.length).trim();
      return ['body[data-render-quality="low"]', 'body.linked-backgrounded'].includes(body) && document.body.matches(body);
    })) return;
    rule.walkDecls('animation-play-state', declaration => { if (declaration.value === 'paused' && declaration.important) paused = true; });
  });
  return paused;
}
afterEach(() => { document.body.className = ''; delete document.body.dataset.renderQuality; vi.restoreAllMocks(); });
describe('map decorative animation budget', () => {
  for (const target of ['#viewport::before', '#viewport::after', '.map-volumetric-light i', '.map-edge-light i']) {
    it(`${target} pauses for low/background and resumes for foreground balanced/high`, () => {
      expect(pauseGate(target, { quality: 'low' })).toBe(true);
      expect(pauseGate(target, { hidden: true })).toBe(true);
      expect(pauseGate(target)).toBe(false);
      expect(pauseGate(target, { quality: 'high' })).toBe(false);
      document.body.classList.add('reduce-motion');
      expect(pauseGate(target, { quality: 'low', hidden: true })).toBe(true);
      expect(pauseGate(target, { quality: 'high' })).toBe(false);
      expect(document.body.classList.contains('reduce-motion')).toBe(true);
    });
  }
  it('shared visibility state toggles without changing stored quality or reduced motion', async () => {
    vi.resetModules(); document.body.dataset.renderQuality = 'high'; document.body.classList.add('reduce-motion');
    const getHidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const saved = localStorage.getItem('sdt-performance');
    await import('../game/src/ui/home-linked-interactions.js');
    getHidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    expect(document.body.classList.contains('linked-backgrounded')).toBe(true);
    getHidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    expect(document.body.classList.contains('linked-backgrounded')).toBe(false);
    expect(document.body.dataset.renderQuality).toBe('high'); expect(document.body.classList.contains('reduce-motion')).toBe(true);
    expect(localStorage.getItem('sdt-performance')).toBe(saved);
  });
  it('reduced-motion still removes the animations instead of a running override', () => {
    const map = css[1].toString(), edge = css[2].toString();
    expect(map).toContain('body.reduce-motion #viewport::before,');
    expect(map).toContain('body.reduce-motion .map-volumetric-light i { animation:none; }');
    expect(edge).toContain('body.reduce-motion .map-edge-light i { animation:none; }');
    for (const sheet of css) sheet.walkRules(rule => {
      if (!rule.selector.includes('linked-backgrounded') && !rule.selector.includes('data-render-quality="low"')) return;
      rule.walkDecls('animation-play-state', declaration => expect(declaration.value).toBe('paused'));
    });
  });
});
