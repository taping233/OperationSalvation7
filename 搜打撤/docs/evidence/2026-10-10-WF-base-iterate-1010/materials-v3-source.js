import { baseIcon } from './hub.visuals.js';

export function resourceStripHTML(base) {
  const items = [['wood', '木材', base.data.wood || 0, 'wood'], ['rations', '口粮', base.data.rations || 0, 'bread'], ['key', '钥匙', base.data.keys || 0, 'key'], ['coin', '储备币', base.data.coins || 0, 'coin']];
  if (base.data.nestUnlocked || base.data.runes?.length) items.push(['rune', '符文', base.data.runes?.length || 0, 'crystal']);
  return `<div class="base-resource-strip" aria-label="基地物资">${items.map(([id, label, count, fallback]) => `<span class="base-resource-value">${baseIcon(id, fallback)}<span>${label}</span><b>${count}</b></span>`).join('')}</div>`;
}
