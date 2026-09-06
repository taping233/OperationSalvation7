import { Random } from './random.js';
import { esc } from './shared.js';

function createShopController({
  UI,
  SDT,
  game,
  bagCap,
  cardHTML,
  newUid,
  saveGame,
  setCardPageOpen,
  usedSlots,
}) {
  function generateShopStock() {
    const lib = SDT.Cards.all().filter(card => card.rarity !== '衍生' && !card.unrandom);
    const weights = SDT.Cards.SHOP_WEIGHTS;
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const pickWeightedRarity = () => {
      let roll = Random.random('shop') * total;
      for (const [rarity, weight] of Object.entries(weights)) {
        roll -= weight;
        if (roll <= 0) return rarity;
      }
      return '初始';
    };
    const pickRandomCard = () => {
      for (let tries = 0; tries < 50; tries++) {
        const rarity = pickWeightedRarity();
        const pool = lib.filter(card => card.rarity === rarity);
        if (pool.length) return pool[Math.floor(Random.random('shop') * pool.length)];
      }
      return lib.length ? lib[Math.floor(Random.random('shop') * lib.length)] : null;
    };

    const slots = [];
    for (let i = 0; i < 6; i++) {
      const card = pickRandomCard();
      slots.push(card
        ? { card, price: SDT.Cards.PRICE[card.rarity] || 2, sold: false }
        : { empty: true, label: '卡牌库无货' });
    }
    const starters = lib.filter(card => card.rarity === '初始');
    slots.push(starters.length
      ? { card: starters[Math.floor(Random.random('shop') * starters.length)], price: SDT.Cards.PRICE['初始'], sold: false }
      : { empty: true, label: '暂无初始牌' });
    slots.push({ card: SDT.Cards.POTION, price: 3, sold: false });
    const mysteryCard = lib.length ? lib[Math.floor(Random.random('shop') * lib.length)] : null;
    slots.push(mysteryCard
      ? { card: mysteryCard, price: 3, sold: false, mystery: true }
      : { empty: true, label: '卡牌库无货' });
    return slots;
  }

  function openShop() {
    if (!['idle', 'moving', 'modal'].includes(game.state)) return;
    game.state = 'modal';
    setCardPageOpen(false);
    game.shopStock = generateShopStock();
    renderShop();
  }

  function renderShop() {
    const slots = game.shopStock.map((slot, index) => {
      if (slot.empty) return `<div class="shop-slot"><div class="shop-empty">${slot.label || '无货'}</div></div>`;
      if (slot.sold) return '<div class="shop-slot sold"><div class="shop-empty">已售出</div></div>';
      const afford = game.coins >= slot.price;
      if (slot.mystery) return `<div class="shop-slot"><div class="shop-empty">[[icon:dice]] 随机卡牌</div>
        <button class="mini-btn ok" data-act="buyCard" data-i="${index}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${slot.price} 币</button>
      </div>`;
      return `<div class="shop-slot">${cardHTML(slot.card)}
        <button class="mini-btn ok" data-act="buyCard" data-i="${index}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${slot.price} 币</button>
      </div>`;
    }).join('');
    const sellables = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card));
    const sellItems = sellables.length
      ? sellables.map(owned => `
          <div class="bag-card">
            ${cardHTML(owned.card, 'sm')}
            <button class="mini-btn ok" data-act="sellCard" data-uid="${owned.uid}">出售 ＋${SDT.Cards.sellPrice(owned.card)} 币</button>
          </div>`).join('')
      : '<p class="shop-sell-empty">没有可出售的卡牌——只有带「可出售」备注的卡才能卖给商店（默认不可出售）。</p>';

    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 1 张初始牌 + 金疮药 + 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>出售</b>默认所有卡牌不可出售；只有带「可出售」备注的卡才能卖给商店，收购价 = 卡面币值。</p>`,
      back: renderShop,
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <h2>[[icon:bag]] 拾荒商队 ${UI.helpBtn('shop')}</h2>
          <span class="pg-spacer"></span>
          <span class="hub-res"><span class="res-chip">[[icon:coin]] <b class="gold">${game.coins}</b> 币</span></span>
        </header>
        <div class="shop-grid">
          ${slots}
          <aside class="shop-side">
            <div class="shop-coinbox">[[icon:coin]] 持有 <b class="gold">${game.coins}</b> 币</div>
            <button class="ov-btn" data-act="closeShop">[[icon:exit]] 离开商店</button>
          </aside>
        </div>
        <h3 class="set-h">出售卡牌</h3>
        <div class="shop-sell">${sellItems}</div>
      </div>`, 'page');
    UI.act('buyCard', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.sold || slot.empty) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      if (!game.ownedCards.some(owned => owned.card.name === slot.card.name) && usedSlots() >= bagCap()) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），买不下这张卡`, 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      game.coins -= slot.price;
      slot.sold = true;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      SDT.Sound.sfx('gain');
      UI.log(`[[icon:bag]] 购买卡牌【<b>${esc(slot.card.name)}</b>】（- ${slot.price} 币，剩 ${game.coins}）`, 'coin');
      saveGame();
      renderShop();
    });
    UI.act('sellCard', data => {
      const index = game.ownedCards.findIndex(owned => owned.uid === data.uid);
      if (index < 0) return;
      const owned = game.ownedCards[index];
      if (!SDT.Cards.isSellable(owned.card)) {
        UI.log(`卡牌【${esc(owned.card.name)}】不可出售`, 'warn');
        return;
      }
      const price = SDT.Cards.sellPrice(owned.card);
      game.ownedCards.splice(index, 1);
      game.coins += price;
      UI.log(`[[icon:coin]] 出售卡牌【<b>${esc(owned.card.name)}</b>】（+ ${price} 币，现有 ${game.coins}）`, 'coin');
      saveGame();
      renderShop();
    });
    UI.act('closeShop', () => {
      UI.hideOverlay();
      game.state = 'idle';
      UI.refresh(game);
    });
    UI.refresh(game);
  }

  return { generateShopStock, openShop };
}

export { createShopController };
