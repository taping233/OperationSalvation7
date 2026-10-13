// Theme-only achievement art. Each atlas uses the same six-column, five-row catalogue.
export const ACHIEVEMENT_MEDAL_IDS = Object.freeze([
  'firstExtract', 'extract3', 'kill10', 'firstBoss', 'allBoss', 'rich30',
  'stash20', 'bagMax', 'safeMax', 'class3', 'collectGold', 'collectLegend',
  'collect5', 'petHatch1', 'petHatch3', 'petMax', 'petAll', 'unlimitedEnergy',
  'weaponMaster', 'runeFan', 'savior', 'beautifulVase', 'excuseMe',
  'labScore1', 'labScore2', 'labScore3',
]);
const ATLASES = Object.freeze({
  painted: new URL('../../assets/ui/achievement-styles/painted.webp', import.meta.url).href,
  gesture: new URL('../../assets/ui/achievement-styles/gesture.webp', import.meta.url).href,
  ink: new URL('../../assets/ui/achievement-styles/ink.webp', import.meta.url).href,
  collage: new URL('../../assets/ui/achievement-styles/collage.webp', import.meta.url).href,
  symbol: new URL('../../assets/ui/achievement-styles/symbol.webp', import.meta.url).href,
});
export const ACHIEVEMENT_MEDAL_STYLES = Object.freeze(Object.keys(ATLASES));

// Called once when the gallery opens; filtering and detail views reuse its selection.
export function pickAchievementMedalStyle(random = Math.random) {
  return ACHIEVEMENT_MEDAL_STYLES[Math.floor(random() * ACHIEVEMENT_MEDAL_STYLES.length)];
}

export function achievementMedalHTML(id, instance = 'tile', style = 'painted') {
  const index = Math.max(0, ACHIEVEMENT_MEDAL_IDS.indexOf(id));
  const selected = ACHIEVEMENT_MEDAL_STYLES.includes(style) ? style : 'painted';
  const column = index % 6;
  const row = Math.floor(index / 6);
  const cellHeight = 172.5; // Matches the 256 × 368 extracted panels without stretching.
  const instanceKey = instance === 'detail' ? 'detail' : instance === 'watermark' ? 'watermark' : 'tile';
  const clipId = `medal-crop-${index}-${selected}-${instanceKey}`;
  // Only fixed catalogue keys and bundled URLs enter attributes. The SVG viewport crops one cell.
  return `<svg class="ag-badge" viewBox="0 0 120 ${cellHeight}" aria-hidden="true" data-medal="${ACHIEVEMENT_MEDAL_IDS[index]}" data-medal-style="${selected}" data-medal-instance="${instanceKey}">
    <defs><clipPath id="${clipId}"><rect width="120" height="${cellHeight}"/></clipPath></defs>
    <g clip-path="url(#${clipId})"><image href="${ATLASES[selected]}" x="${-column * 120}" y="${-row * cellHeight}" width="720" height="${cellHeight * 5}" preserveAspectRatio="none"/></g>
  </svg>`;
}
