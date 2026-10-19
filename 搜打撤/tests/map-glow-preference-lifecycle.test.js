import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear(); document.body.classList.remove('reduce-motion'); });
it.each(['motion', 'quality'])('stops the existing glow driver when %s preferences disable it', async setting => {
  vi.resetModules();
  const frames = [];
  vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
  const { renderScheduler } = await import('../game/src/core/render-scheduler.js');
  const { noteGlowPulse, glowPulse } = await import('../game/src/core/map-node-glow.js');
  const { refreshReduceMotion } = await import('../game/src/core/motion.js');
  const { setPerformanceSettings } = await import('../game/src/core/performance-settings.js');
  const animate = vi.spyOn(renderScheduler, 'invalidateAnimation');
  const settle = vi.spyOn(renderScheduler, 'invalidate');
  noteGlowPulse(10);
  expect(frames).toHaveLength(1);
  if (setting === 'motion') { localStorage.setItem('sdt-reduce-motion', '1'); refreshReduceMotion(); }
  else setPerformanceSettings({ quality: 'low' });
  settle.mockClear(); frames.shift()(performance.now());
  expect(animate).not.toHaveBeenCalled(); expect(frames).toHaveLength(0); expect(settle).toHaveBeenCalledOnce();
  expect(glowPulse(10.1)).toBe(0);
  localStorage.removeItem('sdt-reduce-motion'); refreshReduceMotion(); setPerformanceSettings({ quality: 'balanced' });
  noteGlowPulse(11); expect(frames).toHaveLength(1);
});
