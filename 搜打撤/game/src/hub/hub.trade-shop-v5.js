import { esc, escAttr } from '../core/shared.js';
import { resourceValueHTML } from './hub.materials.js';
import { departureStackKey } from './base-departure.commands.js';
import { stashSalePrice as salePrice } from './stash-sale-price.js';
import { descRich } from '../cards/cards.view.js';
import { holdHubOperationControls, runHubOperation } from './hub.presentation.js';

const MATERIAL_CARD_IDS = { wood: 'tt-wood', rations: 'tt-rations' };
const GOOD_KEY = good => String(good.material || good.id || '');
const STACK_KEY = departureStackKey;
const quantity = stack => Math.max(0, Number(stack?.count) || 0);
const protectedStack = (base, stack) => typeof base.isCollectionProtected === 'function'
  ? !!base.isCollectionProtected(stack.card) : !!base.isCollected?.(stack.card);
const sellableStack = (base, stack) => quantity(stack) > 0 && stack.card.id !== base.PET_EGG_ID
  && stack.card.id !== 'tt-econpack' && !base.materialInfo?.(stack.card);
const goodCard = (cards, good) => good.material ? cards.all().find(card => card.id === MATERIAL_CARD_IDS[good.material])
  : good.id === 'sha' ? cards.SHA : cards.all().find(card => card.id === good.id);
const illustration = (cards, card) => card ? cards.cardHTML(card, 'sm') : '<span class="trade-v5-no-art">暂无卡牌</span>';
const coinHTML = amount => resourceValueHTML('coin', '储备币', amount, 'coin');
const ownedCount = (base, good) => good.material ? base.data[good.material] || 0
  : base.data.stash.filter(stack => stack.card.id === good.id).reduce((sum, stack) => sum + quantity(stack), 0);

export function createTradeShopState() { return { mode: 'buy', category: '', goodKey: '', sellKey: '' }; }
const categoryOf = (base, card, material) => material || card && (card.id === base.PET_EGG_ID || card.id === 'tt-econpack' || base.materialInfo?.(card)) ? 'supplies' : 'battle';
const inCategory = (base, state, card, material) => !state.category || categoryOf(base, card, material) === state.category;

function synchronize(base, goods, state) {
  if (state.mode !== 'sell') state.mode = 'buy';
  if (!['', 'supplies', 'battle'].includes(state.category)) state.category = '';
  if (!goods.some(good => GOOD_KEY(good) === state.goodKey)) state.goodKey = goods.length ? GOOD_KEY(goods[0]) : '';
  const stacks = base.data.stash.filter(stack => sellableStack(base, stack));
  if (!stacks.some(stack => STACK_KEY(stack) === state.sellKey)) state.sellKey = stacks.length ? STACK_KEY(stacks[0]) : '';
  return stacks;
}

function purchaseBlock(base, cards, good) {
  if (!good || !Number.isFinite(good.price) || good.price < 0 || !good.material && !goodCard(cards, good)) return '暂缺商品';
  const issues = [];
  if (base.data.coins < good.price) issues.push(`还需 ${good.price - base.data.coins} 储备币`);
  if (!good.material && base.stashRoom() <= 0) issues.push('仓库已满');
  return issues.join(' · ');
}

function itemHTML({ key, selected, act, card, name, count, price, protectedItem = false, cards, material = false }) {
  return `<button type="button" class="trade-v5-item${selected ? ' is-selected' : ''}${protectedItem ? ' is-protected' : ''}${material ? ' trade-v5-item--material' : ''}" data-act="${act}" data-key="${escAttr(key)}"${selected ? ' data-focus-fallback' : ''} aria-pressed="${selected}" aria-label="${escAttr(name)}，持有 ${count}${protectedItem ? '，收藏保护' : ''}">
    <span class="trade-v5-thumb">${illustration(cards, card)}</span><span class="trade-v5-item-label"><b>${esc(name)}</b><span>持有 ${count}${protectedItem ? ' · 收藏保护' : ''}</span></span><span class="trade-v5-item-price">${coinHTML(price)}</span>
  </button>`;
}

function deskHTML({ base, cards, goods, state, stacks }) {
  const buying = state.mode === 'buy';
  const good = buying ? goods.find(item => GOOD_KEY(item) === state.goodKey) : null;
  const stack = buying ? null : stacks.find(item => STACK_KEY(item) === state.sellKey);
  if (!good && !stack) return `<section class="trade-v5-desk trade-v5-empty"><h3>${buying ? '暂无在售商品' : '暂无可出售卡牌'}</h3>${buying ? '' : '<button type="button" class="base-link" data-act="hubTab" data-tab="stash" data-view="cards">前往仓库 ↗</button>'}</section>`;
  const card = buying ? goodCard(cards, good) : stack.card;
  const name = buying && good.material ? good.name : card?.name || '未上架';
  const count = buying ? ownedCount(base, good) : quantity(stack);
  const price = buying ? good.price : salePrice(cards, card);
  const blocked = buying ? purchaseBlock(base, cards, good) : protectedStack(base, stack) ? '收藏卡牌受保护' : '';
  const material = buying && !!good.material;
  return `<section class="trade-v5-desk${material ? ' trade-v5-desk--material' : ''}" aria-label="交易台">
    <header class="trade-v5-desk-heading"><span>${buying ? '购入商品' : '出售卡牌'} · ${material ? '基地物资' : esc([card?.rarity, card?.type].filter(Boolean).join(' · '))}</span><h3>${esc(name)}</h3></header>
    <div class="trade-v5-reading">
    <div class="trade-v5-art" aria-label="${escAttr(name)}卡面">${illustration(cards, card)}</div>
    <p class="trade-v5-description">${material && good.tip ? esc(good.tip) : descRich(card?.desc || '', card?.id, card)}</p>
    <p class="trade-v5-owned">当前持有 <b>${count}</b>${material ? good.material === 'wood' ? ' 个' : ' 份' : ' 张'}</p></div>
    <div class="trade-v5-settlement" aria-label="${buying ? '购入' : '出售'}账面">
    <dl class="trade-v5-balance"><div><dt>单价</dt><dd>${price} 储备币</dd></div><div><dt>${buying ? '购入' : '出售'}数量</dt><dd>1${material ? good.material === 'wood' ? ' 个' : ' 份' : ' 张'}</dd></div><div class="trade-v5-total"><dt>${buying ? '总花费' : '总收入'}</dt><dd>${price} 储备币</dd></div><div><dt>当前余额</dt><dd>${base.data.coins} 储备币</dd></div>${!buying && count > 1 ? `<div><dt>整堆 ${count} 张收入</dt><dd>${price * count} 储备币</dd></div>` : ''}</dl>
    ${blocked ? `<p class="trade-v5-${buying ? 'shortfall' : 'protection'}">${esc(blocked)}</p>` : ''}
    <div class="trade-v5-checkout">${buying
      ? `<button type="button" class="base-command base-command-primary" data-act="tradeShopBuy"${blocked ? ' disabled' : ''}><span class="base-command-label">购入 ×1 · −${price} 储备币</span><span class="base-command-arrow" aria-hidden="true">→</span></button>`
      : `<button type="button" class="base-command base-command-primary" data-act="tradeShopSellOne"${blocked ? ' disabled' : ''}><span class="base-command-label">出售 ×1 · +${price} 币</span><span class="base-command-arrow" aria-hidden="true">→</span></button>${count > 1 ? `<button type="button" class="base-command" data-act="tradeShopSellAll"${blocked ? ' disabled' : ''}><span class="base-command-label">整堆 ×${count} · +${price * count} 币</span><span class="base-command-arrow" aria-hidden="true">→</span></button>` : ''}`}</div>
    ${buying && !material && base.stashRoom() <= 0 ? '<div class="trade-v5-capacity"><button type="button" class="base-link" data-act="hubTab" data-tab="stash" data-view="cards">整理仓库 ↗</button><button type="button" class="base-link" data-act="hubTab" data-tab="upgrade" data-facility="stash">扩建 ↗</button></div>' : ''}</div>
  </section>`;
}

export function tradeShopV5HTML({ base, cards, art, goods, state }) {
  const allStacks = synchronize(base, goods, state);
  const shownGoods = goods.filter(good => inCategory(base, state, goodCard(cards, good), good.material));
  const stacks = allStacks.filter(stack => inCategory(base, state, stack.card));
  if (!shownGoods.some(good => GOOD_KEY(good) === state.goodKey)) state.goodKey = shownGoods.length ? GOOD_KEY(shownGoods[0]) : '';
  if (!stacks.some(stack => STACK_KEY(stack) === state.sellKey)) state.sellKey = stacks.length ? STACK_KEY(stacks[0]) : '';
  const buying = state.mode === 'buy';
  const items = buying ? shownGoods.map(good => {
    const key = GOOD_KEY(good), card = goodCard(cards, good);
    return itemHTML({ key, selected: key === state.goodKey, act: 'tradeShopSelectGood', card, name: good.material ? good.name : card?.name || '未上架', count: ownedCount(base, good), price: good.price, cards, material: !!good.material });
  }) : stacks.map(stack => itemHTML({ key: STACK_KEY(stack), selected: STACK_KEY(stack) === state.sellKey, act: 'tradeShopSelectStack', card: stack.card, name: stack.card.name, count: quantity(stack), price: salePrice(cards, stack.card), protectedItem: protectedStack(base, stack), cards }));
  return `<div class="trade-v5 trade-v12" data-mode="${state.mode}"><header class="trade-v5-heading"><h2>交易所</h2><div class="trade-v5-wallet">${coinHTML(base.data.coins)}</div></header>
    <div class="trade-v12-layout"><nav class="trade-v5-modes" aria-label="交易方式">${[['buy', '购入商品', '▣'], ['sell', '出售卡牌', '⇄']].map(([mode, label, icon]) => `<button type="button" class="base-link${state.mode === mode ? ' is-selected' : ''}" data-act="tradeShopMode" data-mode="${mode}"${!items.length && state.mode === mode ? ' data-focus-fallback' : ''} aria-pressed="${state.mode === mode}"><span aria-hidden="true">${icon}</span><b>${label}</b></button>`).join('')}<button type="button" class="base-link trade-v12-stash-link" data-act="hubTab" data-tab="stash" data-view="cards"><span aria-hidden="true">▦</span><b>后勤仓库</b></button></nav>
    <div class="trade-v5-workspace"><section class="trade-v5-rail" aria-label="${buying ? '在售商品' : '仓库卡牌'}"><nav class="trade-v12-categories" aria-label="商品类别">${[['', '全部'], ['supplies', '基地补给'], ['battle', '战斗卡牌']].map(([category, label]) => `<button type="button" class="${state.category === category ? 'on' : ''}" data-act="tradeShopCategory" data-category="${category}" aria-pressed="${state.category === category}">${label}</button>`).join('')}</nav><div class="trade-v12-shelf-heading"><b>${buying ? '在售商品' : '仓库可售卡牌'}</b><span>${items.length} 种</span></div><div class="trade-v5-list">${items.join('') || '<p class="trade-v12-no-items">该类别暂无物品</p>'}</div></section>${/** @type {(options: Parameters<typeof deskHTML>[0] & {art?:unknown}) => ReturnType<typeof deskHTML>} */ (deskHTML)({ base, cards, art, goods:shownGoods, state, stacks })}</div></div>
  </div>`;
}

// 交易沿用 Base 原子命令及仓库特写的 2.6 秒确认口径；不转移收藏、使用或孵化职责。
// 根壳在换页/重绘前调用返回的 dispose；state 仅保留界面选择，换档由根壳重建。
export function bindTradeShopV5({ root, ui, base, cards, goods, state, render, notice, sound }) {
  if (!root) return () => {};
  const slot = base.slot, generation = base._selectionGeneration;
  let active = true, confirmation = null, timer = null, busy = false;
  const live = () => active && root.isConnected && base.slot === slot && base._selectionGeneration === generation;
  const currentStack = () => {
    const matches = base.data.stash.filter(stack => STACK_KEY(stack) === state.sellKey);
    return matches.length === 1 ? matches[0] : null;
  };
  const selectedGood = () => goods.find(good => GOOD_KEY(good) === state.goodKey);
  const disarm = () => {
    clearTimeout(timer); timer = null;
    if (confirmation?.button.isConnected) {
      confirmation.button.innerHTML = confirmation.original;
      confirmation.button.classList.remove('is-confirming');
      delete confirmation.button.dataset.confirming;
    }
    confirmation = null;
  };
  const redraw = ({ resetList = false, resetReading = false } = {}) => {
    const positions = ['.trade-v5-modes', '.trade-v5-list', '.trade-v5-reading'].map(selector => {
      const pane = root.querySelector(selector);
      const reset = selector === '.trade-v5-list' && resetList || selector === '.trade-v5-reading' && resetReading;
      return { selector, top: reset ? 0 : pane?.scrollTop || 0, left: reset ? 0 : pane?.scrollLeft || 0 };
    });
    disarm(); render();
    const nextRoot = root.ownerDocument.querySelector('.trade-v5');
    for (const position of positions) {
      const pane = nextRoot?.querySelector(position.selector);
      if (pane) { pane.scrollTop = position.top; pane.scrollLeft = position.left; }
    }
  };
  const failureMessage = (result, fallback) => {
    const reasons = { poor: '储备币不足', full: '仓库已满', collected: '收藏卡牌受保护', material: '材料不可出售', empty: '该卡牌已不在仓库', identity: '卡牌身份已变化，请重新选择', save: '基地存档未保存，请重试' };
    return result?.msg || reasons[result?.why] || fallback;
  };
  const failure = (result, fallback) => {
    notice(failureMessage(result, fallback), 'warn');
    redraw();
  };
  const lockCheckout = () => {
    const release = holdHubOperationControls(root.querySelectorAll('.trade-v5-checkout button'));
    busy = true;
    return () => {
      busy = false;
      release();
    };
  };
  const register = (name, handler) => ui.act(name, data => { if (live() && !busy) return handler(data || {}); });
  register('tradeShopMode', data => {
    if (!['buy', 'sell'].includes(data.mode) || state.mode === data.mode) return;
    state.mode = data.mode; sound.tick?.(); redraw({ resetList:true, resetReading:true });
  });
  register('tradeShopCategory', data => {
    if (!['', 'supplies', 'battle'].includes(data.category) || state.category === data.category) return;
    state.category = data.category; sound.tick?.(); redraw({ resetList:true, resetReading:true });
  });
  register('tradeShopSelectGood', data => {
    if (state.mode !== 'buy' || !goods.some(good => GOOD_KEY(good) === data.key)) return;
    const changed = state.goodKey !== data.key;
    state.goodKey = data.key; sound.tick?.(); redraw({ resetReading:changed });
  });
  register('tradeShopSelectStack', data => {
    if (state.mode !== 'sell' || !base.data.stash.some(stack => STACK_KEY(stack) === data.key && sellableStack(base, stack))) return;
    const changed = state.sellKey !== data.key;
    state.sellKey = data.key; sound.tick?.(); redraw({ resetReading:changed });
  });
  register('tradeShopBuy', async () => {
    if (state.mode !== 'buy') return;
    const good = selectedGood(), blocked = purchaseBlock(base, cards, good);
    if (blocked) { failure(null, blocked); return; }
    const card = good.material ? null : goodCard(cards, good);
    const name = good.material ? good.name : card.name;
    const unlock = lockCheckout();
    try {
      return await runHubOperation({
        run: () => base.purchase({ price: good.price, material: good.material, card }),
        isCurrent: live, notice, pending: `正在购入${name}…`,
        success: `购入${name} ×1 · 储备 −${good.price} 币`,
        failure: (result, error) => failureMessage(result, error ? '基地存档未保存，请重试' : '商品暂不可购买'),
        onSuccess: () => {
          sound.ding?.();
          ui.log?.(`[[icon:coin]] 购入【${esc(name)}】×1`, 'loot');
        },
        refresh: () => redraw(), refreshOnFailure: true,
      });
    } finally { unlock(); }
  });
  const sell = async all => {
    if (state.mode !== 'sell') return;
    const stack = currentStack();
    if (!stack || !sellableStack(base, stack)) { failure(null, '该卡牌不可出售'); return; }
    if (protectedStack(base, stack)) { failure({ why: 'collected' }); return; }
    const price = salePrice(cards, stack.card), count = quantity(stack), qty = all ? count : 1;
    const signature = JSON.stringify([state.sellKey, count, price, base.slot]);
    const action = all ? 'tradeShopSellAll' : 'tradeShopSellOne';
    const button = root.querySelector(`[data-act="${action}"]`);
    if (!button || button.disabled) return;
    if (confirmation && confirmation.signature !== signature) {
      disarm(); notice('库存已变化，请重新确认', 'warn'); redraw(); return;
    }
    if (confirmation && confirmation.action !== action) disarm();
    if ((all || price >= 5 || count <= 1) && !confirmation) {
      confirmation = { button, action, signature, original: button.innerHTML };
      button.querySelector('.base-command-label').textContent = `确认出售 ×${qty} · +${price * qty} 币`;
      button.classList.add('is-confirming'); button.dataset.confirming = 'true';
      timer = setTimeout(disarm, 2600); return;
    }
    const visibleStacks = () => base.data.stash.filter(item => sellableStack(base, item) && inCategory(base, state, item.card));
    const selectedIndex = visibleStacks().findIndex(item => STACK_KEY(item) === state.sellKey);
    const sellKey = state.sellKey;
    disarm();
    const unlock = lockCheckout();
    let selectionChanged = false;
    try {
      return await runHubOperation({
        run: () => base.sellStashCards(stack.card.name, qty, sellKey),
        isCurrent: live, notice, pending: `正在出售${stack.card.name} ×${qty}…`,
        success: result => `出售${stack.card.name} ×${result.qty ?? qty} · 储备 +${result.coins ?? price * qty} 币`,
        failure: (result, error) => failureMessage(result, error ? '基地存档未保存，请重试' : '出售未完成'),
        onSuccess: result => {
          const remaining = visibleStacks();
          selectionChanged = !remaining.some(item => STACK_KEY(item) === sellKey);
          if (selectionChanged) {
            const neighbor = remaining[Math.max(0, Math.min(selectedIndex, remaining.length - 1))];
            state.sellKey = neighbor ? STACK_KEY(neighbor) : '';
          }
          sound.ding?.();
          ui.log?.(`[[icon:coin]] 已售出【${esc(stack.card.name)}】×${result.qty ?? qty}`, 'coin');
        },
        refresh: () => redraw({ resetReading:selectionChanged }), refreshOnFailure: true,
      });
    } finally { unlock(); }
  };
  register('tradeShopSellOne', () => sell(false));
  register('tradeShopSellAll', () => sell(true));
  return () => { active = false; disarm(); };
}
