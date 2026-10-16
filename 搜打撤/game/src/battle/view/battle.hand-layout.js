// Keep the reading size stable; fit a hand by changing overlap, not card typography.
const CARD_WIDTH = 260;
const PREFERRED_STEP = 190;
const REST_DROP = 284;
export function handDisplayLayout(index, count, width) {
  if (!Number.isInteger(count) || count < 1 || count > 9 || !Number.isInteger(index) || index < 0 || index >= count) {
    throw new RangeError('Battle hand layout supports one to nine groups');
  }
  const available = Number.isFinite(width) ? Math.max(CARD_WIDTH, width) : 1150;
  const step = count > 1 ? Math.min(PREFERRED_STEP, (available - CARD_WIDTH) / (count - 1)) : 0;
  return { index, x: Math.round((index - (count - 1) / 2) * step), y: 0, rot: 0, scale: 1,
    rest: REST_DROP,
    visibleWidth: index === count - 1 ? CARD_WIDTH - 16 : Math.max(0, Math.floor(step) - 16) };
}
