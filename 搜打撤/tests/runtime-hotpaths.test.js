import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { descRich } from '../game/src/cards/cards.view.js';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { esc } from '../game/src/core/shared.js';
import { termKeyFor } from '../game/src/ui/term-tips.js';
import { bindCardBrowser, cardBrowserHTML, refreshCardBrowser } from '../game/src/ui/card-browser.js';

// Frozen exact pre-change implementations, used only to compare identical inputs.
const evidence = 'docs/evidence/2026-10-17-runtime-hotpaths/';
const beforeView = readFileSync(evidence + 'cards.view.before.txt', 'utf8');
function compileDescription(source, stats) {
  return runInNewContext(source.slice(source.indexOf('const DESC_TERMS'), source.indexOf('// 卡背渲染：')).replace('export function descRich', 'function descRich') + '\ndescRich;', { esc, termKeyFor: word => { if (stats) stats.termLookups++; return termKeyFor(word); }, displayCardDescription });
}
const descBefore = compileDescription(beforeView);
const beforeBrowser = readFileSync(evidence + 'card-browser.before.txt', 'utf8');
const refreshBefore = runInNewContext(beforeBrowser.slice(beforeBrowser.indexOf('export function refreshCardBrowser'), beforeBrowser.indexOf('export function bindCardBrowser')).replace('export function refreshCardBrowser', 'function refreshCardBrowser') + '\nrefreshCardBrowser;', { instances: { get: () => ({ page: 0 }) }, getComputedStyle: element => getComputedStyle(element) });

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
function browser() {
  document.body.innerHTML = cardBrowserHTML('hotpath', '卡牌', Array.from({ length: 96 }, (_, i) => `<button data-browser-key="${i}">${i}</button>`).join(''), { rows: 2, columns: 4 });
  const root = document.body.firstElementChild;
  bindCardBrowser(root);
  return root;
}
describe('bounded rich description reuse', () => {
  it('is byte-identical for revised, escaped, numeric and custom input', () => {
    for (const [text, id] of [['回复12 点生命。', 'starter-emergency-bandage'], ['回复12 点生命。', 'custom'], ['主动技能：<script>\' & -2.5 法术伤害\n消耗口袋', ''], ['', '']]) {
      expect(descRich(text, id)).toBe(descBefore(text, id));
      expect(descRich(text, id)).toBe(descBefore(text, id));
    }
    expect(descRich('回复12 点生命。', 'starter-emergency-bandage')).not.toBe(descRich('回复12 点生命。', 'custom'));
    expect(descRich('造成 3 点伤害', 'mutable')).not.toBe(descRich('造成 4 点伤害', 'mutable'));
  });
  it('reuses text across card ids, evicts oldest after 256 entries, and bypasses long text', () => {
    const spy = vi.spyOn(String.prototype, 'matchAll');
    const text = '缓存边界 1234 点伤害';
    descRich(text, 'a'); const initial = spy.mock.calls.length;
    descRich(text, 'b'); expect(spy).toHaveBeenCalledTimes(initial);
    for (let i = 0; i < 256; i++) descRich(`边界填充 ${i} 点生命`);
    const filled = spy.mock.calls.length;
    descRich(text); expect(spy.mock.calls.length).toBe(filled + 1);
    const long = '长'.repeat(2049) + ' 3 点伤害';
    descRich(long); const once = spy.mock.calls.length;
    descRich(long); expect(spy.mock.calls.length).toBe(once + 1);
    expect(descRich(long)).toBe(descBefore(long));
  });
  it('compares 6400 identical calls before/after without asserting wall-clock timing', () => {
    const input = Array.from({ length: 64 }, (_, i) => `回合开始时：造成 ${i} 点法术伤害，附加 2 层中毒并回复 3 点生命。`);
    const measure = render => {
      const start = performance.now(); let bytes = 0;
      for (let i = 0; i < 6400; i++) bytes += render(input[i % input.length]).length;
      return { ms: +(performance.now() - start).toFixed(3), bytes };
    };
    const beforeStats = { termLookups: 0 }, afterStats = { termLookups: 0 };
    const beforeRender = compileDescription(beforeView, beforeStats);
    const afterRender = compileDescription(readFileSync('game/src/cards/cards.view.js', 'utf8'), afterStats);
    const before = { ...measure(beforeRender), ...beforeStats }, after = { ...measure(afterRender), ...afterStats };
    expect(after.termLookups * 100).toBe(before.termLookups);
    expect(after.bytes).toBe(before.bytes);
    console.log('HOTPATH description 6400 calls / 64 texts', JSON.stringify({ before, after }));
  });
});
describe('card browser differential DOM writes', () => {
  it('eliminates unchanged mutations while preserving filtering, paging and external repairs', () => {
    const root = browser();
    const observer = new MutationObserver(() => {});
    observer.observe(root, { subtree: true, attributes: true, childList: true, characterData: true });
    for (let i = 0; i < 100; i++) refreshBefore(root);
    const before = observer.takeRecords().length;
    for (let i = 0; i < 100; i++) refreshCardBrowser(root);
    const after = observer.takeRecords().length;
    expect(before).toBeGreaterThan(0); expect(after).toBe(0);
    console.log('HOTPATH browser 100 unchanged refreshes / 96 cards', JSON.stringify({ beforeMutations: before, afterMutations: after }));
    root.querySelector('[data-browser-page="next"]').click();
    expect(root.querySelector('.card-browser-position').textContent).toBe('2 / 12');
    const items = [...root.querySelectorAll('[data-browser-key]')];
    items.slice(0, 92).forEach(item => { item.dataset.browseFiltered = 'true'; });
    refreshCardBrowser(root);
    expect(items.filter(item => !item.hidden).map(item => item.dataset.browserKey)).toEqual(['92', '93', '94', '95']);
    items[95].hidden = true;
    root.querySelector('.card-browser-position').textContent = 'stale';
    refreshCardBrowser(root);
    expect(items[95].hidden).toBe(false);
    expect(root.querySelector('.card-browser-position').textContent).toBe('1 / 1');
    observer.disconnect();
  });
  it('does no reads or writes after detach', () => {
    const root = browser(); root.remove();
    vi.stubGlobal('getComputedStyle', () => { throw new Error('detached read'); });
    expect(() => refreshCardBrowser(root)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
