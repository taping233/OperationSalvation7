const PHOTO_MOUNTS = Object.freeze({
  初始: Object.freeze({ kind: 'proof', label: '初印' }),
  古朴: Object.freeze({ kind: 'plain', label: '相纸' }),
  稀有: Object.freeze({ kind: 'rare', label: '银边装裱' }),
  史诗: Object.freeze({ kind: 'epic', label: '雕花装裱' }),
  传说: Object.freeze({ kind: 'legendary', label: '典藏装裱' }),
  衍生: Object.freeze({ kind: 'derived', label: '附页' }),
  职业: Object.freeze({ kind: 'class', label: '人物档案' }),
  棱彩: Object.freeze({ kind: 'prismatic', label: '棱镜装裱' }),
});

const DEFAULT_MOUNT = PHOTO_MOUNTS.古朴;

export function photoMountFor(rarity) {
  return Object.prototype.hasOwnProperty.call(PHOTO_MOUNTS, rarity)
    ? PHOTO_MOUNTS[rarity]
    : DEFAULT_MOUNT;
}
