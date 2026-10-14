import { Random } from '../core/random.js';
import { esc } from '../core/shared.js';
import { descRich } from '../cards/cards.view.js';
import { hopPoint, decayOsc, ease } from '../core/motion-primitives.js';

let openBackpack;
export function configureShopRuntime({ openBag }) {
  openBackpack = openBag;
}

let shopOnClose = null;
let shopNotice = '';
let shopPage = 'main';   // 'main' | 'sell'：从背包返回时回到离开前的那一页
let selectedShopIndex = null;

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
  let shopSession = null;
  let pageVersion = 0;
  let bagReturn = null;
  let inspectionClose = null;
  let inspectionMotion = null;
  const currentSession = session => session && session === shopSession && game.state === 'modal'
    && game.shopStock === session.stock && game.ownedCards === session.ownedCards
    && game.seed === session.seed && SDT.Base?.slot === session.slot;
  function cancelInspectionMotion() {
    if (inspectionClose) clearTimeout(inspectionClose.timer);
    inspectionClose = null;
    watchInspectionMotion(null);
  }
  function watchInspectionMotion(detail, handler = null) {
    if (inspectionMotion) inspectionMotion.detail.removeEventListener('animationend', inspectionMotion.handler);
    inspectionMotion = handler ? { detail, handler } : null;
    if (handler) detail.addEventListener('animationend', handler);
  }
  const reducedInspectionMotion = () => SDT.Motion?.reduceMotion?.()
    || document.body.classList.contains('reduce-motion')
    || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function generateShopStock() {
    const lib = SDT.Cards.all().filter(card => card.rarity !== '衍生' && !card.unrandom && card.id !== 'tt-token-color');   // 员工通行证A是碎片合成材料，不上架（2026-09-17 留言口径同卡牌库）
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
    // 2026-09-13 留言：同一面板不允许刷出同样的卡牌（同名不同版也算重复）
    const panelTaken = new Set();
    const pickRandomCard = (taken) => {
      for (let tries = 0; tries < 50; tries++) {
        const card = SDT.Cards.pickOfRarity(pickWeightedRarity());
        if (card && !(taken && taken.has(card.name))) return card;
      }
      const fallback = lib.filter(c => !(taken && taken.has(c.name)));
      return fallback.length ? fallback[Math.floor(Random.random('shop') * fallback.length)] : null;
    };

    const slots = [];
    // 招财猫（需求 #4，2026-09-09）：携带时商店第一格的卡牌免费
    const catFree = !!(SDT.Base.carriedPet && SDT.Base.carriedPet()?.effect?.shopFree);
    for (let i = 0; i < 6; i++) {
      const card = pickRandomCard(panelTaken);
      if (card) panelTaken.add(card.name);
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
    const mysteryCard = (() => {
      // 神秘货箱同样不与面板重复（2026-09-13 留言口径）
      for (let tries = 0; tries < 50; tries++) {
        const card = lib[Math.floor(Random.random('shop') * lib.length)];
        if (card && !panelTaken.has(card.name)) return card;
      }
      return null;
    })();
    if (mysteryCard) panelTaken.add(mysteryCard.name);
    slots.push(mysteryCard
      ? { card: mysteryCard, price: 3, sold: false, mystery: true }
      : { empty: true, label: '卡牌库无货' });
    return slots;
  }

  function openShop(stockKey, onClose) {
    if (typeof stockKey !== 'string') { onClose = stockKey; stockKey = ''; }   // 兼容旧调用（debug/回调直调）
    if (!['idle', 'moving', 'modal'].includes(game.state)) return;
    game.state = 'modal';
    setCardPageOpen(false);
    // D-1 防重刷（2026-09-19 审计）：货架按 shopKey 持久——同一家店（商店格 / 门旁商队）
    // 本局内重复进入不再重 roll、售出状态保留（此前每次 openShop 全量重掷，门旁商店可无限
    // 免费刷货）。货架表随对局存档落盘，刷新/读档同样不可刷。空 key（debug 直调）保持旧行为。
    if (stockKey) {
      game.shopStocks = game.shopStocks || {};
      if (!game.shopStocks[stockKey]) game.shopStocks[stockKey] = generateShopStock();
      game.shopStock = game.shopStocks[stockKey];
    } else {
      game.shopStock = generateShopStock();
    }
    shopSession = { stock: game.shopStock, ownedCards: game.ownedCards, seed: game.seed, slot: SDT.Base?.slot };
    bagReturn = null;
    shopNotice = '';
    selectedShopIndex = null;
    shopOnClose = onClose || null;
    renderShop();
  }

  // 商品原位保留身份、价格与售出状态；点选后才打开局部详情。
  function slotHTML(slot, index) {
    if (slot.empty) return `<div class="shop-slot"><div class="shop-empty">${slot.label || '无货'}</div></div>`;
    const exhausted = slot.sold || (slot.shaReplenish != null && slot.shaReplenish <= 0);
    const title = slot.mystery && !slot.sold ? '神秘货箱' : slot.card?.name || slot.label || '商品';
    const image = slot.mystery && !slot.sold
      ? '<div class="shop-card-mystery">[[icon:dice]]<b>？</b><span>随机卡牌</span></div>'
      : slot.card ? cardHTML(slot.card) : '<div class="shop-empty">已售出</div>';
    const owned = game.ownedCards.filter(item => item.card.name === slot.card?.name).length;
    const status = exhausted ? (slot.shaReplenish != null ? '本站已补满' : slot.mystery ? '已购入 · 已揭晓' : '已售出')
      : slot.shaReplenish != null ? `持有 ${owned} · 余 ${slot.shaReplenish}` : slot.mystery ? '购买后揭晓' : owned > 0 ? `已持有 ${owned}` : '';
    return `<div class="shop-slot${exhausted ? ' sold' : ' buy'}${selectedShopIndex === index ? ' selected' : ''}${!exhausted && game.coins < slot.price ? ' unaffordable' : ''}">
      <button type="button" class="shop-preview" data-act="shopInspect" data-i="${index}" aria-pressed="${selectedShopIndex === index}" aria-label="查看${esc(title)}详情">
        <span class="shop-item-art">${image}</span>${slot.mystery && !slot.sold ? `<span class="shop-item-title">${esc(title)}</span>` : ''}<span class="shop-offer">${status ? `<small class="shop-owned">${status}</small>` : ''}<strong class="shop-v14-price">${exhausted ? '已购' : slot.free ? '免费' : `[[icon:coin]] ${slot.price}`}</strong></span>
      </button></div>`;
  }

  function shopDetailHTML() {
    const slot = game.shopStock[selectedShopIndex];
    if (!slot || slot.empty) return '';
    const exhausted = slot.sold || (slot.shaReplenish != null && slot.shaReplenish <= 0);
    const hasMoney = game.coins >= slot.price;
    const fits = slot.card && (game.canReceiveCard ? game.canReceiveCard(slot.card) : game.canAcceptCard ? game.canAcceptCard(slot.card) : true);
    const status = exhausted ? (slot.mystery ? `已购入「${slot.card?.name || '卡牌'}」，已放入本次远征背包` : '本站已售出')
      : !hasMoney ? `余额不足：还差 ${slot.price - game.coins} 币`
        : !fits ? `背包装不下：${usedSlots()}/${bagCap()} 格` : '去向：本次远征背包';
    const unavailable = !hasMoney || !fits;
    const buyAct = slot.shaReplenish != null ? 'buySha' : 'buyCard';
    const rules = slot.mystery && !slot.sold ? '购买后随机揭晓一张卡牌；本次查看不会提前揭晓。'
      : descRich(slot.card?.desc || '', slot.card?.id) || '此卡暂无规则描述。';
    const hasLongRules = String(slot.card?.desc || '').replace(/<[^>]*>/g, '').length > 80;
    return `<button type="button" class="shop-detail-dismiss" data-act="shopCloseInspect" aria-label="返回商品货架"></button>
      <button type="button" class="shop-detail-close" data-act="shopCloseInspect" aria-label="收起商品详情">×</button>
      <div class="shop-detail-scroll"><div class="shop-detail-art">${slot.mystery && !slot.sold ? '<div class="shop-card-mystery">[[icon:dice]]<b>？</b><span>神秘货箱</span><small>购买后随机揭晓一张卡</small></div>' : slot.card ? cardHTML(slot.card) : ''}</div>
      ${hasLongRules && (!slot.mystery || slot.sold) ? `<details class="shop-detail-rules"><summary>完整规则</summary><p>${rules}</p></details>` : ''}</div>
      <div class="shop-detail-actions">
      <div class="shop-detail-facts"><strong class="${exhausted ? 'tone-complete' : unavailable ? 'tone-limited' : 'tone-ready'}">${status}</strong></div>
      ${exhausted ? '<button type="button" class="shop-detail-done" data-act="shopCloseInspect">继续浏览</button>' : `<button type="button" class="shop-detail-buy${unavailable ? ' short' : ''}" data-act="${buyAct}" data-i="${selectedShopIndex}"${unavailable ? ` disabled aria-disabled="true" title="${esc(status)}"` : ''}>${unavailable ? !hasMoney ? '金币不足' : '背包装不下' : slot.free ? '免费领取' : `购买 · ${slot.price} 币`}</button>`}
      ${!exhausted && hasMoney && !fits ? '<button type="button" class="shop-detail-bag" data-act="shopOpenBag">整理背包</button>' : ''}</div>`;
  }

  // 买不起/装不下时的货位即时反馈（2026-09-19 留言 #1：点了没反应像"买不了"）：
  // 货位抖一下 + 顶栏提示条说明原因
  function denySlotFeedback(index, reason) {
    shopNotice = reason;
    refreshShopSlot(index);
    const el = document.querySelectorAll('.shop-board-grid .shop-slot')[index];
    if (el) {
      el.classList.remove('shop-deny');
      void el.offsetWidth;
      el.classList.add('shop-deny');
    }
  }

  // 买中 carry 演出（2026-09-27 动效补全）：卡面从货位弧线飞进页头「背包」钮，钮体弹性接收。
  // onetake 形制：节拍不换场、东西被带走——货位瞬变 sold 的同时卡面被「接走」。
  // 纯时间函数预采样进 WAAPI（hopPoint 弧线 / decayOsc 接收弹），不阻塞购买结算，失败静默。
  function bagPop(bag) {
    if (!bag || typeof bag.animate !== 'function') return;
    const M = 10, pkf = [];
    for (let i = 0; i <= M; i++) {
      const t = (i / M) * 0.42;
      pkf.push({ transform: `scale(${(1 + decayOsc(t, 0, { amp: 0.16, decay: 9, freq: 13 })).toFixed(3)})`, offset: i / M });
    }
    bag.animate(pkf, { duration: 420, easing: 'linear' });
  }
  // 从屏幕矩形 flyEl 出发弧线飞向背包钮；返回飞行时长（ms）。node 已定位到视口坐标。
  function flyRectToBag(a, node) {
    const bag = document.querySelector('.shop-pg .shop-bag-btn');
    if (!bag || !a.width || !a.height) { node.remove(); return 0; }
    const b = bag.getBoundingClientRect();
    if (!b.width) { node.remove(); return 0; }
    const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
    const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
    const N = 14, DUR = 560, kf = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const pt = hopPoint(u, { x: 0, y: 0 }, { x: dx, y: dy }, { height: Math.min(170, Math.abs(dx) * 0.28 + 80), curve: ease.smoother });
      kf.push({
        transform: `translate(${pt.x.toFixed(1)}px,${pt.y.toFixed(1)}px) scale(${(1 - 0.78 * u).toFixed(3)}) rotate(${(u * 9).toFixed(1)}deg)`,
        opacity: u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.15),
        offset: u,
      });
    }
    try {
      node.animate(kf, { duration: DUR, easing: 'linear', fill: 'forwards' }).onfinish = () => {
        node.remove();
        if (bag.isConnected) bagPop(bag);
      };
    } catch { node.remove(); return 0; }
    setTimeout(() => node.remove(), DUR + 200);   // 兜底清理
    return DUR;
  }
  function flyCardToBag(slotEl) {
    try {
      if (SDT.Motion?.reduceMotion?.()) return;
      const card = slotEl?.querySelector('.hs-card, .shop-card-mystery');
      if (!card || typeof card.animate !== 'function') return;
      const a = card.getBoundingClientRect();
      const fly = card.cloneNode(true);
      fly.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:9999;pointer-events:none;`;
      document.body.appendChild(fly);
      flyRectToBag(a, fly);
    } catch { /* 演出失败不影响购买结算 */ }
  }
  // 神秘货箱 reveal-first（2026-09-27 二轮动效）：？牌先塌缩→原位亮出真卡面（停一拍）→再飞背包。
  // 结算照旧同步完成，只有货位重绘被推迟到演出收尾（done 回调）；任何失败都立刻 done 兜底。
  function revealMysteryThenFly(slotEl, card, done) {
    let finished = false, flip = null, reveal = null;
    const session = shopSession, sourceRoot = slotEl?.closest('.shop-pg');
    const live = () => currentSession(session) && sourceRoot?.isConnected;
    const finish = () => {
      if (finished) return;
      finished = true;
      flip?.remove(); reveal?.remove();
      done();
    };
    try {
      const tile = slotEl?.querySelector('.shop-card-mystery');
      if (!tile || typeof tile.animate !== 'function' || SDT.Motion?.reduceMotion?.()) { finish(); return; }
      const a = tile.getBoundingClientRect();
      if (!a.width) { finish(); return; }
      // 1) ？牌原地塌缩（scaleX→0，240ms）
      flip = tile.cloneNode(true);
      flip.style.cssText = `position:fixed;left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px;margin:0;z-index:9999;pointer-events:none;`;
      document.body.appendChild(flip);
      flip.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: 240, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
        if (finished) return;
        if (!live()) { finish(); return; }
        flip.remove();
        // 2) 真卡面从塌缩点弹出（132×180 sm 卡，同战斗 surge-fly 制式）
        reveal = document.createElement('div');
        reveal.style.cssText = `position:fixed;left:${a.left + a.width / 2 - 66}px;top:${a.top + a.height / 2 - 90}px;width:132px;height:180px;margin:0;z-index:9999;pointer-events:none;`;
        reveal.innerHTML = SDT.Cards.cardHTML ? SDT.Cards.cardHTML(card, 'sm') : esc(card.name || '');
        document.body.appendChild(reveal);
        reveal.animate([
          { transform: 'scale(.4)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ], { duration: 320, easing: 'cubic-bezier(.2,.9,.35,1.18)', fill: 'forwards' });
        // 3) 停一拍让人看清开出了什么，再飞背包；结束后才放行货位重绘
        setTimeout(() => {
          if (finished) return;
          if (!live()) { finish(); return; }
          const rect = reveal.getBoundingClientRect();
          const dur = flyRectToBag(rect, reveal);
          setTimeout(finish, dur + 60);
        }, 720);
      };
      setTimeout(finish, 2600);   // 全链路兜底：动画事件丢失也能收尾
    } catch { finish(); }
  }
  // 购买 carry 分派：神秘货箱走 reveal 序列（货位重绘推迟），普通购买立即飞+重绘
  function playBuyCarry(slotEl, slot, done) {
    if (slot?.mystery && slotEl?.querySelector('.shop-card-mystery')) { revealMysteryThenFly(slotEl, slot.card, done); return; }
    flyCardToBag(slotEl);
    done();
  }

  function renderShop() {
    if (!currentSession(shopSession)) return;
    cancelInspectionMotion();
    const version = ++pageVersion, session = shopSession;
    bagReturn = null;
    shopPage = 'main';
    const slots = game.shopStock.map(slotHTML).join('');
    const sellableCount = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored).length;
    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 能量饮料（2 币，回 6 血） + 初始攻击补充（1 币/张，每站最多 5 张）+ 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>收购台</b>补给站的收购台可挑卡卖掉。默认卡牌不可出售；只有带「可出售」备注的卡才能卖，收购价 = 卡面币值。</p>`,
      back: () => { if (version === pageVersion && currentSession(session) && document.querySelector('.help-body')) renderShop(); },
    });
    UI.showOverlay('', `
      <div class="pg shop-pg shop-market shop-v14 shop-replica node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><h2>补给站 ${UI.helpBtn('shop')}</h2></div>
          <div class="shop-resources" aria-label="远征资源"><span class="shop-resource coin"><small>金币</small><b id="resCoins">${game.coins}</b><em>币</em></span><span class="shop-resource"><small>容量</small><b id="resCap">${usedSlots()}/${bagCap()}</b><em>格</em></span></div>
        </header>
        <div class="shop-layout">
        <div class="shop-board" aria-label="商店商品">
          <div class="shop-board-grid">
            ${slots}
          </div>
        </div>
        <aside class="shop-merchant" aria-label="行商服务">
          <div class="shop-merchant-caption"><span>冬境行商</span><p>“风雪还没停。<br>带上用得着的，再走吧。”</p></div>
          <div class="shop-services">
            <button class="shop-sellpost" data-act="openSell" title="打开收购台，挑卡卖掉">
              <span class="sellpost-copy"><span class="sellpost-name">出售卡牌</span><span class="sellpost-hint">${sellableCount ? `${sellableCount} 张可出售` : '暂无可出售卡牌'}</span></span>
              <span class="sellpost-enter">→</span>
            </button>
            <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 整理背包</button>
          </div>
        </aside>
        <aside class="shop-detail" role="dialog" aria-label="当前商品详情"${selectedShopIndex == null ? ' hidden' : ''}>${shopDetailHTML()}</aside>
        </div>
        <footer class="shop-market-footer"><span class="shop-live" id="shopLive" aria-live="polite">${shopNotice}</span><button class="shop-back" data-act="closeShop">[[icon:arrow]] 离开补给站</button></footer>
      </div>`, 'page');
    const shopRoot = document.querySelector('.shop-replica');
    registerShopActs(shopRoot);
    shopRoot?.addEventListener('sdt-dev-console-return', () => {
      const grid = shopRoot.querySelector('.shop-board-grid');
      if (grid) {
        const stockHTML = game.shopStock.map(slotHTML).join('');
        grid.innerHTML = SDT.Icons?.rich?.(stockHTML) || stockHTML;
      }
      refreshShopSlot(selectedShopIndex ?? 0);
    });
    shopRoot?.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || (selectedShopIndex == null && !inspectionClose)) return;
      event.preventDefault();
      event.stopPropagation();
      closeShopInspection();
    });
    UI.refresh(game);
  }

  // 卖牌处二级界面：收购台（2026-09-10 留言 #23：只列出可以卖的牌，不再把不可卖的也铺出来置灰）
  function renderSellPage() {
    if (!currentSession(shopSession)) return;
    cancelInspectionMotion();
    const version = ++pageVersion, session = shopSession;
    bagReturn = null;
    shopPage = 'sell';
    const sellableOwned = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored);   // 珍珠盒中存放的资源卡不在此列出（2026-09-10 #29）
    const total = sellableOwned.length;
    const totalValue = sellableOwned.reduce((sum, owned) => sum + SDT.Cards.sellPrice(owned.card), 0);
    const rows = sellableOwned.map(owned => `
      <div class="bag-card sell-item">
        ${cardHTML(owned.card, 'sm')}
        <div class="sell-item-offer"><span>商队估值</span><b>+${SDT.Cards.sellPrice(owned.card)} 币</b></div>
        <button class="mini-btn ok" data-act="sellCard" data-uid="${owned.uid}">确认卖出</button>
      </div>`).join('');
    const ownedAll = game.ownedCards.length;
    const grid = total
      ? `<div class="shop-sell">${rows}</div>`
      : `<p class="shop-sell-empty">背包里没有可以卖的卡牌（持有 ${ownedAll} 张）——只有带「可出售」备注的卡（货币卡等）商店才收。</p>`;
    UI.registerHelp('shopSell', {
      title: '卖牌处说明',
      html: `<p class="help-item"><b>收购规则</b>这里只显示可以卖的牌；默认卡牌不可出售，只有带「可出售」备注的卡（货币/宝石类等）才能卖给商店，收购价 = 卡面币值。</p>`,
      back: () => { if (version === pageVersion && currentSession(session) && document.querySelector('.help-body')) renderSellPage(); },
    });
    UI.showOverlay('', `
      <div class="pg shop-pg shop-exchange node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><span class="shop-kicker">ACQUISITION DESK // 08</span><h2>[[icon:cards]] 收购台 ${UI.helpBtn('shopSell')}</h2><p>只收带有“可出售”备注的卡牌，其他卡不会出现在这里。</p></div>
          <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 背包</button>
          <div class="shop-resources"><span class="shop-resource coin"><small>当前金币</small><b>${game.coins}</b><em>币</em></span><span class="shop-resource"><small>可出售</small><b>${total}</b><em>张</em></span></div>
        </header>
        <div class="shop-board sell-board">
          <div class="sell-desk">
            <aside class="sell-ledger">
              <span class="sell-ledger-kicker">MERCHANT LEDGER</span>
              <h3>商队收购单</h3>
              <div class="sell-ledger-total"><small>本页可换取</small><b>${totalValue}</b><span>币</span></div>
              <dl><div><dt>持有卡牌</dt><dd>${ownedAll} 张</dd></div><div><dt>符合条件</dt><dd>${total} 张</dd></div><div><dt>当前金币</dt><dd>${game.coins} 币</dd></div></dl>
              <div class="sell-ledger-rule"><b>收购规则</b><p>仅识别带“可出售”备注的货币与宝石类卡牌。点击“确认卖出”后立即成交，价格等于卡面币值。</p></div>
            </aside>
            <section class="sell-catalog" aria-label="可出售卡牌">
              <div class="sell-catalog-head"><div><span>APPRAISAL LIST</span><h3>待估物清单</h3></div><b>${total} 件</b></div>
              ${grid}
            </section>
          </div>
        </div>
        <button class="shop-back" data-act="backShop">[[icon:arrow]] 返回商店</button>
      </div>`, 'page');
    registerShopActs(document.querySelector('.shop-exchange'));
    UI.refresh(game);
  }

  // 购买后只重绘该货位 + 顶栏数字（配合留言 #33：整页入场动画只在页面切换时重播）
  function refreshShopSlot(index) {
    const slots = document.querySelectorAll('.shop-board-grid .shop-slot');
    const el = slots[index];
    const hadFocus = el?.contains(document.activeElement);
    if (el) {
      el.outerHTML = slotHTML(game.shopStock[index], index);
      if (hadFocus) {
        const current = document.querySelectorAll('.shop-board-grid .shop-slot')[index];
        (current?.querySelector('.shop-preview') || document.querySelector('.shop-market .shop-bag-btn'))?.focus({ preventScroll:true });
      }
    }
    const live = document.getElementById('shopLive');
    if (live) live.textContent = shopNotice || '';
    const detail = document.querySelector('.shop-market .shop-detail');
    if (detail) {
      detail.hidden = selectedShopIndex == null;
      const detailHadFocus = detail.contains(document.activeElement);
      const scrollTop = detail.querySelector('.shop-detail-scroll')?.scrollTop || 0;
      detail.innerHTML = SDT.Icons?.rich?.(shopDetailHTML()) || shopDetailHTML();
      const scroller = detail.querySelector('.shop-detail-scroll');
      if (scroller) scroller.scrollTop = scrollTop;
      if (detailHadFocus) {
        const nextAction = detail.querySelector('.shop-detail-buy:not(:disabled), .shop-detail-done, .shop-detail-bag');
        (nextAction || document.querySelector(`.shop-board-grid .shop-preview[data-i="${selectedShopIndex}"]`))?.focus({ preventScroll:true });
      }
    }
    const pairs = [['resCards', game.ownedCards.length], ['resCoins', game.coins], ['resCap', `${usedSlots()}/${bagCap()}`]];
    for (const [id, val] of pairs) {
      const node = document.getElementById(id);
      if (!node) continue;
      if (node.textContent !== String(val) && typeof UI.popNum === 'function') UI.popNum(node);   // 数值变化弹跳（口径同 HUD popNum）
      node.textContent = val;
    }
    document.querySelectorAll('.shop-board-grid .shop-slot').forEach((slot, stockIndex) => {
      const stock = game.shopStock[stockIndex];
      slot.classList.toggle('unaffordable', !stock?.empty && !stock?.sold && game.coins < stock.price);
    });
  }
  function closeShopInspection() {
    if (selectedShopIndex == null) return;
    const previousIndex = selectedShopIndex;
    selectedShopIndex = null;
    const detail = document.querySelector('.shop-market .shop-detail');
    const close = { detail, timer:null };
    inspectionClose = close;
    const finish = () => {
      if (inspectionClose !== close) return;
      inspectionClose = null;
      if (detail) {
        detail.hidden = true; detail.innerHTML = ''; detail.inert = false;
        watchInspectionMotion(detail);
        delete detail.dataset.shopMotion;
      }
      if (detail?.isConnected) document.querySelector(`.shop-board-grid .shop-preview[data-i="${previousIndex}"]`)?.focus({ preventScroll:true });
    };
    if (detail && !reducedInspectionMotion()) {
      detail.inert = true;
      detail.dataset.shopMotion = 'out';
      watchInspectionMotion(detail, event => {
        if (event.target === detail && event.animationName === 'shop-detail-out') {
          clearTimeout(close.timer); finish();
        }
      });
      const seconds = parseFloat(getComputedStyle(detail).animationDuration);
      close.timer = setTimeout(finish, (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 180) + 60);
    } else finish();
    document.querySelectorAll('.shop-board-grid .shop-slot').forEach(slot => {
      slot.classList.remove('selected');
      slot.querySelector('.shop-preview')?.setAttribute('aria-pressed', 'false');
    });
  }
  function registerShopActs(root) {
    const version = pageVersion, session = shopSession;
    // 页面重绘、离店、换店或换档后，旧动作不能按新货架索引继续成交。
    const live = () => root?.isConnected && version === pageVersion && currentSession(session);
    const register = (name, handler) => UI.act(name, data => { if (live()) handler(data || {}); });
    register('shopCloseInspect', closeShopInspection);
    register('shopInspect', data => {
      const i = Number(data.i);
      if (!game.shopStock[i] || game.shopStock[i].empty) return;
      if (inspectionClose) { clearTimeout(inspectionClose.timer); inspectionClose = null; }
      selectedShopIndex = i;
      document.querySelectorAll('.shop-board-grid .shop-slot').forEach((slot, index) => {
        slot.classList.toggle('selected', index === i);
        slot.querySelector('.shop-preview')?.setAttribute('aria-pressed', String(index === i));
      });
      const detail = document.querySelector('.shop-market .shop-detail');
      if (detail) {
        watchInspectionMotion(detail);
        detail.inert = false;
        detail.hidden = false;
        detail.innerHTML = SDT.Icons?.rich?.(shopDetailHTML()) || shopDetailHTML();
        if (reducedInspectionMotion()) delete detail.dataset.shopMotion;
        else {
          detail.dataset.shopMotion = 'in';
          watchInspectionMotion(detail, event => {
            if (event.target !== detail || event.animationName !== 'shop-detail-in') return;
            delete detail.dataset.shopMotion;
            watchInspectionMotion(detail);
          });
        }
        detail.querySelector('.shop-detail-close')?.focus({ preventScroll:true });
      }
    });
    register('shopOpenBag', () => {
      // 关闭背包后回到商店当前页（主商店/收购台），不再踢回地图
      const returnPage = shopPage;
      const onReturn = () => {
        if (bagReturn !== onReturn || version !== pageVersion || !currentSession(session)) return;
        // 普通背包关闭时仍留有退出中的 .bag-view；减少动态时弹层已同步清空。
        if (!document.querySelector('.bag-view') && !UI.el?.overlay?.hidden) return;
        bagReturn = null;
        (returnPage === 'sell' ? renderSellPage : renderShop)();
      };
      bagReturn = onReturn;
      openBackpack(onReturn);
      // 战斗背包接口 SDT.Battle.commands.openBag 只在战斗内可用，非战斗态直接调会抛
      // TypeError（实测：reading 'isBoss'）；showBackpack 是它的通用外壳，战斗中会自己转过去。
    });
    register('buyCard', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.sold || slot.empty) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `币不够——这张要 ${slot.price} 币，身上只有 ${game.coins} 币`);
        return;
      }
      if (game.canReceiveCard
        ? !game.canReceiveCard(slot.card)
        : (!game.ownedCards.some(owned => owned.card.name === slot.card.name) && !game.canAcceptCard(slot.card))) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格；同名每格最多叠 3 张——初始攻击/火球 5 张，堆满后另占一格），买不下这张卡`, 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `背包装不下（${usedSlots()}/${bagCap()} 格）`);
        return;
      }
      game.coins -= slot.price;
      slot.sold = true;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      shopNotice = `已购入「${slot.card.name}」 · 剩余 ${game.coins} 币`;
      SDT.Sound.sfx('tradeBuy');
      UI.log(`[[icon:bag]] 购买卡牌【<b>${esc(slot.card.name)}</b>】（- ${slot.price} 币，剩 ${game.coins}）`, 'coin');
      saveGame();
      playBuyCarry(document.querySelectorAll('.shop-board-grid .shop-slot')[+data.i], slot, () => {});
      refreshShopSlot(+data.i);   // 真实购入状态与余额先落位，飞行动画只解释去向
    });
    register('buySha', data => {
      const slot = game.shopStock[+data.i];
      if (!slot || slot.shaReplenish == null || slot.shaReplenish <= 0) return;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `币不够——补一张初始攻击要 ${slot.price} 币，身上只有 ${game.coins} 币`);
        return;
      }
      // 2026-09-17 留言「商店现在每次只卖3张初始攻击」：补充位只受背包容量约束（同名堆叠
      // 不设 5 张上限——上限曾随背包存量吃掉可买数量，观感即「只卖 N 张」）。
      // 2026-09-19 审计 P2-7：改走 canReceiveCard 统一口径——堆未满并入不占格、堆满或
      // 满包拒买；旧判定「满包但有同名就放行」会在堆也满时把第 6 张推出容量外
      if (!game.canReceiveCard(slot.card)) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格；初始攻击每格最多叠 5 张，堆满后另占一格），补充不了`, 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `补不了——背包已满（${usedSlots()}/${bagCap()} 格）`);
        return;
      }
      game.coins -= slot.price;
      slot.shaReplenish--;
      game.ownedCards.push({ uid: newUid(), card: { ...slot.card } });
      shopNotice = `已补充初始攻击 ×1 · 剩余 ${game.coins} 币`;
      SDT.Sound.sfx('tradeBuy');
      UI.log(`[[icon:bag]] 补充初始攻击 ×1（- ${slot.price} 币，剩 ${game.coins} · 本站还可补 ${slot.shaReplenish} 张）`, 'coin');
      saveGame();
      playBuyCarry(document.querySelectorAll('.shop-board-grid .shop-slot')[+data.i], slot, () => {});
      refreshShopSlot(+data.i);
    });
    register('sellCard', data => {
      const index = game.ownedCards.findIndex(owned => owned.uid === data.uid);
      if (index < 0) return;
      const owned = game.ownedCards[index];
      if (!SDT.Cards.isSellable(owned.card)) {
        UI.log(`卡牌【${esc(owned.card.name)}】不可出售`, 'warn');
        return;
      }
      if (owned.stored) return;   // 珍珠盒存放中的卡不可出售（G-2，2026-09-29 夜班：与收购台渲染过滤同口径，直调 act 不再放行）
      const price = SDT.Cards.sellPrice(owned.card);
      game.ownedCards.splice(index, 1);
      game.coins += price;
      SDT.Sound.sfx('tradeSell');
      shopNotice = `已出售「${owned.card.name}」 · 当前 ${game.coins} 币`;
      UI.log(`[[icon:coin]] 出售卡牌【<b>${esc(owned.card.name)}</b>】（+ ${price} 币，现有 ${game.coins}）`, 'coin');
      saveGame();
      renderSellPage();
    });
    register('openSell', renderSellPage);
    register('backShop', renderShop);
    register('closeShop', () => {
      shopSession = null;
      bagReturn = null;
      pageVersion++;
      cancelInspectionMotion();
      UI.hideOverlay();
      game.state = 'idle';
      const cb = shopOnClose; shopOnClose = null;
      // 2026-09-06 #20：商队逛完回到节点选择界面（环间门 / 祭坛入口）
      if (cb) cb(); else UI.refresh(game);
    });
  }

  return { openShop };
}

export { createShopController };
