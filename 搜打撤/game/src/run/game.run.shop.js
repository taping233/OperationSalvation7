import { beginRoomSave } from '../ui/room-footer.js';
import { createRoomActions } from '../ui/room-actions.js';
import { createPageSurfaceLifetime } from '../ui/page-surface-lifetime.js';
import { uiDisclosure } from '../ui/ui-disclosure.js';
import { linkedBackHTML } from '../ui/home-linked-interactions.js';
import { completeSurfaceMotion } from '../ui/motion-completion.js';
import { motionReduced, motionTiming } from '../ui/motion-presets.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { Random } from '../core/random.js';
import { esc } from '../core/shared.js';
import { descRich } from '../cards/cards.view.js';
import { hopPoint, decayOsc, ease } from '../core/motion-primitives.js';
import { captureShopBrowseState, restoreShopBrowseState } from './shop-browse-state.js';
import { openShopCommission } from './shop-commission.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { createShopCommands } from './shop-commands.js';
import { nodeChestRewardAt, restoreChestReward, serializeChestReward } from './chest-reward-save.js';
import { syncViewChildren } from '../ui/view-children-sync.js';

let openBackpack;
const mysteryCardArt = new URL('../../assets/cards/shop-mystery-back-1025.webp', import.meta.url).href;
const mysteryCardHTML = () => `<div class="shop-card-mystery"><img src="${mysteryCardArt}" alt="神秘卡牌问号卡背" decoding="async" draggable="false"></div>`;
export function configureShopRuntime({ openBag }) {
  openBackpack = openBag;
}

let shopOnClose = null;
const shopNotice = createOperationNotice();
let shopPage = 'main';   // 'main' | 'sell'：从背包返回时回到离开前的那一页
let selectedShopIndex = null;
const merchantLines = ['我很看好你哦', '这是上一个人卖给我的，想知道他后来怎么样吗', '赊账？下次我考虑一下', '消费是世界进步的源泉', '想要变得更强吗'];

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
  let shelfReturn = null;
  let inspectionClose = null;
  let inspectionMotion = null;
  let transacting = false;
  // The detail shade covers only these siblings, not the visible header/footer.
  const inspectionBackground = new WeakMap();
  let inspectionSurface = null;
  function setInspectionBackground(root, blocked) {
    if (blocked && root && inspectionSurface?.root !== root) {
      if (inspectionSurface) setInspectionBackground(inspectionSurface.root, false);
      const surface = { root, lifetime:null };
      inspectionSurface = surface;
      surface.lifetime = createPageSurfaceLifetime(root, {
        overlay:UI.el?.overlay || root.closest("#overlay") || root.parentElement,
        onInvalidate: () => { if (inspectionSurface === surface) cancelInspectionMotion(); },
      });
    } else if (!blocked && inspectionSurface?.root === root) {
      inspectionSurface.lifetime?.dispose();
      inspectionSurface = null;
    }
    root?.querySelectorAll('.shop-layout > .shop-board, .shop-layout > .shop-merchant').forEach(node => {
      if (blocked) {
        if (!inspectionBackground.has(node)) inspectionBackground.set(node, node.hasAttribute('inert'));
        node.setAttribute('inert', '');
      } else if (inspectionBackground.has(node)) {
        if (!inspectionBackground.get(node)) node.removeAttribute('inert');
        inspectionBackground.delete(node);
      }
    });
  }
  const currentSession = session => session && session === shopSession && game.state === 'modal'
    && game.shopStock === session.stock && game.ownedCards === session.ownedCards
    && game.layerIdx === session.layerIdx && game.trackPos === session.trackPos
    && game.seed === session.seed && SDT.Base?.slot === session.slot;
  const canReceive = card => game.canReceiveCard ? game.canReceiveCard(card)
    : game.canAcceptCard ? game.canAcceptCard(card) : true;
  const publish = notify => { try { notify(); } catch { /* UI feedback cannot undo an accepted transaction. */ } };
  async function persistShop(session) {
    const previous = transacting;
    transacting = true;
    let saved;
    try { saved = await saveRunCheckpoint(saveGame); } finally { transacting = previous; }
    session.unsaved = !saved;
    return saved;
  }
  function tradeReceipt(session, notice, saved) {
    if (!currentSession(session)) return;
    shopNotice.set(notice + (saved ? '' : ' · 本局已成交，保存未成功，请重试保存后离开'), saved ? 'ok' : 'warn');
    if (!saved) publish(() => UI.log('[[icon:cross]] 本局已成交，币、背包与货架已同步更新；保存未成功，离店时可重试保存。', 'warn'));
  }
  const trades = createShopCommands({ state:game, canReceive, newUid,
    isSellable:card => SDT.Cards.isSellable(card), sellPrice:card => SDT.Cards.sellPrice(card),
    prepareAcquiredReward:card => {
      if (card.id !== 'tt2-apollo') return null;
      const pool = SDT.Cards.all().filter(candidate => candidate.id !== card.id && SDT.Cards.isRandomObtainable(candidate));
      if (!pool.length) return null;
      const extra = pool[Math.floor(Random.random('loot', 'reward') * pool.length)];
      const reward = { kind:'small', cards:[extra], coins:0, coinsReceived:false, taken:[], lost:[],
        source:'阿猫的礼物 · 神秘货箱附赠', title:'领取附赠' };
      const existing = nodeChestRewardAt(game), restored = existing && restoreChestReward(game, existing);
      const queue = restored ? [...restored.queue, {kind:'small', reward}] : [{kind:'small', reward}];
      const snapshot = serializeChestReward(game, queue, restored?.index || 1, restored?.current || reward,
        restored?.context || {onCell:true}, {screen:restored?.screen || 'cards'});
      if (!snapshot) throw new Error('附赠奖励无法保存');
      const rewards = game.nodeChestRewards || {}, key = `${game.layerIdx},${game.trackPos}`;
      return { snapshot, commit:() => { game.nodeChestRewards = rewards; rewards[key] = snapshot; } };
    },
    save:() => persistShop(shopSession) });
  function cancelInspectionMotion() {
    inspectionClose?.cancel?.();
    inspectionClose = null;
    watchInspectionMotion(null);
    if (inspectionSurface) setInspectionBackground(inspectionSurface.root, false);
  }
  function watchInspectionMotion(detail, handler = null) {
    inspectionMotion?.cancel();
    inspectionMotion = handler ? {
      cancel:completeSurfaceMotion(detail, handler, { name:'shop-detail-in', duration:motionTiming.regionEnter }),
    } : null;
  }
  const reducedInspectionMotion = () => SDT.Motion?.reduceMotion?.() || motionReduced();

  function generateShopStock() {
    const lib = SDT.Cards.all().filter(card => SDT.Cards.isRandomObtainable(card)
      && SDT.Cards.DROP_TYPES.includes(card.type) && card.id !== 'tt-token-color');
    // 稀有度权重与搜刮点爆率同源（2026-09-08 定版：古朴60/稀有28/史诗9/传说3），
    // 档内挑卡走 pickOfRarity（类型均分，道具 ×0.7）
    const weights = SDT.Cards.SHOP_WEIGHTS;
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    const pickWeightedRarity = () => {
      let roll = Random.random('shop', 'reward') * total;
      for (const [rarity, weight] of Object.entries(weights)) {
        roll -= weight;
        if (roll <= 0) return rarity;
      }
      return '古朴';
    };
    // 2026-09-13 留言：同一面板不允许刷出同样的卡牌（同名不同版也算重复）
    const healSlot = lib.find(card => card.id === 'tt4-woodify') ||
      SDT.Cards.all().find(card => card.id === 'tt4-woodify');
    const panelTaken = new Set(healSlot ? [healSlot.name] : []);
    const pickRandomCard = (taken) => {
      for (let tries = 0; tries < 50; tries++) {
        const card = SDT.Cards.pickOfRarity(pickWeightedRarity());
        if (card && !(taken && taken.has(card.name))) return card;
      }
      const fallback = lib.filter(c => !(taken && taken.has(c.name)));
      return fallback.length ? fallback[Math.floor(Random.random('shop', 'reward') * fallback.length)] : null;
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
    slots.push({ card: healSlot, price: 2, sold: false });
    // 初始攻击补充位（2026-09-08 老板定版）：固定栏位，1 币 1 张，每次到站最多补 5 张
    slots.push({ card: { ...SDT.Cards.SHA }, price: 1, sold: false, shaReplenish: 5 });
    const mysteryCard = (() => {
      // 神秘货箱同样不与面板重复（2026-09-13 留言口径）
      for (let tries = 0; tries < 50; tries++) {
        const card = lib[Math.floor(Random.random('shop', 'reward') * lib.length)];
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
    if (transacting) return;
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
    shopSession = { stock: game.shopStock, ownedCards: game.ownedCards, seed: game.seed, slot: SDT.Base?.slot,
      layerIdx:game.layerIdx, trackPos:game.trackPos, merchantLine:0 };
    bagReturn = null;
    shopNotice.clear();
    shelfReturn = null;
    selectedShopIndex = null;
    shopOnClose = onClose || null;
    const session = shopSession;
    const revealCommission = () => openShopCommission({ game, UI, SDT, stockKey, save:() => persistShop(session),
      current:() => currentSession(session), renderShop:() => { if (!revealCommission()) renderShop(); },
      leave:() => { if (currentSession(session)) { shopSession = null; UI.hideOverlay(); game.state = 'idle'; const cb = shopOnClose; shopOnClose = null; cb?.(); } },
    });
    if (revealCommission()) return;
    renderShop();
  }

  // Reuse the approved HUD currency art; the surrounding text carries its meaning.
  const coinIconHTML = () => `<span class="shop-coin-icon" aria-hidden="true">${SDT.Icons?.img?.('coin') || ''}</span>`;
  const moneyHTML = amount => `${coinIconHTML()}<span class="shop-money-value">${amount}</span><span class="shop-money-unit">币</span>`;
  function slotAvailability(slot) {
    const exhausted = slot.sold || (slot.shaReplenish != null && slot.shaReplenish <= 0);
    const hasMoney = game.coins >= slot.price;
    const fits = exhausted || (slot.card && canReceive(slot.card));
    const state = exhausted ? 'sold' : !hasMoney ? 'short' : !fits ? 'full' : 'ready';
    const label = exhausted ? (slot.shaReplenish != null ? '补充已售罄' : '已售出')
      : !hasMoney ? `还差 ${slot.price - game.coins} 币` : !fits ? '背包装不下' : slot.free ? '可免费领取' : '可购买';
    return { exhausted, hasMoney, fits, state, label };
  }
  function slotPreviewLabel(slot, availability) {
    const title = slot.mystery && !slot.sold ? '神秘货箱' : slot.card?.name || slot.label || '商品';
    return `查看${title}详情，${slot.free ? '免费' : `${slot.price} 金币`}，${availability.label}`;
  }

  // 商品原位保留身份、价格与售出状态；点选后才打开局部详情。
  function slotHTML(slot, index) {
    if (slot.empty) return `<div class="shop-slot"><div class="shop-empty">${slot.label || '无货'}</div></div>`;
    const availability = slotAvailability(slot);
    const { exhausted, hasMoney, state, label } = availability;
    const title = slot.mystery && !slot.sold ? '神秘货箱' : slot.card?.name || slot.label || '商品';
    const image = slot.mystery && !slot.sold
      ? mysteryCardHTML()
      : slot.card ? cardHTML(slot.card, undefined, { hideValue: true }) : '<div class="shop-empty">已售出</div>';
    const owned = game.ownedCards.filter(item => item.card.name === slot.card?.name).length;
    const status = exhausted ? (slot.shaReplenish != null ? '本站已补满' : slot.mystery ? '已购入 · 已揭晓' : '')
      : slot.shaReplenish != null ? `持有 ${owned} · 余 ${slot.shaReplenish}` : slot.mystery ? '购买后揭晓' : owned > 0 ? `已持有 ${owned}` : '';
    return `<div class="shop-slot${slot.commissionFree && !exhausted ? ' commission-free' : ''}${exhausted ? ' sold' : ' buy'}${selectedShopIndex === index ? ' selected' : ''}${!exhausted && !hasMoney ? ' unaffordable' : ''}" data-availability="${state}">
      <button type="button" class="shop-preview" data-act="shopInspect" data-i="${index}" aria-pressed="${selectedShopIndex === index}" aria-label="${esc(slotPreviewLabel(slot, availability))}">
        <span class="shop-item-art">${image}</span>${slot.mystery && !slot.sold ? `<span class="shop-item-title">${esc(title)}</span>` : ''}<span class="shop-offer"><span class="shop-offer-copy"><span class="shop-stock-state">${label}</span>${status ? `<small class="shop-owned">${status}</small>` : ''}</span><strong class="shop-v14-price">${slot.free ? '免费' : moneyHTML(slot.price)}</strong></span>
      </button>
</div>`;
  }

  function shopDetailHTML() {
    const slot = game.shopStock[selectedShopIndex];
    if (!slot || slot.empty) return '';
    const { exhausted, hasMoney, fits } = slotAvailability(slot);
    const moneyStatus = !hasMoney ? `还差 ${slot.price - game.coins} 币` : '';
    const capacityStatus = !fits ? `背包装不下：${usedSlots()}/${bagCap()} 格` : '';
    const status = exhausted ? (slot.mystery ? `已购入「${slot.card?.name || '卡牌'}」，已放入本次远征背包` : '本站已售出')
      : [moneyStatus, capacityStatus].filter(Boolean).join(' · ');
    const unavailable = !hasMoney || !fits;
    const buyAct = slot.shaReplenish != null ? 'buySha' : 'buyCard';
    const rules = slot.mystery && !slot.sold ? '随机卡牌 ×1牌；本次查看不会提前揭晓。'
      : descRich(slot.card?.desc || '', slot.card?.id) || '此卡暂无规则描述。';
    const hasLongRules = String(slot.card?.desc || '').replace(/<[^>]*>/g, '').length > 80;
    return `<button type="button" class="shop-detail-dismiss" data-act="shopCloseInspect" aria-label="返回商品货架"></button>
      <button type="button" class="shop-detail-close" data-act="shopCloseInspect" aria-label="收起商品详情">×</button>
      <div class="shop-detail-scroll"><div class="shop-detail-art">${slot.mystery && !slot.sold ? mysteryCardHTML() : slot.card ? cardHTML(slot.card, undefined, { hideValue: true }) : ''}</div>
      ${hasLongRules && (!slot.mystery || slot.sold) ? `<details class="shop-detail-rules"><summary>完整规则</summary><p>${rules}</p></details>` : ''}</div>
      <div class="shop-detail-actions">
      ${status ? `<div class="shop-detail-facts">${exhausted ? `<strong class="tone-complete">${esc(status)}</strong>`
        : unavailable ? `${moneyStatus ? `<strong class="tone-limited">${esc(moneyStatus)}</strong>` : ''}${capacityStatus ? `<strong class="tone-limited">${esc(capacityStatus)}</strong>` : ''}`
          : ''}</div>` : ''}
      ${exhausted ? '<button type="button" class="shop-detail-done ui-control" data-act="shopCloseInspect">继续浏览</button>' : `<button type="button" class="shop-detail-buy ui-control${unavailable ? ' short' : ''}" data-act="${buyAct}" data-i="${selectedShopIndex}"${unavailable ? ` disabled aria-disabled="true" title="${esc(status)}"` : ''}>${slot.free && !unavailable ? '免费领取' : `<span>${unavailable ? !hasMoney ? '金币不足' : '背包装不下' : '购买'}</span><span class="shop-buy-price"> · ${coinIconHTML()}${slot.price} 币</span>`}</button>`}
      ${!exhausted && !fits ? '<button type="button" class="shop-detail-bag ui-control-compact" data-act="shopOpenBag">整理背包</button>' : ''}</div>`;
  }

  // 买不起/装不下时的货位即时反馈（2026-09-19 留言 #1：点了没反应像"买不了"）：
  // 货位抖一下 + 顶栏提示条说明原因
  function denySlotFeedback(index, reason) {
    shopNotice.set(reason, 'warn');
    refreshShopSlot(index);
    const el = document.querySelectorAll('.shop-board-grid .shop-slot')[index];
    if (el) {
      el.classList.remove('shop-deny');
      void /** @type {HTMLElement} */ (el).offsetWidth;
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

  // showOverlay queues initial focus first. Only this rendered shop page may
  // restore its own browse snapshot on the following frame.
  function restoreBrowseOnFrame(root, snapshot, session, visibleSelector = '') {
    const version = pageVersion;
    requestAnimationFrame(() => {
      if (pageVersion !== version || !currentSession(session) || !root?.isConnected
        || (visibleSelector && (UI.el?.overlay?.hidden || UI.el?.ovBody?.querySelector(visibleSelector) !== root))) return;
      restoreShopBrowseState(root, UI.el?.ovBody, snapshot);
    });
  }

  function renderShop() {
    if (!currentSession(shopSession)) return false;
    cancelInspectionMotion();
    const version = pageVersion + 1, session = shopSession;
    const slots = game.shopStock.map(slotHTML).join('');
    const sellableCount = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored).length;
    UI.showOverlay('', `
      <div class="pg shop-pg shop-market shop-v14 shop-replica node-pg sc-shop ui-scale-system" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><h2>补给站 ${UI.helpBtn('shop')}</h2></div>
          <div class="shop-resources" aria-label="远征资源"><span class="shop-resource coin">${coinIconHTML()}<small>可用金币</small><b id="resCoins">${game.coins}</b><em>币</em></span><span class="shop-resource"><small>容量</small><b id="resCap">${usedSlots()}/${bagCap()}</b><em>格</em></span></div>
        </header>
        <div class="shop-layout">
        <div class="shop-board" aria-label="商店商品">
          <div class="shop-board-grid">
            ${slots}
          </div>
        </div>
        <aside class="shop-merchant" aria-label="神秘人服务">
          <button type="button" class="shop-merchant-caption" data-act="shopTalk" aria-label="与神秘人交谈"><span>神秘人</span><span class="shop-merchant-line" aria-live="polite">“${merchantLines[session.merchantLine]}”</span></button>
          <div class="shop-services">
            <button class="shop-sellpost" data-act="openSell" title="打开收购台，挑卡卖掉">
              ${coinIconHTML()}<span class="sellpost-copy"><span class="sellpost-name">出售卡牌</span><span class="sellpost-hint">${sellableCount ? `${sellableCount} 张可出售` : '暂无可出售卡牌'}</span></span>
              <span class="sellpost-enter">→</span>
            </button>
            <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 整理背包</button>
          </div>
        </aside>
        <aside class="shop-detail" role="dialog" aria-label="当前商品详情"${selectedShopIndex == null ? ' hidden' : ''}>${shopDetailHTML()}</aside>
        </div>
        <footer class="shop-market-footer">${shopNotice.html({ className:'shop-live', tag:'span', elementId:'shopLive', keepEmpty:true })}${linkedBackHTML('closeShop', '返回地图', 'shop-back', 'button', { text:'返回地图' })}</footer>
      </div>`, 'page');
    pageVersion = version;
    shopPage = 'main';
    bagReturn = null;
    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 能量饮料（2 币，回 6 血） + 初始攻击补充（1 币/张，每站最多 5 张）+ 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>收购台</b>补给站的收购台可挑卡卖掉。默认卡牌不可出售；只有带「可出售」备注的卡才能卖，收购价 = 卡面币值。</p>`,
      back: () => version === pageVersion && currentSession(session) && document.querySelector('.help-body')
        ? renderShop() : false,
    });
    const shopRoot = document.querySelector('.shop-replica');
    setInspectionBackground(shopRoot, selectedShopIndex != null);
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
      if (/** @type {KeyboardEvent} */ (event).key !== 'Escape' || (selectedShopIndex == null && !inspectionClose)) return;
      event.preventDefault();
      event.stopPropagation();
      closeShopInspection();
    });
    UI.refresh(game);
    return true;
  }

  // 卖牌处二级界面：收购台（2026-09-10 留言 #23：只列出可以卖的牌，不再把不可卖的也铺出来置灰）
  function renderSellPage() {
    if (!currentSession(shopSession)) return false;
    cancelInspectionMotion();
    const version = pageVersion + 1, session = shopSession;
    const sellableOwned = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored);   // 珍珠盒中存放的资源卡不在此列出（2026-09-10 #29）
    const total = sellableOwned.length;
    const totalValue = sellableOwned.reduce((sum, owned) => sum + SDT.Cards.sellPrice(owned.card), 0);
    const rows = sellableOwned.map(owned => `
      <div class="bag-card sell-item">
        ${cardHTML(owned.card, 'sm')}
        <div class="sell-item-offer"><span>卖出可得</span><b>${coinIconHTML()}+${SDT.Cards.sellPrice(owned.card)} 币</b></div>
        <button class="mini-btn ok" data-act="sellCard" data-uid="${owned.uid}">确认卖出</button>
      </div>`).join('');
    const ownedAll = game.ownedCards.length;
    const grid = total
      ? `<div class="shop-sell">${rows}</div>`
      : `<p class="shop-sell-empty">背包里没有可以卖的卡牌（持有 ${ownedAll} 张）——只有带「可出售」备注的卡（货币卡等）商店才收。</p>`;
    UI.showOverlay('', `
      <div class="pg shop-pg shop-exchange node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <div class="shop-heading"><h2>[[icon:sell-cards]] 收购台 ${UI.helpBtn('shopSell')}</h2></div>
          <button class="shop-bag-btn" data-act="shopOpenBag" title="打开背包整理卡牌">[[icon:bag]] 背包</button>
          <div class="shop-resources"><span class="shop-resource coin">${coinIconHTML()}<small>可用金币</small><b>${game.coins}</b><em>币</em></span><span class="shop-resource"><small>可出售</small><b>${total}</b><em>张</em></span></div>
        </header>
        <div class="shop-board sell-board">
          <div class="sell-desk">
            <aside class="sell-ledger">

              <h3>商队收购单</h3>
              <div class="sell-ledger-total"><small>合计</small><b>${coinIconHTML()}${totalValue}</b><span>币</span></div>
              <dl><div><dt>持有卡牌</dt><dd>${ownedAll} 张</dd></div><div><dt>符合条件</dt><dd>${total} 张</dd></div><div><dt>当前金币</dt><dd>${game.coins} 币</dd></div></dl>
              ${uiDisclosure({className:'sell-ledger-rule',label:'收购规则',content:'<p>仅收购带“可出售”备注的货币与宝石类卡牌。点击“确认卖出”后立即成交，价格等于卡面币值。</p>'})}
            </aside>
            <section class="sell-catalog" aria-label="可出售卡牌">
              <div class="sell-catalog-head"><div><span>APPRAISAL LIST</span><h3>待估物清单</h3></div><b>${total} 件</b></div>
              ${grid}
            </section>
          </div>
        </div>
        <footer class="shop-market-footer">${shopNotice.html({ className:'shop-live', tag:'span', keepEmpty:true })}${linkedBackHTML('backShop', '返回商店', 'shop-back', 'button', { text:'返回商店' })}</footer>
      </div>`, 'page');
    pageVersion = version;
    shopPage = 'sell';
    bagReturn = null;
    UI.registerHelp('shopSell', {
      title: '卖牌处说明',
      html: `<p class="help-item"><b>收购规则</b>这里只显示可以卖的牌；默认卡牌不可出售，只有带「可出售」备注的卡（货币/宝石类等）才能卖给商店，收购价 = 卡面币值。</p>`,
      back: () => version === pageVersion && currentSession(session) && document.querySelector('.help-body')
        ? renderSellPage() : false,
    });
    registerShopActs(document.querySelector('.shop-exchange'));
    UI.refresh(game);
    return true;
  }

  // 购买后只重绘该货位/详情，原位同步其他商品状态与余额，不重播整页入场。
  function refreshShopSlot(index) {
    const slots = document.querySelectorAll('.shop-board-grid .shop-slot');
    const el = slots[index];
    const hadFocus = el?.contains(document.activeElement);
    if (el) {
      const html = slotHTML(game.shopStock[index], index);
      const template = el.ownerDocument.createElement('template');
      template.innerHTML = SDT.Icons?.rich?.(html) || html;
      const next = template.content.firstElementChild;
      el.className = next.className;
      el.setAttribute('data-availability', next.getAttribute('data-availability'));
      syncViewChildren(el, next);
      if (hadFocus) {
        const current = document.querySelectorAll('.shop-board-grid .shop-slot')[index];
        (/** @type {HTMLElement} */ (current?.querySelector('.shop-preview') || document.querySelector('.shop-market .shop-bag-btn')))?.focus({ preventScroll:true });
      }
    }
    const detail = document.querySelector('.shop-market .shop-detail');
    if (detail) {
      /** @type {HTMLElement} */ (detail).hidden = selectedShopIndex == null;
      const detailHadFocus = detail.contains(document.activeElement);
      const focusedAction = /** @type {HTMLElement} */ (document.activeElement)?.dataset?.act;
      const focusedSummary = detail.contains(document.activeElement) && document.activeElement.tagName === 'SUMMARY';
      const rulesOpen = !!/** @type {HTMLDetailsElement} */ (detail.querySelector('.shop-detail-rules'))?.open;
      const scrollTop = detail.querySelector('.shop-detail-scroll')?.scrollTop || 0;
      const template = detail.ownerDocument.createElement('template');
      template.innerHTML = SDT.Icons?.rich?.(shopDetailHTML()) || shopDetailHTML();
      syncViewChildren(detail, template.content);
      // Retained controls must keep their new availability after the save lock ends.
      if (transacting) detail.querySelectorAll('button').forEach(button => {
        button.dataset.roomDisabledAfterSave = String(button.disabled);
      });
      const rules = /** @type {HTMLDetailsElement} */ (detail.querySelector('.shop-detail-rules'));
      if (rules) rules.open = rulesOpen;
      const scroller = detail.querySelector('.shop-detail-scroll');
      if (scroller) scroller.scrollTop = scrollTop;
      if (detailHadFocus) {
        const sameAction = [...detail.querySelectorAll('button:not(:disabled)')].find(button => /** @type {HTMLElement} */ (button).dataset.act === focusedAction);
        const nextAction = (focusedSummary ? rules?.querySelector('summary') : sameAction) || detail.querySelector('.shop-detail-buy:not(:disabled), .shop-detail-done, .shop-detail-bag')
          || detail.querySelector('.shop-detail-close:not(:disabled)')
          || detail.querySelector('.shop-detail-dismiss:not(:disabled)');
        (/** @type {HTMLElement} */ (nextAction || document.querySelector(`.shop-board-grid .shop-preview[data-i="${selectedShopIndex}"]`)))?.focus({ preventScroll:true });
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
      if (!stock || stock.empty) return;
      const availability = slotAvailability(stock);
      slot.classList.toggle('unaffordable', !availability.exhausted && !availability.hasMoney);
      /** @type {HTMLElement} */ (slot).dataset.availability = availability.state;
      const status = slot.querySelector('.shop-stock-state');
      if (status) status.textContent = availability.label;
      slot.querySelector('.shop-preview')?.setAttribute('aria-label', slotPreviewLabel(stock, availability));
    });
  }
  function closeShopInspection() {
    if (selectedShopIndex == null) return;
    const previousIndex = selectedShopIndex;
    selectedShopIndex = null;
    const detail = document.querySelector('.shop-market .shop-detail');
    const close = { detail, cancel:null };
    inspectionClose = close;
    const finish = () => {
      if (inspectionClose !== close) return;
      inspectionClose = null;
      if (detail) {
        /** @type {HTMLElement} */ (detail).hidden = true; detail.innerHTML = ''; /** @type {HTMLElement} */ (detail).inert = false;
        setInspectionBackground(detail.closest('.shop-market'), false);
        watchInspectionMotion(detail);
        delete /** @type {HTMLElement} */ (detail).dataset.shopMotion;
      }
      if (detail?.isConnected) /** @type {HTMLElement} */ (document.querySelector(`.shop-board-grid .shop-preview[data-i="${previousIndex}"]`))?.focus({ preventScroll:true });
    };
    if (detail && !reducedInspectionMotion()) {
      /** @type {HTMLElement} */ (detail).inert = true;
      /** @type {HTMLElement} */ (detail).dataset.shopMotion = 'out';
      watchInspectionMotion(detail);
      close.cancel = completeSurfaceMotion(detail, finish, { name:'shop-detail-out', duration:motionTiming.exit });
    } else finish();
    document.querySelectorAll('.shop-board-grid .shop-slot').forEach(slot => {
      slot.classList.remove('selected');
      slot.querySelector('.shop-preview')?.setAttribute('aria-pressed', 'false');
    });
  }
  function registerShopActs(root) {
    const version = pageVersion, session = shopSession;
    const offers = game.shopStock.map(slot => ({ slot, card:slot.card, price:slot.price, free:slot.free,
      replenish:slot.shaReplenish != null }));
    const saleEntries = new Map(game.ownedCards.map(owned => [owned.uid, { owned, card:owned.card }]));
    // 页面重绘、离店、换店或换档后，旧动作不能按新货架索引继续成交。
    const live = () => root?.isConnected && version === pageVersion && currentSession(session);
    const register = createRoomActions(UI, () => !transacting && live(), { emptyData:true });
    register('shopTalk', () => {
      if (selectedShopIndex != null) return false;
      const line = root.querySelector('.shop-merchant-line');
      if (!line) return false;
      session.merchantLine = (session.merchantLine + 1) % merchantLines.length;
      line.textContent = `“${merchantLines[session.merchantLine]}”`;
    });
    const registerTrade = (name, handler) => register(name, async data => {
      transacting = true;
      let finishSave = () => {};
      try {
        finishSave = beginRoomSave(root, root.querySelector('.shop-live'));
        return await handler(data);
      } finally { transacting = false; publish(finishSave); }
    });
    const quotedSlot = (value, replenish) => {
      const index = Number(value), quote = offers[index], slot = game.shopStock[index];
      return Number.isInteger(index) && index >= 0 && quote && slot === quote.slot && slot.card === quote.card
        && slot.price === quote.price && slot.free === quote.free && quote.replenish === replenish
        && slot.card && !slot.empty && !slot.sold && Number.isFinite(slot.price) && slot.price >= 0 ? slot : null;
    };
    register('shopCloseInspect', closeShopInspection);
    register('shopInspect', data => {
      const i = Number(data.i);
      if (!game.shopStock[i] || game.shopStock[i].empty) return;
      const existingDetail = /** @type {HTMLElement} */ (document.querySelector('.shop-market .shop-detail'));
      if (selectedShopIndex === i && existingDetail && !existingDetail.hidden && !existingDetail.inert && !inspectionClose) return;
      if (inspectionClose) { inspectionClose.cancel?.(); inspectionClose = null; }
      selectedShopIndex = i;
      document.querySelectorAll('.shop-board-grid .shop-slot').forEach((slot, index) => {
        slot.classList.toggle('selected', index === i);
        slot.querySelector('.shop-preview')?.setAttribute('aria-pressed', String(index === i));
      });
      const detail = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (/** @type {HTMLElement} */ (/** @type {HTMLElement} */ (document.querySelector('.shop-market .shop-detail')))));
      if (detail) {
        watchInspectionMotion(detail);
        detail.inert = false;
        detail.hidden = false;
        setInspectionBackground(root, true);
        detail.innerHTML = SDT.Icons?.rich?.(shopDetailHTML()) || shopDetailHTML();
        if (reducedInspectionMotion()) delete detail.dataset.shopMotion;
        else {
          detail.dataset.shopMotion = 'in';
          watchInspectionMotion(detail, () => {
            delete detail.dataset.shopMotion;
            watchInspectionMotion(detail);
          });
        }
        /** @type {HTMLElement} */ (detail.querySelector('.shop-detail-close'))?.focus({ preventScroll:true });
      }
    });
    register('shopOpenBag', () => {
      // 关闭背包后回到商店当前页（主商店/收购台），不再踢回地图
      const returnPage = shopPage;
      const browseState = captureShopBrowseState(root, UI.el.ovBody, selectedShopIndex != null);
      cancelInspectionMotion();
      const onReturn = () => {
        if (bagReturn !== onReturn || version !== pageVersion || !currentSession(session)) return false;
        // 普通背包关闭时仍留有退出中的 .bag-view；减少动态时弹层已同步清空。
        if (!document.querySelector('.bag-view') && !UI.el?.overlay?.hidden) return false;
        if (!(returnPage === 'sell' ? renderSellPage : renderShop)()) return false;
        const selector = returnPage === 'sell' ? '.shop-exchange' : '.shop-market';
        const restoredRoot = UI.el.ovBody.querySelector(selector);
        if (!restoredRoot) return false;
        restoreBrowseOnFrame(restoredRoot, browseState, session, selector);
        return true;
      };
      bagReturn = onReturn;
      openBackpack(onReturn);
      // 商店经通用入口整理背包；战斗期间通用入口与战斗命令均拒绝打开。
    });
    // Both purchases have the same transaction and feedback order. Only their
    // messages and the replenishment/bonus continuation differ.
    const buy = async (data, replenish) => {
      const slot = quotedSlot(data.i, replenish);
      if (!slot || (replenish && (!Number.isInteger(slot.shaReplenish) || slot.shaReplenish <= 0))) return false;
      if (game.coins < slot.price) {
        UI.log('币不够，买不起', 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `币不够——${replenish ? '补一张初始攻击要' : '这张要'} ${slot.price} 币，身上只有 ${game.coins} 币`);
        return false;
      }
      if (!canReceive(slot.card)) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格；${replenish ? '初始攻击每格最多叠 3 张，堆满后另占一格），补充不了' : '装备每张占 1 格，其他同名每格最多叠 3 张，堆满后另占一格），买不下这张卡'}`, 'warn');
        SDT.Sound.sfx('error');
        denySlotFeedback(+data.i, `${replenish ? '补不了——背包已满' : '背包装不下'}（${usedSlots()}/${bagCap()} 格）`);
        return false;
      }
      const result = await trades.buy({ index:Number(data.i), quote:offers[Number(data.i)], replenish, current:live });
      if (!result.ok || !live()) return result;
      const price = result.price, name = replenish ? '' : result.entry.card.name;
      publish(() => tradeReceipt(session, replenish
        ? `已补充初始攻击 ×1 · 已入本次远征背包 · 支出 ${price} 币 · 剩余 ${game.coins} 币`
        : `${price === 0 ? '免费领取' : '已购入'}「${name}」 · 已入本次远征背包 · ${price === 0 ? '未扣币' : `支出 ${price} 币`} · 剩余 ${game.coins} 币`, result.saved));
      if (!live()) return result;
      publish(() => SDT.Sound.sfx('tradeBuy'));
      publish(() => UI.log(replenish
        ? `[[icon:bag]] 补充初始攻击 ×1（- ${price} 币，剩 ${game.coins} · 本站还可补 ${slot.shaReplenish} 张）`
        : `[[icon:bag]] 购买卡牌【<b>${esc(name)}</b>】（- ${price} 币，剩 ${game.coins}）`, 'coin'));
      publish(() => playBuyCarry(document.querySelectorAll('.shop-board-grid .shop-slot')[+data.i], slot, () => {}));
      publish(() => refreshShopSlot(+data.i));
      if (!replenish && result.bonusReward) {
        publish(() => UI.log('阿猫的礼物：附赠卡已保留，可在当前节点继续领取。', 'loot'));
        publish(() => SDT.Chests?.restore(game, result.bonusReward, () => {
          game.state = 'idle'; UI.refresh(game);
        }));
      }
      return result;
    };
    registerTrade('buyCard', data => buy(data, false));
    registerTrade('buySha', data => buy(data, true));
    registerTrade('sellCard', async data => {
      const index = game.ownedCards.findIndex(owned => owned.uid === data.uid);
      if (index < 0) return false;
      const owned = game.ownedCards[index];
      const quote = saleEntries.get(data.uid);
      if (!quote || quote.owned !== owned || quote.card !== owned.card || game.ownedCards.filter(item => item.uid === data.uid).length !== 1) return false;
      if (!SDT.Cards.isSellable(owned.card)) {
        UI.log(`卡牌【${esc(owned.card.name)}】不可出售`, 'warn');
        return false;
      }
      if (owned.stored) return false;   // 珍珠盒存放中的卡不可出售（G-2，2026-09-29 夜班：与收购台渲染过滤同口径，直调 act 不再放行）
      const sellRoot = document.querySelector('.shop-exchange');
      const browseState = captureShopBrowseState(sellRoot, UI.el?.ovBody);
      const rulesOpen = !!/** @type {HTMLDetailsElement} */ (sellRoot?.querySelector('.sell-ledger-rule'))?.open;
      const saleButtons = [...(sellRoot?.querySelectorAll('[data-act="sellCard"]') || [])];
      const saleIndex = saleButtons.findIndex(button => /** @type {HTMLElement} */ (button).dataset.uid === owned.uid);
      const result = await trades.sell({ uid:data.uid, quote, current:live });
      if (!result.ok || !live()) return result;
      const price = result.price;
      publish(() => tradeReceipt(session, `已从背包出售「${owned.card.name}」 · 收入 ${price} 币 · 当前 ${game.coins} 币`, result.saved));
      if (!live()) return result;
      publish(() => SDT.Sound.sfx('tradeSell'));
      publish(() => UI.log(`[[icon:coin]] 出售卡牌【<b>${esc(owned.card.name)}</b>】（+ ${price} 币，现有 ${game.coins}）`, 'coin'));
      publish(() => {
        if (!renderSellPage()) return;
        const restoredRoot = document.querySelector('.shop-exchange');
        const restoredRules = restoredRoot?.querySelector('.sell-ledger-rule');
        if (restoredRules) /** @type {HTMLDetailsElement} */ (restoredRules).open = rulesOpen;
        const remaining = [...(restoredRoot?.querySelectorAll('[data-act="sellCard"]') || [])];
        if (browseState?.focus?.keys?.act === 'sellCard') {
          const next = remaining[Math.min(saleIndex, remaining.length - 1)];
          browseState.focus.keys = next ? {act:'sellCard',uid:/** @type {HTMLElement} */ (next).dataset.uid} : {act:'backShop'};
        }
        restoreBrowseOnFrame(restoredRoot, browseState, session);
      });
      return result;
    });
    register('openSell', () => {
      shelfReturn = captureShopBrowseState(root, UI.el?.ovBody, selectedShopIndex != null);
      renderSellPage();
    });
    register('backShop', () => {
      const snapshot = shelfReturn;
      shelfReturn = null;
      renderShop();
      const restoredRoot = UI.el?.ovBody?.querySelector('.shop-market');
      restoreBrowseOnFrame(restoredRoot, snapshot, session, '.shop-market');
    });
    let closing = false;
    register('closeShop', async () => {
      if (closing) return false;
      closing = true;
      transacting = true;
      let finishSave = () => {};
      let cb;
      try {
        finishSave = beginRoomSave(root, root.querySelector('.shop-live'));
        const saved = !session.unsaved || await persistShop(session);
        if (!live()) return false;
        if (!saved) {
          publish(() => shopNotice.set('本局已成交，保存仍未成功；请再次点击返回地图重试保存', 'warn'));
          publish(() => UI.log(shopNotice.text, 'warn'));
          return false;
        }
        shopSession = null;
        bagReturn = null;
        shelfReturn = null;
        pageVersion++;
        cb = shopOnClose; shopOnClose = null;
        publish(cancelInspectionMotion);
        publish(() => UI.hideOverlay());
        game.state = 'idle';
      } finally {
        transacting = false;
        closing = false;
        publish(finishSave);
      }
      // Release the old page's save lock before its continuation can open a new room.
      // A presentation failure cannot undo the completed save and departure.
      try { if (cb) await cb(); else await UI.refresh(game); } catch { /* Departure is committed. */ }
      return true;
    });
  }

  return { openShop };
}

export { createShopController };
