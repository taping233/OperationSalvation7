// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import data from '../game/data/achievements.json';
import { achievementGalleryHTML, bindAchievementGallery } from '../game/src/ui/achievement-gallery.js';
import { ACHIEVEMENT_MEDAL_IDS, ACHIEVEMENT_MEDAL_STYLES, achievementMedalHTML } from '../game/src/ui/achievement-medals.js';

function gallery(base = null, random = Math.random) {
  document.body.innerHTML = achievementGalleryHTML({
    achievements: data.achievements, base, slot: base ? 3 : null, random,
    isUnlocked: (entry, snapshot) => snapshot.unlocked.includes(entry.id),
    backs: [{ id: 'wolf', name: '猎手皮纸' }],
    cards: [{ id: 'tt3-thunderblast', name: '雷鸣爆破' }],
  });
  const root = document.querySelector('.achievement-gallery');
  const control = bindAchievementGallery(root);
  return { root, control, visible: () => [...root.querySelectorAll('[data-gallery-item]')].filter(item => !item.hidden) };
}
const click = (root, selector) => root.querySelector(selector).click();

describe('achievement gallery', () => {
  it('lists actual conditions even without a save; does not infer unlocks from the active base', () => {
    const { root, visible } = gallery();
    expect(visible()).toHaveLength(data.achievements.length);
    expect(root.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('0');
    expect(visible()[0].textContent).toContain('首次撤离成功');
    click(root, '[data-gallery-filter="unlocked"]');
    expect(visible()).toHaveLength(0);
    expect(root.querySelector('.ag-empty').hidden).toBe(false);
    expect(root.querySelector('.ag-empty').dataset.emptyState).toBe('earned');
    expect(root.querySelector('.ag-empty-copy').textContent).toBe('尚未获得奖章。');
    click(root, '[data-gallery-reset]');
    expect(visible()).toHaveLength(26);
  });

  it('combines status, category and search filters, and resets all three together', () => {
    const base = { unlocked: ['kill10', 'firstExtract'], achClaimed: { firstExtract: true } };
    const before = JSON.stringify(base);
    const { root, visible } = gallery(base);
    click(root, '[data-gallery-filter="unlocked"]');
    expect(visible()).toHaveLength(2);
    click(root, '[data-gallery-category="battle"]');
    expect(visible()).toHaveLength(1);
    expect(visible()[0].textContent).toContain('猎手');
    const input = root.querySelector('input');
    input.value = '金币'; input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(visible()).toHaveLength(0);
    click(root, '[data-gallery-reset]');
    expect(visible()).toHaveLength(26);
    expect(input.value).toBe('');
    expect(JSON.stringify(base)).toBe(before);
    click(root, '[data-gallery-view="grid"]');
    expect(root.querySelector('.ag-grid').dataset.view).toBe('grid');
  });

  it('enlarges the same medal, shows real rewards and returns focus without claiming', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { root, control } = gallery({ unlocked: ['kill10'], achClaimed: {} });
    const tile = root.querySelector('[data-search^="猎手"]');
    tile.click();
    const detail = root.querySelector('.ag-detail');
    const backdrop = root.querySelector('.ag-detail-backdrop');
    expect(detail.hidden).toBe(false);
    expect(backdrop.hidden).toBe(false);
    const close = detail.querySelector('[data-gallery-dismiss]');
    expect(close.getAttribute('aria-label')).toBe('关闭奖章详情');
    expect(close.dataset.cancel).toBe('true');
    expect(detail.querySelector('[data-act]')).toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(root.querySelector('.ag-body').inert).toBe(true);
    expect(root.querySelector('.ag-header').inert).toBe(true);
    detail.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    expect(detail.textContent).toContain('木材 ×2 / 卡背 · 猎手皮纸');
    expect(detail.textContent).toContain('请进入该档位的基地领取奖励');
    expect(detail.querySelector('svg').dataset.medal).toBe('kill10');
    detail.querySelector('h3').click();
    expect(detail.hidden).toBe(false);
    backdrop.click();
    expect(detail.hidden).toBe(true);
    expect(backdrop.hidden).toBe(true);
    expect(root.querySelector('.ag-body').inert).toBe(false);
    expect(root.querySelector('.ag-header').inert).toBe(false);
    expect(document.activeElement).toBe(tile);
    tile.click();
    expect(control.closeDetail()).toBe(true);
    expect(detail.hidden).toBe(true);
    expect(backdrop.hidden).toBe(true);
    expect(document.activeElement).toBe(tile);
    expect(control.closeDetail()).toBe(false);
    expect(write).not.toHaveBeenCalled();
    write.mockRestore();
  });

  it('renders saved claim status independently from rewards not yet claimed', () => {
    const { root } = gallery({ unlocked: ['firstExtract', 'kill10'], achClaimed: { firstExtract: true } });
    expect(root.querySelector('.ag-total strong').textContent).toBe('2');
    expect(root.querySelector('.ag-claimed').textContent).toContain('已领取');
    expect(root.querySelector('.ag-unlocked').textContent).toContain('待领取');
    expect(root.querySelector('.ag-archive').textContent).toContain('档案 03');
    expect(root.querySelector('.ag-archive small')).toBeNull();
  });

  it('escapes names, conditions and rewards before creating searchable markup', () => {
    document.body.innerHTML = achievementGalleryHTML({
      achievements: [{ id: 'firstExtract', name: '<img src=x onerror=alert(1)>', desc: '"><script>bad()</script>', reward: { card: 'x' } }],
      base: null, isUnlocked: () => false, cards: [{ id: 'x', name: '<iframe src=x>' }], backs: [],
    });
    expect(document.querySelector('img,script,iframe')).toBe(null);
    expect(document.querySelector('[data-gallery-item]').dataset.search).toContain('<img');
  });
});

describe('five-style theme medal catalogue', () => {
  it('covers every achievement with a distinct cell in each of the five atlases', () => {
    expect([...ACHIEVEMENT_MEDAL_IDS].sort()).toEqual(data.achievements.map(item => item.id).sort());
    expect(ACHIEVEMENT_MEDAL_STYLES).toHaveLength(5);
    for (const style of ACHIEVEMENT_MEDAL_STYLES) {
      const cells = new Set();
      for (const item of data.achievements) {
        const host = document.createElement('div');
        host.innerHTML = achievementMedalHTML(item.id, 'tile', style);
        expect(host.querySelector('svg').dataset.medal).toBe(item.id);
        expect(host.querySelector('svg').dataset.medalStyle).toBe(style);
        const image = host.querySelector('image');
        const clip = host.querySelector('clipPath');
        expect(image.parentElement.getAttribute('clip-path')).toBe(`url(#${clip.id})`);
        expect(clip.querySelector('rect').getAttribute('width')).toBe('120');
        expect(clip.querySelector('rect').getAttribute('height')).toBe('172.5');
        expect(image.getAttribute('href')).toContain(`/achievement-styles/${style}.webp`);
        const x = Number(image.getAttribute('x')), y = Number(image.getAttribute('y'));
        expect(x).toBeLessThanOrEqual(0);
        expect(x).toBeGreaterThanOrEqual(-600);
        expect(y).toBeLessThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(-690);
        cells.add(`${x},${y}`);
      }
      expect(cells.size).toBe(26);
    }
    const { root } = gallery();
    root.querySelector('[data-search^="猎手"]').click();
    const clipIds = [...root.querySelectorAll('clipPath')].map(clip => clip.id);
    expect(new Set(clipIds).size).toBe(clipIds.length);
  });

  it('draws once per opening and shares the chosen style across tiles, filters and detail', () => {
    const random = vi.fn();
    for (let index = 0; index < ACHIEVEMENT_MEDAL_STYLES.length; index++) {
      random.mockReturnValue((index + 0.5) / 5);
      const { root } = gallery(null, random);
      const style = ACHIEVEMENT_MEDAL_STYLES[index];
      expect(root.dataset.medalStyle).toBe(style);
      expect(new Set([...root.querySelectorAll('svg.ag-badge')].map(svg => svg.dataset.medalStyle))).toEqual(new Set([style]));
      click(root, '[data-gallery-category="battle"]');
      click(root, '[data-gallery-view="grid"]');
      const tile = root.querySelector('[data-search^="猎手"]');
      const href = tile.querySelector('image').getAttribute('href');
      tile.click();
      expect(root.querySelector('.ag-detail svg').dataset.medalStyle).toBe(style);
      expect(root.querySelector('.ag-detail image').getAttribute('href')).toBe(href);
      expect(random).toHaveBeenCalledTimes(index + 1);
    }
  });

  it('falls back to fixed catalogue keys for unknown medal and style input', () => {
    const host = document.createElement('div');
    host.innerHTML = achievementMedalHTML('<script>', 'detail', 'bad" onload="alert(1)');
    expect(host.querySelector('svg').dataset.medal).toBe('firstExtract');
    expect(host.querySelector('svg').dataset.medalStyle).toBe('painted');
    expect(host.querySelector('script,[onload]')).toBeNull();
  });
});
