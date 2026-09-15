import { Random } from './random.js';
import { esc } from './shared.js';

let openBackpack;
export function configureShopRuntime({ openBag }) {
  openBackpack = openBag;
}

let shopOnClose = null;
let shopNotice = '';
let shopPage = 'main';   // 'main' | 'sell'：从背包返回时回到离开前的那一页

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
    // 招财猫（需求 #4，2026-09-09）：携带时商店第一格的卡牌免费
    const catFree = !!(SDT.Base.carriedPet && SDT.Base.carriedPet()?.effect?.shopFree);
    for (let i = 0; i < 6; i++) {
      const card = pickRandomCard();
      slots.push(card
        ? { card, price: (catFree && i === 0) ? 0 : (SDT.Cards.PRICE[card.rarity] || 2), sold: false, free: catFree && i === 0 }
        : { empty: true, label: '卡牌库无货' });
    }
    // 初始牌槽位已移除：杀/火球为初始牌，不上架（2026-09-06）；神秘货箱特殊栏位仍可能刷出
    // 固定栏位（2026-09-10 需求）：2 币回 6 血，替代原金疮药（3 币回 10 血）；
    // 2026-09-12 老板拍板：桃与能量饮料完全重复，删桃，栏位改用能量饮料（同为 0 费回 6 血、币值 2）
    const healSlot = lib.find(card => card.id === 'tt4-woodify') ||
      SDT.Cards.all().find(card => card.id === 'tt4-woodify');
    slots.push({ card: healSlot, price: 2, sold: false });
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
    shopNotice = '';
    shopOnClose = onClose || null;
    renderShop();
  }

  // 货位渲染：卡面 + 下方价签（对齐参考图：价格挂在卡牌正下方）
  function slotHTML(slot, index) {
    if (slot.empty) return `<div class="shop-slot"><div class="shop-empty">${slot.label || '无货'}</div></div>`;
    if (slot.sold) {
      // 神秘货箱开出后亮出卡面（2026-09-09 留言 #6：买完随机卡要马上告诉玩家是什么）
      if (slot.mystery && slot.card) return `<div class="shop-slot">${cardHTML(slot.card)}
        <span class="shop-slotnote">[[icon:dice]] 神秘货箱开出</span></div>`;
      return '<div class="shop-slot sold"><div class="shop-empty">已售出</div></div>';
    }
    const afford = game.coins >= slot.price;
    // 2026-09-12 留言：直接点击卡牌即可购买（价格挂卡面右上角标），不再点下面的金币钮
    const priceTag = `<span class="shop-price${afford ? '' : ' short'}">${slot.free ? '[[icon:paw]] 免费' : `[[icon:coin]] ${slot.price}`}</span>`;
    const shortAttr = afford ? '' : ' data-short="1"';
    // 2026-09-13：货位是 div，Tab 走不到、读屏也读不出价格——补 button 语义（Enter/Space 由 bindShopKeys 触发）
    const buyAttrs = (act, label) => `class="shop-slot buy" data-act="${act}" data-i="${index}"${shortAttr} role="button" tabindex="0" aria-label="${esc(label)}" title="${afford ? '点击购买' : '币不够'}"`;
    if (slot.shaReplenish != null) {
      if (slot.shaReplenish <= 0) return '<div class="shop-slot sold"><div class="shop-empty">初始攻击已补满</div></div>';
      // 本站剩余张数并进价签：原来单独挂一行备注，把该格撑高 48px，同排价格签因此低 20px
      return `<div ${buyAttrs('buySha', `补充初始攻击，${slot.price} 币，本站余 ${slot.shaReplenish} 张`)}>${cardHTML(slot.card)}
        <span class="shop-price${afford ? '' : ' short'}">[[icon:coin]] ${slot.price} · 余 ${slot.shaReplenish}</span>
      </div>`;
    }
    if (slot.mystery) return `<div ${buyAttrs('buyCard', `购买神秘货箱，开出随机卡牌，${slot.price} 币`)}><div class="shop-empty">[[icon:dice]] 随机卡牌</div>${priceTag}</div>`;
    return `<div ${buyAttrs('buyCard', `购买「${slot.card.name}」，${slot.price} 币`)}>${cardHTML(slot.card)}${priceTag}</div>`;
  }

  function renderShop() {
    shopPage = 'main';
    const slots = game.shopStock.map(slotHTML).join('');
    const sellableCount = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card)).length;
    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 能量饮料（2 币，回 6 血） + 初始攻击补充（1 币/张，每站最多 5 张）+ 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>卖牌处</b>货板右下角的鎏金圆牌：点进收购台挑卡卖掉。默认所有卡牌不可出售；只有带「可出售」备注的卡才能卖，收购价 = 卡面币值。</p>`,
      back: renderShop,
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><span class="shop-kicker">TACTICAL SUPPLY // 07</span><h2>[[icon:bag]] 冬境战术补给站 ${UI.helpBtn('shop')}</h2></div>
          <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 背包</button>
          <div class="shop-resources" data-act="shopOpenBag" title="点击打开背包" aria-label="远征资源（点击打开背包）"><span class="shop-resource"><small>持有卡牌</small><b id="resCards">${game.ownedCards.length}</b><em>张</em></span><span class="shop-resource coin"><small>当前金币</small><b id="resCoins">${game.coins}</b><em>币</em></span><span class="shop-resource"><small>背包容量</small><b id="resCap">${usedSlots()}/${bagCap()}</b><em>格</em></span></div>
        </header>
          <div class="shop-toolbar"><div><b>补给清单</b><span>六个随机货位 · 能量饮料 · 初始攻击补充 · 神秘货箱</span></div><span class="shop-live" id="shopLive" aria-live="polite">${shopNotice || '点击货位即可直接购买（价签＝价格）'}</span></div>
        <div class="shop-board" aria-label="商店商品">
          <div class="shop-board-grid">
            ${slots}
            <button class="shop-sellpost" data-act="openSell" title="打开收购台，挑卡卖掉">
              <span class="sellpost-coin">[[icon:cards]]</span>
              <span class="sellpost-name">卖牌处</span>
              <span class="sellpost-hint">${sellableCount ? `可卖 ${sellableCount} 张` : '暂无可卖卡牌'}</span>
            </button>
          </div>
        </div>
        <button class="shop-back" data-act="closeShop">[[icon:arrow]] 离开补给站</button>
      </div>`, 'page');
    registerShopActs();
    UI.refresh(game);
  }

  // 卖牌处二级界面：收购台（2026-09-10 留言 #23：只列出可以卖的牌，不再把不可卖的也铺出来置灰）
  function renderSellPage() {
    shopPage = 'sell';
    const sellableOwned = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored);   // 珍珠盒中存放的资源卡不在此列出（2026-09-10 #29）
    const total = sellableOwned.length;
    const rows = sellableOwned.map(owned => `
      <div class="bag-card sell-item">
        ${cardHTML(owned.card, 'sm')}
        <button class="mini-btn ok" data-act="sellCard" data-uid="${owned.uid}">卖出 +${SDT.Cards.sellPrice(owned.card)} 币</button>
      </div>`).join('');
    const ownedAll = game.ownedCards.length;
    const grid = total
      ? `<div class="shop-sell">${rows}</div>`
      : `<p class="shop-sell-empty">背包里没有可以卖的卡牌（持有 ${ownedAll} 张）——只有带「可出售」备注的卡（货币卡等）商店才收。</p>`;
    UI.registerHelp('shopSell', {
      title: '卖牌处说明',
      html: `<p class="help-item"><b>收购规则</b>这里只显示可以卖的牌；默认卡牌不可出售，只有带「可出售」备注的卡（货币/宝石类等）才能卖给商店，收购价 = 卡面币值。</p>`,
      back: renderSellPage,
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><span class="shop-kicker">ACQUISITION DESK // 08</span><h2>[[icon:cards]] 收购台 ${UI.helpBtn('shopSell')}</h2><p>只收带有“可出售”备注的卡牌，其他卡不会出现在这里。</p></div>
          <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 背包</button>
          <div class="shop-resources"><span class="shop-resource coin"><small>当前金币</small><b>${game.coins}</b><em>币</em></span><span class="shop-resource"><small>可出售</small><b>${total}</b><em>张</em></span></div>
        </header>
        <div class="shop-board sell-board">
          ${total ? `<p class="sell-tip">持有 ${ownedAll} 张 · 可卖 ${total} 张——其余卡没打「可出售」备注，商店不收（不在此显示）</p>` : ''}
          ${grid}
        </div>
        <button class="shop-back" data-act="backShop">[[icon:arrow]] 返回商店</button>
      </div>`, 'page');
    registerShopActs();
    UI.refresh(game);
  }

  // 购买后只重绘该货位 + 顶栏数字（配合留言 #33：整页入场动画只在页面切换时重播）
  function refreshShopSlot(index) {
    const slots = document.querySelectorAll('.shop-board-grid .shop-slot');
    const el = slots[index];
    if (el) el.outerHTML = slotHTML(game.shopStock[index], index);
    const live = document.getElementById('shopLive');
    if (live) live.textContent = shopNotice || '';
    const pairs = [['resCards', game.ownedCards.length], ['resCoins', game.coins], ['resCap', `${usedSlots()}/${bagCap()}`]];
    for (const [id, val] of pairs) {
      const node = document.getElementById(id);
      if (node) node.textContent = val;
    }
  }
  // 货位是 div：补了 button 语义后键盘也要能买（Enter/Space），整页只绑一次
  let shopKeysBound = false;
  function bindShopKeys() {
    if (shopKeysBound || !UI.el || !UI.el.ovBody) return;
    shopKeysBound = true;
    UI.el.ovBody.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const el = e.target.closest && e.target.closest('.shop-slot.buy[data-act], .shop-sellpost[data-act], .shop-bag-btn[data-act]');
      if (!el) return;
      e.preventDefault();
      el.click();
    });
  }
  function registerShopActs() {
    bindShopKeys();
    UI.act('shopOpenBag', () => {
      // 关闭背包后回到商店当前页（主商店/收购台），不再踢回地图
      openBackpack(() => { game.state = 'modal'; (shopPage === 'sell' ? renderSellPage : renderShop)(); });
      // 战斗背包接口 SDT.Battle.commands.openBag 只在战斗内可用，非战斗态直接调会抛
      // TypeError（实测：reading 'isBoss'）；showBackpack 是它的通用外壳，战斗中会自己转过去。
    });
    UI.act('buyCard', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.sold || slot.empty) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      if (game.canReceiveCard
        ? !game.canReceiveCard(slot.card)
        : (!game.ownedCards.some(owned => owned.card.name === slot.card.name) && !game.canAcceptCard(slot.card))) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格，同名卡最多叠 3 张——初始攻击/火球 5 张），买不下这张卡`, 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      game.coins -= slot.price;
      slot.sold = true;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      shopNotice = `已购入「${slot.card.name}」 · 剩余 ${game.coins} 币`;
      SDT.Sound.sfx('gain');
      UI.log(`[[icon:bag]] 购买卡牌【<b>${esc(slot.card.name)}</b>】（- ${slot.price} 币，剩 ${game.coins}）`, 'coin');
      saveGame();
      refreshShopSlot(+data.i);
    });
    UI.act('buySha', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.shaReplenish == null || slot.shaReplenish <= 0) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      // 需求（2026-09-13 老板）：背包满时不能再获得卡牌——补充初始攻击与买卡同口径
      //（叠放上限内并入不占格；堆满或新格需要空位，「初始攻击」叠放上限 5 张）
      if (game.canReceiveCard
        ? !game.canReceiveCard(slot.card)
        : (!game.ownedCards.some(owned => owned.card.name === slot.card.name) && !game.canAcceptCard(slot.card))) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格，初始攻击最多叠 5 张），补充不了`, 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      game.coins -= slot.price;
      slot.shaReplenish--;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      shopNotice = `已补充初始攻击 ×1 · 剩余 ${game.coins} 币`;
      SDT.Sound.sfx('gain');
      UI.log(`[[icon:bag]] 补充初始攻击 ×1（- ${slot.price} 币，剩 ${game.coins} · 本站还可补 ${slot.shaReplenish} 张）`, 'coin');
      saveGame();
      refreshShopSlot(+data.i);
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
      shopNotice = `已出售「${owned.card.name}」 · 当前 ${game.coins} 币`;
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
