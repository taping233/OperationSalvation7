import { describe, it, expect } from 'vitest';
import { photoMountFor } from '../game/src/photo-studio-presentation.js';

describe('照相馆稀有度装裱映射', () => {
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
