import '../../css/rarity-reveal.css';

export function rewardRarity(card) {
  return window.SDT?.Cards?.rarityOf?.(card) || card?.rarity || '';
}
export const hasRareReveal = rarity => ['稀有', '史诗', '传说', '棱彩'].includes(rarity);
