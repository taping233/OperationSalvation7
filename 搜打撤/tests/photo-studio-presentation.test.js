// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { photoMountFor } from '../game/src/hub/photo-studio-presentation.js';
import { createPhotoStudioMotion } from '../game/src/hub/photo-studio-navigation.js';

describe('照相馆稀有度装裱映射', () => {
  it('网格用重绘前宽度保留入场距离，重绘后不再触发布局读取', async () => {
    const grid = document.createElement('div');
    Object.defineProperty(grid, 'clientWidth', { get() { throw new Error('post-write layout read'); } });
    let finish;
    const finished = new Promise(resolve => { finish = resolve; });
    const animation = { finished, cancel: vi.fn() };
    grid.animate = vi.fn(() => animation);
    const motion = createPhotoStudioMotion();
    motion.play(grid, { reason: 'tab', surface: 'grid', width: 500 });
    expect(grid.animate.mock.calls[0][0]).toEqual([
      { opacity: 0, transform: 'translateX(-90px)' },
      { opacity: 1, transform: 'translateX(0)' },
    ]);
    motion.cancelAll();
    expect(animation.cancel).toHaveBeenCalledOnce();
    finish(); await finished;
  });
  it('为每种馆藏稀有度提供稳定的装裱身份与名称', () => {
    const cases = [
      ['初始', 'proof', '初印'],
      ['古朴', 'plain', '相纸'],
      ['稀有', 'rare', '银边装裱'],
      ['史诗', 'epic', '雕花装裱'],
      ['传说', 'legendary', '典藏装裱'],
      ['衍生', 'derived', '附页'],
      ['职业', 'class', '人物档案'],
      ['棱彩', 'prismatic', '棱镜装裱'],
    ];

    for (const [rarity, kind, label] of cases) {
      const mount = photoMountFor(rarity);
      expect(mount).toEqual({ kind, label });
      expect(photoMountFor(rarity)).toBe(mount);
    }
  });

  it('未知稀有度安全回退到普通相纸装裱', () => {
    expect(photoMountFor('未登记稀有度')).toEqual({ kind: 'plain', label: '相纸' });
    expect(photoMountFor('toString')).toBe(photoMountFor('古朴'));
    expect(photoMountFor(undefined)).toBe(photoMountFor('古朴'));
  });
});
