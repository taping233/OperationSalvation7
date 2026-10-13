// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { archiveV3HTML, bindArchiveV3, refreshArchiveBacks } from '../game/src/hub/hub.archive-v3.js';
import { bindArchive } from '../game/src/hub/hub.archive.js';

let nextSlot = 20;
const disposers = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); });

function setup() {
  const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  disposers.push(() => { if (originalScroll) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScroll); else delete HTMLElement.prototype.scrollIntoView; });
  const cardPool = [
    { id: 'wu-a', name: '映雪·回身长剑', cls: '侠客', type: '职业卡', rarity: '职业' },
    { id: 'wu-b', name: '非常长的能力卡名称用于验证完整名称没有截断', cls: '侠客', type: '能力卡', rarity: '棱彩' },
    { id: 'baita-a', name: '火焰', cls: '法师', type: '职业卡', rarity: '职业' },
  ];
  const base = {
    slot: nextSlot++, data: { stats: { extracts: 1, kills: 4 }, collection: { 'wu-a': true }, story: { flags: {}, outcomes: {} }, characters: {}, pets: {} },
    isCollected: card => !!base.data.collection[card.id], backSel: () => 'classic', isBackUnlocked: id => id === 'classic',
    bagCap: () => 6, safeCap: () => 1, PETS: [],
  };
  const achievements = [
    { id: 'firstExtract', name: '第一次返乡', desc: '首次撤离成功', reward: { wood: 3 } },
    { id: 'kill10', name: '猎手的非常长的奖章名称仍需完整阅读', desc: '累计击败十名敌人', reward: { rations: 5 }, back: 'wolf' },
  ];
  const meta = {
    ACHIEVEMENTS: achievements, isUnlocked: entry => entry.id === 'firstExtract', isClaimed: () => false,
    collectPool: () => cardPool, collTotal: () => cardPool.length, collProgress: () => 1,
    COLL_MILESTONES: [{ id: 'one', need: 1, reward: { wood: 3 } }, { id: 'all', need: 3, reward: { keys: 1 } }],
    collMsNeed: milestone => milestone.need, collMsReached: milestone => milestone.need <= 1,
    isCollClaimed: () => false, collRewardText: milestone => milestone.id === 'one' ? '木材 ×3' : '钥匙 ×1',
  };
  const cards = {
    CLASSES: ['侠客', '法师'], all: () => cardPool,
    CARD_BACKS: [{ id: 'classic', name: '旧纸', from: '默认' }, { id: 'wolf', name: '狼纹', from: '猎手成就' }],
    cardHTML: card => `<div class="hs-card sm"><b>${card.name}</b></div>`,
    cardBackHTML: id => `<div class="hs-back hb-${id}"></div>`,
  };
  window.SDT = { Base: base, Meta: meta, Cards: cards, MAP: { rules: { bagMax: 10, safeMax: 4 } } };
  const actions = new Map(), ui = { act: (key, handler) => actions.set(key, handler) };
  const listener = event => { const button = event.target.closest('[data-act]'); if (button && !button.disabled) actions.get(button.dataset.act)?.(button.dataset); };
  document.addEventListener('click', listener);
  disposers.push(() => document.removeEventListener('click', listener));
  let view = 'achievements';
  const render = nextView => {
    view = nextView || view;
    document.body.innerHTML = `<main id="hubMain">${archiveV3HTML({ base, meta, cards, view, art: { classAvatarArt: cls => `<img alt="${cls}" src="/avatar.webp">` } })}</main>`;
    bindArchive(ui, () => render(), { openAchievements:() => render('achievements') });
    bindArchiveV3({ ui, base, meta, cards, refresh: () => render() });
    actions.set('hubCollectionView', data => render(data.view));
    return document.querySelector('.hub-archive-v3');
  };
  return { base, meta, cards, actions, render };
}

describe('independent archive room', () => {
  it('retains the glass panels when previewing and applying a card back', () => {
    const { base, meta, cards, render } = setup();
    const root = render('backs');
    const selectors = ['.av3-header', '.av12-directory', '.av12-back-stage', '.av3-back-detail', '.av3-back-shelves'];
    const panels = selectors.map(selector => root.querySelector(selector));
    const before = JSON.stringify(base.data);
    root.querySelector('[data-id="wolf"]').click();
    expect(document.querySelector('.hub-archive-v3')).toBe(root);
    selectors.forEach((selector, index) => expect(root.querySelector(selector)).toBe(panels[index]));
    expect(root.querySelector('.av3-back-display .hb-wolf')).not.toBeNull();
    expect(root.querySelector('[data-id="wolf"]').getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[data-act="selBack"]').disabled).toBe(true);
    expect(JSON.stringify(base.data)).toBe(before);
    base.isBackUnlocked = () => true;
    base.backSel = () => 'wolf';
    expect(refreshArchiveBacks({ base, meta, cards })).toBe(true);
    selectors.forEach((selector, index) => expect(root.querySelector(selector)).toBe(panels[index]));
    expect(root.querySelector('[data-act="selBack"]').textContent).toBe('使用中');
    expect(root.querySelector('[data-id="wolf"] small').textContent).toBe('使用中');
    root.querySelector('[data-act="archiveV3Back"][data-id="classic"]').click();
    expect(root.querySelector('[data-act="selBack"]').disabled).toBe(false);
    render('cards');
    expect(refreshArchiveBacks({ base, meta, cards })).toBe(false);
  });
  it('keeps owned cards in the main room and opens each utility as a separate secondary view', () => {
    const { render } = setup();
    const root = render('cards');
    expect(root.querySelector('h2').textContent).toBe('收藏室');
    expect([...root.querySelectorAll('.av12-directory [data-act="hubCollectionView"]')].map(button => button.dataset.view)).toEqual(['cards', 'rewards', 'achievements', 'classes', 'backs', 'stories']);
    expect(root.querySelectorAll('[data-browser-key]')).toHaveLength(1);
    for (const [view, selector] of [['classes', '.av12-record-workspace'], ['backs', '.av3-back-detail'], ['stories', '.story-reader'], ['achievements', '.av3-medal-detail']]) {
      render(['classes', 'achievements'].includes(view) ? 'rewards' : 'cards').querySelector(`[data-act="hubCollectionView"][data-view="${view}"]`).click();
      const current = document.querySelector('.hub-archive-v3');
      expect(current.dataset.archiveView).toBe(view);
      expect(current.querySelector('.av3-utilities')).toBeNull();
      expect(current.querySelector(selector)).not.toBeNull();
    }
  });

  it('merges only pending achievement and collection claims without mixing unfinished targets or writing the save', () => {
    const { base, render } = setup(), before = JSON.stringify(base.data);
    const root = render('rewards');
    expect(root.querySelectorAll('.av12-record')).toHaveLength(2);
    expect(root.querySelectorAll('.av12-record-detail .av3-inbox-reward')).toHaveLength(1);
    expect(root.querySelector('[data-act="claimAch"]').dataset.id).toBe('firstExtract');
    root.querySelector('[data-act="archiveV12Record"][data-index="1"]').click();
    expect(root.querySelector('[data-act="claimColl"]').dataset.id).toBe('one');
    expect(root.querySelector('.av3-inbox-reward').textContent).not.toContain('累计击败十名敌人');
    expect(root.querySelector('.av3-medal-detail')).toBeNull();
    expect(root.querySelector('.av3-collection-progress')).toBeNull();
    expect(JSON.stringify(base.data)).toBe(before);
  });
  it('shows the active save progress and allows only reached reward claims in the selected medal detail', () => {
    const { base, render } = setup(), snapshot = JSON.stringify(base.data);
    const root = render();
    expect(root.querySelector('.av3-pending-count').textContent).toBe('1 项待领取');
    expect(root.querySelector('.av3-medal-detail [data-act="claimAch"]').dataset.id).toBe('firstExtract');
    root.querySelector('[data-act="archiveV3Medal"][data-id="kill10"]').click();
    expect(root.querySelector('.av3-medal-detail').textContent).toContain('4 / 10');
    expect(root.querySelector('.av3-medal-detail').textContent).toContain('累计击败十名敌人');
    expect(root.querySelector('.av3-medal-detail').textContent).toContain('狼纹');
    expect(root.querySelector('.av3-medal-detail [data-act="claimAch"]')).toBeNull();
    root.querySelector('[data-act="archiveStatus"][data-status="claimable"]').click();
    expect([...root.querySelectorAll('.ach-row')].filter(row => !row.hidden)).toHaveLength(1);
    expect(JSON.stringify(base.data)).toBe(snapshot);
  });

  it('maps the legacy classes route to global milestone records without duplicating the personnel entry or move library', () => {
    const { base, render } = setup(), snapshot = JSON.stringify(base.data);
    const root = render('classes');
    expect(root.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('1');
    expect(root.querySelector('[role="progressbar"]').getAttribute('aria-valuemax')).toBe('3');
    expect(root.querySelector('[data-act="claimColl"]').dataset.id).toBe('one');
    expect(root.querySelector('.av12-record[data-index="1"]').textContent).toMatch(/1\s*\/\s*3/);
    const entries = root.querySelectorAll('[data-act="hubTab"]');
    expect(entries).toHaveLength(0);
    expect(root.querySelector('[data-browser-key],[data-act="collZoom"],[data-act="archiveV3Class"]')).toBeNull();
    expect(JSON.stringify(base.data)).toBe(snapshot);
  });

  it('keeps claimed stages distinct from reached and unfinished stages after a refresh', () => {
    const { meta, render } = setup();
    meta.isCollClaimed = id => id === 'one';
    const root = render('classes');
    expect(root.querySelector('.av12-record-detail').textContent).toContain('已领取');
    expect(root.querySelector('[data-act="claimColl"]')).toBeNull();
    expect(root.querySelector('.av12-record[data-index="1"]').textContent).toMatch(/1\s*\/\s*3/);
  });

  it('previews locked card backs with a real target and never exposes an enabled application action', () => {
    const { render } = setup();
    let root = render('backs');
    expect(root.querySelector('[data-act="selBack"]').textContent).toBe('使用中');
    root.querySelector('[data-act="archiveV3Back"][data-id="wolf"]').click();
    root = document.querySelector('.hub-archive-v3');
    expect(root.querySelector('.av3-back-detail h3').textContent).toBe('狼纹');
    expect(root.querySelector('[data-act="selBack"]').disabled).toBe(true);
    expect(root.querySelector('[data-act="archiveLocate"]').dataset.id).toBe('kill10');
    expect(root.querySelector('.av3-back-condition').textContent).toContain('累计击败十名敌人');
    root.querySelector('[data-act="archiveLocate"]').click();
    root = document.querySelector('.hub-archive-v3');
    expect(root.querySelector('.av3-medal-detail h3').textContent).toContain('猎手');
    expect(document.activeElement.dataset.achievement).toBe('kill10');
  });

  it('resets browsing identity when entering another save', () => {
    const { base, render } = setup();
    render().querySelector('[data-act="archiveV3Medal"][data-id="kill10"]').click();
    expect(render().querySelector('.av3-medal-detail h3').textContent).toContain('猎手');
    base.slot++;
    expect(render().querySelector('.av3-medal-detail h3').textContent).toBe('第一次返乡');
  });

  it('marks unseen story chapters unavailable without advertising clickable content', () => {
    const { render } = setup();
    const root = render('stories');
    expect(root.querySelectorAll('.story-entry:disabled')).toHaveLength(3);
    expect(root.querySelector('.story-reader').textContent).toContain('尚无见闻');
    expect(root.textContent).not.toContain('点击');
  });
});
