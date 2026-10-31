import { esc } from '../core/shared.js';
import { createEventDiceController } from '../ui/event-dice.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { beginRoomSave } from '../ui/room-footer.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { commissionGoodsHTML } from '../ui/encounter-presentation.js';

import { commissionEligibleSlots, applyCommissionDiscount } from './shop-commands.js';
export { commissionEligibleSlots } from './shop-commands.js';

// The commission stays in its source node record, including closed nodes and redeemed receipts.
export function openShopCommission({ game, UI, SDT, stockKey, save, current, renderShop, leave }) {
  const key = stockKey || `shop:${game.layerIdx},${game.trackPos}`;
  const rewards = game.nodeRewards;
  const owner = Object.values(rewards || {}).find(record => {
    const pending = record?.commission;
    return pending && (pending.status === 'pending'
      || (pending.status === 'applied' && !pending.announced && (!pending.shopKey || pending.shopKey === key)));
  });
  if (!owner) return false;
  const pending = owner.commission, stock = game.shopStock;
  const movingDraft = pending.status === 'pending' && pending.shopKey && pending.shopKey !== key;
  if ((!pending.shopKey || movingDraft) && commissionEligibleSlots(stock,SDT.Cards.SHA).length < 2) {
    UI.log('行商没有足够的可免单商品，接应凭据保留到下一家商店。','sys');
    return false;
  }
  const quotes = stock.map(slot => ({ slot, card:slot.card }));
  const body = UI.el?.ovBody, overlay = UI.el?.overlay;
  let surface = body?.firstElementChild, revision = UI._overlayRevision, hidden = overlay?.hidden;
  let saving = false, lastSaveFailed = false, released = false, restoring = false, phase = null;
  const context = () => !released && current() && game.shopStock === stock && game.nodeRewards === rewards
    && Object.values(rewards).includes(owner) && owner.commission === pending
    && (pending.status === 'pending' || !pending.shopKey || pending.shopKey === key)
    && UI.el?.ovBody === body && UI.el?.overlay === overlay;
  const live = () => context() && (restoring || body?.firstElementChild === surface
    && UI._overlayRevision === revision && overlay?.hidden === hidden);
  // A claimed source may replace the menu; ordinary actions still require its own page.
  const setReturn = render => setBagReturnHook(() => {
    if (saving || !context()) return false;
    const previous = body?.firstElementChild;
    restoring = true;
    try { render(); } finally { restoring = false; }
    return live() && body?.firstElementChild !== previous;
  });
  const sameSlot = index => Number.isInteger(index) && quotes[index] && stock[index] === quotes[index].slot
    && stock[index].card === quotes[index].card;
  const saveCurrent = async () => {
    if (saving || !live()) return false;
    saving = true;
    let finishSave = () => {};
    try {
      finishSave = beginRoomSave(surface);
      lastSaveFailed = !await saveRunCheckpoint(save); return !lastSaveFailed;
    } finally { finishSave(); saving = false; }
  };
  const show = ({title,sub,body:content}) => {
    if (!live()) return;
    const html = `<main class="pg node-pg sc-shop" data-asset-key="scene-shop-bg"><section class="commission-story"><h2>${esc(title)}</h2><p>${esc(sub)}</p>${content}</section></main>`;
    if (!restoring && phase === title && surface?.isConnected && body?.firstElementChild === surface) {
      const template = surface.ownerDocument.createElement('template');
      template.innerHTML = SDT.Icons?.rich?.(html) || html;
      syncViewChildren(surface, template.content.firstElementChild);
    } else UI.showOverlay('',html,'page');
    phase = title;
    surface = UI.el?.ovBody?.firstElementChild; revision = UI._overlayRevision; hidden = overlay?.hidden;
  };
  const bound = act => {
    const page = UI.el?.ovBody?.firstElementChild;
    return () => !saving && live() && UI.el?.ovBody?.firstElementChild === page && !!page?.querySelector(`[data-act="${act}"]`);
  };
  const restoreField = (target, field, value, existed) => { if (existed) target[field] = value; else delete target[field]; };
  const retryPage = (notice, resume) => {
    if (!live()) return;
    show({ title:'接应凭据进度保留', sub:notice, body:'<button class="ov-btn ok" data-act="commissionRetry">重试并继续</button><button class="ov-btn" data-act="commissionLeave">保存后暂离</button>' });
    const retry = bound('commissionRetry'), close = bound('commissionLeave');
    UI.act('commissionRetry', () => { if (retry()) return resume(); });
    UI.act('commissionLeave', () => { if (close()) return tryLeave(); });
    setReturn(() => retryPage(notice, resume));
  };
  const tryLeave = async () => {
    if (!live()) return;
    if (!await saveCurrent()) { retryPage('保存未成功，仍保留在本页；请重试保存后离开。', tryLeave); return; }
    if (!live()) return;
    released = true;
    setBagReturnHook(null);
    leave();
  };
  const story = () => {
    if (!live()) return;
    if (!Array.isArray(pending.slots) || pending.slots.length !== 2 || !pending.slots.every(sameSlot)) {
      retryPage('原定免费商品已变化，凭据保留，尚未领取任何商品。', story); return;
    }
    show({title:'凭据已经兑付',sub:'行商接过接应凭据，核对了运输员的签名。他划掉两张价签，把货物往你面前推近。',
      body:`<p>“接应的报酬。标亮的两格，免费拿走。”</p>${commissionGoodsHTML(pending.slots, stock)}<button class="ov-btn ok" data-act="commissionEnterShop">查看两格免费商品</button>`});
    const active = bound('commissionEnterShop');
    UI.act('commissionEnterShop', async () => {
      if (!active() || pending.announced) return;
      const old = pending.announced, existed = Object.hasOwn(pending, 'announced');
      pending.announced = true;
      if (!await saveCurrent()) { restoreField(pending, 'announced', old, existed); retryPage('免费商品已保留，确认保存未成功，请重试。', story); return; }
      if (!live()) return;
      released = true;
      setBagReturnHook(null);
      try { UI.log('[[icon:notes]] 接应凭据已交付：两格商品免费，金色边框标记，可整理背包后领取。','loot'); } catch { /* The saved receipt remains authoritative. */ }
      renderShop();
    });
    setReturn(story);
  };
  const next = async () => {
    if (!live()) return;
    if (pending.status === 'applied') { story(); return; }
    if (pending.slots.length === 2) {
      const result = await applyCommissionDiscount({ stock, pending, starter:SDT.Cards.SHA, quotes, current:live, save:saveCurrent });
      if (result === 'stale') {
        retryPage('原定免单货位已变化，尚未应用优惠，接应凭据保留。', next); return;
      }
      if (result === 'unsaved') {
        retryPage('免费货位尚未保存，优惠未应用；原投骰结果保留，可重试。', next); return;
      }
      story(); return;
    }
    const outcomes = commissionEligibleSlots(stock,SDT.Cards.SHA)
      .filter(({index}) => !pending.slots.includes(index)).map(({slot,index}) => ({
        label:`第 ${index + 1} 格 · ${slot.mystery ? '神秘货箱' : slot.card.name}`,value:index,
      }));
    if (!outcomes.length) { retryPage('当前没有可免单货位，接应凭据进度保留。', next); return; }
    const diceUI = { ...UI, act:(name,handler) => UI.act(name,data => { if (!saving && live()) return handler(data); }) };
    await createEventDiceController({UI:diceUI,SDT,save:saveCurrent,show,bind:bound,setReturn,
      onLeave:() => lastSaveFailed ? retryPage('保存未成功，本次骰子与凭据进度保留。', next) : tryLeave() }).open({owner:pending,
      key:`free-slot:${pending.slots.length}`,title:`接应凭据 · 第 ${pending.slots.length + 1} 格免单`,outcomes,
      current:live, done:async index => {
        if (!live() || !sameSlot(index) || pending.slots.includes(index)) return;
        pending.slots.push(index); await next();
      }});
  };
  const renderStart = () => {
    if (!live()) return;
    show({title:'中断的接应 · 交付凭据',sub:'你把运输员的接应凭据递过柜台。行商扫了一眼签名，取出一枚骰子。',
      body:'<p>“老规矩，你亲手投两次。选中的两格货物由运输员付钱，初始攻击不在这张凭据里。”</p><button class="ov-btn ok" data-act="commissionStart">交付凭据，投骰免单</button>'});
    const active = bound('commissionStart');
    UI.act('commissionStart',() => { if (active()) return next(); });
    setReturn(renderStart);
  };
  const start = async () => {
    if (!live()) return;
    if (pending.slots != null && !Array.isArray(pending.slots)) { retryPage('接应凭据进度无法读取，原记录保留。', start); return; }
    const oldKey = pending.shopKey, hadKey = Object.hasOwn(pending,'shopKey');
    const oldSlots = pending.slots, hadSlots = Object.hasOwn(pending,'slots');
    const oldDice = pending.dice, hadDice = Object.hasOwn(pending,'dice');
    // Only an unapplied voucher can move on. Old slot/die drafts belong to the
    // departed shop; applied discounts remain receipts for that shop alone.
    if (movingDraft) { pending.slots = []; delete pending.dice; }
    pending.shopKey = key; pending.slots ||= [];
    if (!await saveCurrent()) {
      restoreField(pending,'shopKey',oldKey,hadKey); restoreField(pending,'slots',oldSlots,hadSlots);
      restoreField(pending,'dice',oldDice,hadDice);
      retryPage('凭据归属尚未保存，商品与投骰均未改变，请重试。', start); return;
    }
    if (!live()) return;
    if (pending.status === 'applied') { story(); return; }
    renderStart();
  };
  start();
  return true;
}
