// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import data from '../game/data/achievements.json';
import { achievementGalleryHTML, bindAchievementGallery } from '../game/src/ui/achievement-gallery.js';

function openGallery(achievements = data.achievements, { deferEntry = false, cover = '' } = {}) {
  document.body.className = 'reduce-motion';
  document.body.innerHTML = achievementGalleryHTML({
    achievements, base: { achClaimed: { firstExtract: true } }, slot: 1,
    isUnlocked: entry => ['firstExtract', 'kill10'].includes(entry.id),
    backs: [{ id: 'wolf', name: '猎手皮纸' }], cards: [], random: () => 0,
  });
  const root = document.querySelector('.achievement-gallery');
  if (deferEntry) {
    const overlay=document.createElement('div'); overlay.id='overlay';
    root.replaceWith(overlay); overlay.append(root);
    if (cover) {
      const curtain=document.createElement('div'); curtain.className=cover === 'cold' ? 'page-loading' : 'camp-entry-cut';
      (cover === 'cold' ? document.body : overlay).append(curtain);
    }
  }
  const control = bindAchievementGallery(root, {deferEntry});
  return { root, control, content: root.querySelector('.ag-detail-content') };
}

describe('achievement gallery entry work', () => {
  it.each(['cold','warm'])('waits for the %s curtain to end and plays entry only once', async cover => {
    const previous=HTMLElement.prototype.animate;
    const animate=vi.fn(() => ({cancel:vi.fn(),finished:new Promise(() => {})}));
    HTMLElement.prototype.animate=animate;
    try {
      const {root}=openGallery(data.achievements,{deferEntry:true,cover});
      document.body.className='';
      await Promise.resolve();
      expect(root.dataset.galleryEntry).toBe('waiting'); expect(animate).not.toHaveBeenCalled();
      document.querySelector(cover === 'cold' ? '.page-loading' : '.camp-entry-cut').remove();
      await Promise.resolve();
      expect(root.hasAttribute('data-gallery-entry')).toBe(false); expect(animate).toHaveBeenCalled();
      const count=animate.mock.calls.length;
      root.classList.add('after-entry'); await Promise.resolve();
      expect(animate).toHaveBeenCalledTimes(count);
    } finally {HTMLElement.prototype.animate=previous;}
  });
  it('leaving during curtain readiness never replays entry on the hidden page', async () => {
    const previous=HTMLElement.prototype.animate;
    const animate=vi.fn(); HTMLElement.prototype.animate=animate;
    try {
      openGallery(data.achievements,{deferEntry:true,cover:'cold'}); document.body.className='';
      await Promise.resolve();
      document.getElementById('overlay').hidden=true;
      document.querySelector('.page-loading').remove(); await Promise.resolve();
      expect(animate).not.toHaveBeenCalled();
    } finally {HTMLElement.prototype.animate=previous;}
  });
  it('creates only the catalogue medals on entry, with no duplicate summary artwork or unopened detail trees', () => {
    const { root, content } = openGallery();
    expect(root.querySelectorAll('[data-gallery-item]')).toHaveLength(26);
    expect(root.querySelectorAll('svg.ag-badge')).toHaveLength(26);
    expect(root.querySelectorAll('template')).toHaveLength(0);
    expect(content.childElementCount).toBe(0);
    root.querySelector('[data-gallery-filter="locked"]').click();
    expect(content.childElementCount).toBe(0);
  });

  it('parses once for the selected medal, reuses repeated opens, and switches correctly', () => {
    const { root, content, control } = openGallery();
    const writes = vi.spyOn(content, 'innerHTML', 'set');
    const hunter = root.querySelector('[data-medal-id="kill10"]');
    hunter.click();
    const badge = content.querySelector('svg');
    expect(content.textContent).toContain('木材 ×2 / 卡背 · 猎手皮纸');
    expect(content.textContent).toContain('请进入该档位的基地领取奖励');
    for (let i = 0; i < 5; i++) { control.closeDetail(); hunter.click(); }
    expect(writes).toHaveBeenCalledTimes(1);
    expect(content.querySelector('svg')).toBe(badge);
    control.closeDetail();
    root.querySelector('[data-medal-id="firstExtract"]').click();
    expect(writes).toHaveBeenCalledTimes(2);
    expect(content.querySelector('svg').dataset.medal).toBe('firstExtract');
    expect(content.textContent).toContain('奖励已记入该档位的基地档案');
    control.closeDetail();
    root.querySelector('[data-medal-id="allBoss"]').click();
    expect(content.textContent).toContain('完成以上条件后');
    expect(root.querySelectorAll('svg.ag-badge')).toHaveLength(27);
    writes.mockRestore();
  });

  it('keeps deferred text escaped and uses the current gallery snapshot on reopening', () => {
    const odd = { id: 'kill10', name: '<img src=x onerror=alert(1)>', desc: 'A & "B" <script>bad</script>', reward: { wood: 2 } };
    const first = openGallery([odd]);
    first.root.querySelector('[data-gallery-item]').click();
    expect(first.content.querySelector('h3').textContent).toBe(odd.name);
    expect(first.content.querySelector('.ag-detail-condition span').textContent).toBe(odd.desc);
    expect(first.content.querySelector('script, img')).toBeNull();
    const second = openGallery([{ ...odd, name: '新档案' }]);
    expect(second.content.childElementCount).toBe(0);
    second.root.querySelector('[data-gallery-item]').click();
    expect(second.content.querySelector('h3').textContent).toBe('新档案');
  });
});
