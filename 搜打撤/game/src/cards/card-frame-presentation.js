import frames from '../../data/card-frame-layout.json';
import { assetUrl } from '../core/asset-url.js';

const rarities = {
  初始: 'initial', 古朴: 'common', 稀有: 'rare', 史诗: 'epic',
  传说: 'legendary', 衍生: 'token', 棱彩: 'prism',
};
const careers = { 侠客: 'wu', 战士: 'heixiang', 法师: 'baita', 牧师: 'xingyue', 降临者: 'changwuyu' };

// The imported layout and build-version URL are static for this module lifetime.
// Resolve the finite set lazily, so unused career frames cost no startup work.
const presentations = new Map();

/** All card hosts share effective rarity, frame geometry, and natural image ratio. */
export function cardFramePresentation(rarity, career) {
  const key = rarity === '职业'
    ? Object.hasOwn(careers, career) ? careers[career] : 'neutral'
    : Object.hasOwn(rarities, rarity) ? rarities[rarity] : 'initial';
  let presentation = presentations.get(key);
  if (!presentation) {
    const frame = frames[key];
    const [left, top, width, height] = frame.opening;
    presentation = {
      key,
      src: assetUrl(`assets/${frame.path}`),
      width: frame.width,
      height: frame.height,
      style: `--face-left:${left / frame.width * 100}%;--face-top:${top / frame.height * 100}%;--face-width:${width / frame.width * 100}%;--face-height:${height / frame.height * 100}%`,
    };
    presentations.set(key, presentation);
  }
  // Preserve the existing fresh-result contract; a consumer's edits stay local.
  return { ...presentation };
}
