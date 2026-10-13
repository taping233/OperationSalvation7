import { esc, escAttr } from '../core/shared.js';

const MATERIAL_CARD_IDS = { wood: 'tt-wood', rations: 'tt-rations' };

// 只陈列现行商品；购买、预览与物资详情仍由基地动作入口处理。
export function shopV3HTML({ base, cards, art, goods }) {
  const all = cards.all();
  const room = base.stashRoom();
  const coins = base.data.coins;
  const needsRoom = room === 0 && goods.some(good => !good.material);
  const rows = goods.map((good, index) => {
    const material = !!good.material;
    const card = all.find(item => item.id === (material ? MATERIAL_CARD_IDS[good.material] : good.id));
    const name = material ? good.name : card?.name || '未上架';
    const owned = material ? base.data[good.material] || 0
      : base.data.stash.filter(stack => stack.card.id === good.id).reduce((sum, stack) => sum + stack.count, 0);
    const missing = [
      !material && !card ? '暂缺商品' : '',
      coins < good.price ? `还需 ${good.price - coins} 储备币` : '',
      !material && room === 0 ? '仓库已满' : '',
    ].filter(Boolean);
    const itemShortfall = missing.filter(reason => reason !== '仓库已满');
    const preview = material
      ? `data-act="rawItem" data-kind="${escAttr(good.material)}"`
      : `data-act="shopPreview" data-i="${index}"`;
    const unit = material ? good.material === 'wood' ? '个' : '份' : '张';
    const illustration = card && art?.cardIcon ? art.cardIcon(card, { low: true }) : '';
    return `<article class="shop-v3-product${material ? ' shop-v3-product--material' : ''}${missing.length ? ' is-unavailable' : ''}" data-goods-id="${escAttr(good.id || good.material)}">
        <header class="shop-v3-product-heading"><h3 class="shop-v3-product-name">${esc(name)}</h3><span>${material ? '基地物资' : esc(card?.type || '卡牌')}</span></header>
        <button type="button" class="shop-v3-preview" ${preview} aria-label="查看${escAttr(name)}详情"${!material && !card ? ' disabled' : ''}>
          <span class="shop-v3-art">${illustration || '<span class="shop-v3-no-art">暂无原画</span>'}</span>
          <span class="shop-v3-enlarge" aria-hidden="true">↗</span>
        </button>
        <div class="shop-v3-inventory">
          <p class="shop-v3-meta">持有 <b>${owned}</b> ${unit}</p>
          <span class="shop-v3-price" aria-label="${good.price} 储备币">[[icon:coin]] <b>${good.price}</b></span>
        </div>
        <div class="shop-v3-checkout">
          <button type="button" class="shop-v3-buy base-command base-command-primary" data-act="shopBuy" data-i="${index}"${missing.length ? ' disabled' : ''} aria-label="购买${escAttr(name)} ×1，${good.price} 储备币${missing.length ? `，${escAttr(missing.join(' · '))}` : ''}"><span class="base-command-label">购买 ×1</span><span class="base-command-arrow" aria-hidden="true">→</span></button>
          ${itemShortfall.length ? `<p class="shop-v3-shortfall">${esc(itemShortfall.join(' · '))}</p>` : ''}
        </div>
      </article>`;
  }).join('');
  return `<div class="shop-v3">
    <header class="shop-v3-heading"><h2>补给</h2><div class="shop-v3-wallet"><span>储备币</span><span>[[icon:coin]] <b>${coins}</b></span></div></header>
    <section class="shop-v3-goods" aria-label="补给货架">${rows}</section>
    ${needsRoom ? '<footer class="shop-v3-footer"><span>卡牌仓库已满</span><button type="button" class="shop-v3-link" data-act="hubTab" data-tab="stash" data-view="cards">整理仓库 →</button><button type="button" class="shop-v3-link" data-act="hubTab" data-tab="upgrade" data-facility="stash">扩建 →</button></footer>' : ''}
  </div>`;
}
