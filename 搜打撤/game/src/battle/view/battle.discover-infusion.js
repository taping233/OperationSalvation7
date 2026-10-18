import { requiresInfusion } from '../effects/battle.infusion.js';
// Presentation only; effectiveInfuse comes from the shared inspection API, including waivers.
export function discoverInfusionNote(act, effectiveInfuse, card) {
  if (effectiveInfuse > 0 && requiresInfusion(card)) {
    if (act === 'pouch') return '未注能，无法施放；锦囊牌不会消耗';
    if (['play', 'potion', 'playKeep'].includes(act)) return '未注能，无法直接施放；所选牌将留在手牌';
  }
  return ['play', 'potion', 'playKeep', 'pouch'].includes(act) && effectiveInfuse > 0 ? '未注能' : '';
}
