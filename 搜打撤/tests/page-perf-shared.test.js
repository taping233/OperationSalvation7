// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const baseline = 'docs/evidence/2026-10-18-WF-page-perf-1018/shared/baseline/';
function compileCardCache(source) {
  const maps = [];
  class TrackedMap extends Map {
    constructor() { super(); maps.push(this); }
  }
  let builds = 0;
  const render = runInNewContext(source.slice(source.indexOf('const cardHTMLMemo'), source.indexOf('function buildCardHTML'))
    .replace('export function cardHTML', 'function cardHTML') + '\ncardHTML;', {
    Map: TrackedMap,
    buildCardHTML: (card, cls, options) => { builds++; return card.id + '/' + cls + '/' + JSON.stringify(options); },
  });
  return { render, maps, builds: () => builds };
}

function mountHome(source) {
  const dom = new JSDOM('<div id="title" class="home-composed" data-home-phase="rest"><div class="title-inner"><div class="home-brand"></div></div></div><dialog id="homeCredits"></dialog><span id="gameVersion">0.60.0</span>', { url: 'http://localhost/' });
  const win = dom.window;
  const intervals = new Map();
  let nextId = 0;
  let calls = 0;
  let hidden = false;
  Object.defineProperty(win.document, 'hidden', { get: () => hidden });
  const code = source.replace(/^import .*;\r?\n/gm, '')
    .replace("new URL('../../css/home-polish.css', import.meta.url).href", "'http://localhost/css/home-polish.css'");
  runInNewContext(code, {
    window: win, document: win.document, MutationObserver: win.MutationObserver,
    interfaceReducedMotion: () => false,
    setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; },
    clearInterval: id => intervals.delete(id),
    requestAnimationFrame: vi.fn(), cancelAnimationFrame: vi.fn(), setTimeout: vi.fn(), queueMicrotask,
  });
  return {
    win, doc: win.document, intervals,
    pulse(seconds) { for (let i = 0; i < seconds; i++) for (const fn of [...intervals.values()]) { calls++; fn(); } },
    calls: () => calls,
    hide(value) { hidden = value; win.document.dispatchEvent(new win.Event('visibilitychange')); },
    flush: () => new Promise(resolve => queueMicrotask(resolve)),
    close: () => win.close(),
  };
}

describe('shared page performance budgets', () => {
  it('bounds dynamic card variants while retaining exact results and repeated-hit reuse', () => {
    const before = compileCardCache(readFileSync(baseline + 'cards.view.js.txt', 'utf8'));
    const after = compileCardCache(readFileSync('game/src/cards/cards.view.js', 'utf8'));
    const card = { id: 'long-session' };
    for (let i = 0; i < 1024; i++) {
      const options = { costOverride: { v: i, base: 2 }, dmgOverride: { bonus: i } };
      expect(after.render(card, 'sm', options)).toBe(before.render(card, 'sm', options));
    }
    expect(before.maps[0].size).toBe(1024);
    expect(after.maps[0].size).toBe(32);
    const latest = { costOverride: { v: 1023, base: 2 }, dmgOverride: { bonus: 1023 } };
    const builds = after.builds();
    for (let i = 0; i < 100; i++) after.render(card, 'sm', latest);
    expect(after.builds()).toBe(builds);
    const first = { costOverride: { v: 0, base: 2 }, dmgOverride: { bonus: 0 } };
    expect(after.render(card, 'sm', first)).toBe(before.render(card, 'sm', first));
    expect(after.builds()).toBe(builds + 1);
    expect(after.maps[0].size).toBe(32);
    console.log('PAGE PERF shared card variants', JSON.stringify({ before: before.maps[0].size, after: after.maps[0].size, equalOutputs: 1024 }));
  });

  it('stops the home clock behind pages, wallpaper, credits and hidden documents and resumes once', async () => {
    const before = mountHome(readFileSync(baseline + 'home-fx.js.txt', 'utf8'));
    const after = mountHome(readFileSync('game/src/ui/home-fx.js', 'utf8'));
    try {
      expect(after.intervals.size).toBe(1);
      const title = after.doc.getElementById('title');
      for (const home of [before, after]) home.doc.body.classList.add('page-covered');
      await after.flush();
      before.pulse(60); after.pulse(60);
      expect(before.calls()).toBe(60);
      expect(after.calls()).toBe(0);
      expect(after.intervals.size).toBe(0);
      after.doc.body.classList.remove('page-covered'); await after.flush();
      expect(after.intervals.size).toBe(1);
      expect(after.doc.querySelector('[data-version]').textContent).toBe('0.60.0');
      expect(after.doc.querySelector('[data-clock]').textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      for (const active of [false, true, false, true]) { after.hide(!active); expect(after.intervals.size).toBe(active ? 1 : 0); }
      for (const className of ['wallpaper-only']) {
        title.classList.add(className); await after.flush(); expect(after.intervals.size).toBe(0);
        title.classList.remove(className); await after.flush(); expect(after.intervals.size).toBe(1);
      }
      const credits = after.doc.getElementById('homeCredits');
      credits.setAttribute('open', ''); await after.flush(); expect(after.intervals.size).toBe(0);
      credits.removeAttribute('open'); await after.flush(); expect(after.intervals.size).toBe(1);
      title.hidden = true; await after.flush(); expect(after.intervals.size).toBe(0);
      title.hidden = false; await after.flush(); expect(after.intervals.size).toBe(1);
      title.dataset.homePhase = 'out'; await after.flush(); expect(after.intervals.size).toBe(0);
      title.dataset.homePhase = 'rest'; await after.flush(); expect(after.intervals.size).toBe(1);
      after.win.dispatchEvent(new after.win.Event('pagehide')); expect(after.intervals.size).toBe(0);
      after.win.dispatchEvent(new after.win.Event('pageshow')); expect(after.intervals.size).toBe(1);
      after.win.dispatchEvent(new after.win.Event('pageshow')); expect(after.intervals.size).toBe(1);
      console.log('PAGE PERF hidden home 60 seconds', JSON.stringify({ beforeCallbacks: before.calls(), afterCallbacks: after.calls() }));
    } finally { before.close(); after.close(); }
  });
});
