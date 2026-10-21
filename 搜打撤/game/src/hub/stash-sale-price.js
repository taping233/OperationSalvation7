// 仓库售价与局内卡面估值分别计价；未列档位沿用原估值。
const PRICES = new Map([['古朴', 2], ['稀有', 3], ['史诗', 4], ['传说', 5]]);

/** @param {{sellPrice:(card:any)=>number}} cards @param {{rarity?:string}} card */
export function stashSalePrice(cards, card) {
  return PRICES.get(card.rarity) ?? Math.max(0, Number(cards.sellPrice(card)) || 0);
}
