import { Random } from './random.js';
import { esc } from './shared.js';

let shopOnClose = null;

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
    // 稀有度权重与宝箱爆率同源（2026-09-08 定版：古朴60/稀有28/史诗9/传说3），
    // 档内挑卡走 pickOfRarity（类型均分，道具 ×0.7）
    const weights = SDT.Cards.SHOP_WEIGHTS;
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const pickWeightedRarity = () => {
      let roll = Random.random('shop') * total;
      for (const [rarity, weight] of Object.entries(weights)) {
        roll -= weight;
        if (roll <= 0) return rarity;
      }
      return '古朴';
    };
    const pickRandomCard = () => {
      for (let tries = 0; tries < 50; tries++) {
        const card = SDT.Cards.pickOfRarity(pickWeightedRarity());
        if (card) return card;
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
    // 初始牌槽位已移除：杀/火球为初始牌，不上架（2026-09-06）；神秘货箱特殊栏位仍可能刷出
    const firstAid = lib.find(card => card.id === 'tt-jinchuangyao') ||
      SDT.Cards.TABLETOP10.find(card => card.id === 'tt-jinchuangyao');
    slots.push({ card: firstAid, price: 3, sold: false });
    // 初始攻击补充位（2026-09-08 老板定版）：固定栏位，1 币 1 张，每次到站最多补 5 张
    slots.push({ card: { ...SDT.Cards.SHA }, price: 1, sold: false, shaReplenish: 5 });
    const mysteryCard = lib.length ? lib[Math.floor(Random.random('shop') * lib.length)] : null;
    slots.push(mysteryCard
      ? { card: mysteryCard, price: 3, sold: false, mystery: true }
      : { empty: true, label: '卡牌库无货' });
    return slots;
  }

  function openShop(onClose) {
    if (!['idle', 'moving', 'modal'].includes(game.state)) return;
    game.state = 'modal';
    setCardPageOpen(false);
    game.shopStock = generateShopStock();
    shopOnClose = onClose || null;
    renderShop();
  }

  // 货位渲染：卡面 + 下方价签（对齐参考图：价格挂在卡牌正下方）
  function slotHTML(slot, index) {
    if (slot.empty) return `<div class="shop-slot"><div class="shop-empty">${slot.label || '无货'}</div></div>`;
    if (slot.sold) return '<div class="shop-slot sold"><div class="shop-empty">已售出</div></div>';
    const afford = game.coins >= slot.price;
    if (slot.shaReplenish != null) {
      if (slot.shaReplenish <= 0) return '<div class="shop-slot sold"><div class="shop-empty">初始攻击已补满</div></div>';
      return `<div class="shop-slot">${cardHTML(slot.card)}
        <button class="shop-price" data-act="buySha" data-i="${index}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${slot.price}</button>
        <span class="shop-slotnote">初始攻击 · 本站余 ${slot.shaReplenish}/5</span>
      </div>`;
    }
    if (slot.mystery) return `<div class="shop-slot"><div class="shop-empty">[[icon:dice]] 随机卡牌</div>
      <button class="shop-price" data-act="buyCard" data-i="${index}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${slot.price}</button>
    </div>`;
    return `<div class="shop-slot">${cardHTML(slot.card)}
      <button class="shop-price" data-act="buyCard" data-i="${index}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${slot.price}</button>
    </div>`;
  }

  function renderShop() {
    const slots = game.shopStock.map(slotHTML).join('');
    const sellableCount = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card)).length;
    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 金疮药 + 初始攻击补充（1 币/张，每站最多 5 张）+ 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>卖牌处</b>货板右下角的鎏金圆牌：点进收购台挑卡卖掉。默认所有卡牌不可出售；只有带「可出售」备注的卡才能卖，收购价 = 卡面币值。</p>`,
      back: renderShop,
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <h2>[[icon:bag]] 拾荒商队 ${UI.helpBtn('shop')}</h2>
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip" title="背包中卡牌张数（含同名堆叠）——方便对照货板决定买不买">[[icon:cards]] <b>${game.ownedCards.length}</b> 张卡牌</span>
            <span class="res-chip">[[icon:coin]] <b class="gold">${game.coins}</b> 币</span>
          </span>
        </header>
        <div class="shop-board">
          <div class="shop-board-grid">
            ${slots}
            <button class="shop-sellpost" data-act="openSell" title="打开收购台，挑卡卖掉">
              <span class="sellpost-coin">[[icon:cards]]</span>
              <span class="sellpost-name">卖牌处</span>
              <span class="sellpost-hint">${sellableCount ? `可卖 ${sellableCount} 张` : '暂无可卖卡牌'}</span>
            </button>
          </div>
        </div>
        <button class="shop-back" data-act="closeShop">[[icon:arrow]] 离开商店</button>
      </div>`, 'page');
    registerShopActs();
    UI.refresh(game);
  }

  // 卖牌处二级界面：收购台（全部持有卡，可卖的亮着，其余置灰说明）
  function renderSellPage() {
    const total = game.ownedCards.length;
    const sellableCount = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card)).length;
    const rows = game.ownedCards.map(owned => {
      const sellable = SDT.Cards.isSellable(owned.card);
      return `<div class="bag-card sell-item${sellable ? '' : ' no'}">
        ${cardHTML(owned.card, 'sm')}
        ${sellable
          ? `<button class="mini-btn ok" data-act="sellCard" data-uid="${owned.uid}">卖出 +${SDT.Cards.sellPrice(owned.card)} 币</button>`
          : '<span class="sell-no">不可出售</span>'}
      </div>`;
    }).join('');
    const grid = total
      ? `<div class="shop-sell">${rows}</div>`
      : '<p class="shop-sell-empty">背包里还没有卡牌。</p>';
    UI.registerHelp('shopSell', {
      title: '卖牌处说明',
      html: `<p class="help-item"><b>收购规则</b>默认所有卡牌不可出售；只有带「可出售」备注的卡才能卖给商店，收购价 = 卡面币值。</p>`,
      back: renderSellPage,
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <h2>[[icon:cards]] 卖牌处 ${UI.helpBtn('shopSell')}</h2>
          <span class="pg-spacer"></span>
          <span class="hub-res"><span class="res-chip">[[icon:coin]] <b class="gold">${game.coins}</b> 币</span></span>
        </header>
        <div class="shop-board sell-board">
          <p class="sell-tip">持有 ${total} 张 · 可卖 ${sellableCount} 张——置灰的卡没打「可出售」备注，商店不收</p>
          ${grid}
        </div>
        <button class="shop-back" data-act="backShop">[[icon:arrow]] 返回商店</button>
      </div>`, 'page');
    registerShopActs();
    UI.refresh(game);
  }

  function registerShopActs() {
    UI.act('buyCard', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.sold || slot.empty) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      if (!game.ownedCards.some(owned => owned.card.name === slot.card.name) && !game.canAcceptCard(slot.card)) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格${slot.card.type !== '资源' ? '，珍珠盒扩格只收资源卡' : ''}），买不下这张卡`, 'warn');
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
    UI.act('buySha', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.shaReplenish == null || slot.shaReplenish <= 0) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      game.coins -= slot.price;
      slot.shaReplenish--;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      SDT.Sound.sfx('gain');
      UI.log(`[[icon:bag]] 补充初始攻击 ×1（- ${slot.price} 币，剩 ${game.coins} · 本站还可补 ${slot.shaReplenish} 张）`, 'coin');
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
      renderSellPage();
    });
    UI.act('openSell', renderSellPage);
    UI.act('backShop', renderShop);
    UI.act('closeShop', () => {
      UI.hideOverlay();
      game.state = 'idle';
      const cb = shopOnClose; shopOnClose = null;
      // 2026-09-06 #20：商队逛完回到节点选择界面（环间门 / 祭坛入口）
      if (cb) cb(); else UI.refresh(game);
    });
  }

  return { generateShopStock, openShop };
}

export { createShopController };
