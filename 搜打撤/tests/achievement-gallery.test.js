// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import data from '../game/data/achievements.json';
import { achievementGalleryHTML, bindAchievementGallery } from '../game/src/ui/achievement-gallery.js';
import { ACHIEVEMENT_MEDAL_IDS, achievementMedalHTML } from '../game/src/ui/achievement-medals.js';

function gallery(base = null) {
  document.body.innerHTML = achievementGalleryHTML({
    achievements: data.achievements, base, slot: base ? 3 : null,
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
    expect(root.querySelector('.ag-empty-copy').textContent).toContain('第一枚奖章');
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
    expect(detail.querySelector('button')).toBeNull();
    expect(document.activeElement).toBe(detail);
    expect(root.querySelector('.ag-body').inert).toBe(true);
    expect(detail.textContent).toContain('木材 ×2 / 卡背 · 猎手皮纸');
    expect(detail.textContent).toContain('请进入该档位的基地领取奖励');
    expect(detail.querySelector('svg').dataset.medal).toBe('kill10');
    detail.querySelector('h3').click();
    expect(detail.hidden).toBe(false);
    backdrop.click();
    expect(detail.hidden).toBe(true);
    expect(backdrop.hidden).toBe(true);
    expect(root.querySelector('.ag-body').inert).toBe(false);
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

describe('bespoke medal catalogue', () => {
  it('covers all actual achievements with different engraving geometry and unique paint ids', () => {
    expect([...ACHIEVEMENT_MEDAL_IDS].sort()).toEqual(data.achievements.map(item => item.id).sort());
    const geometry = new Set();
    for (const item of data.achievements) {
      const host = document.createElement('div');
      host.innerHTML = achievementMedalHTML(item.id);
      expect(host.querySelector('svg').dataset.medal).toBe(item.id);
      geometry.add([...host.querySelectorAll('path,ellipse,circle')].map(shape =>
        [shape.tagName, ...['d', 'cx', 'cy', 'r', 'rx', 'ry', 'transform'].map(attr => shape.getAttribute(attr))].join('|'),
      ).join(''));
    }
    expect(geometry.size).toBe(26);
    const { root } = gallery();
    const ids = [...root.querySelectorAll('[id]')].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
