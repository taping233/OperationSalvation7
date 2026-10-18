import { esc } from '../core/shared.js';
import { createEventDiceController } from '../ui/event-dice.js';

export function commissionEligibleSlots(stock, starter) {
  return stock.map((slot,index) => ({slot,index})).filter(({slot}) => slot.card && !slot.empty && !slot.sold
    && !slot.free && slot.price > 0 && slot.shaReplenish == null && slot.card.id !== starter?.id
    && slot.card.name !== starter?.name);
}

// The commission remains inside its source event's run record; no global/base reward is granted.
export function openShopCommission({ game, UI, SDT, stockKey, save, current, renderShop, leave }) {
  const key = stockKey || `shop:${game.layerIdx},${game.trackPos}`;
  const pending = Object.values(game.nodeRewards || {}).map(record => record.commission)
    .find(record => record && (!record.shopKey || record.shopKey === key)
      && (record.status === 'pending' || (record.status === 'applied' && !record.announced)));
  if (!pending) return false;
  if (!pending.shopKey && commissionEligibleSlots(game.shopStock,SDT.Cards.SHA).length < 2) {
    UI.log('行商没有足够的可免单商品，配送凭据保留到下一家商店。','sys');
    return false;
  }
  pending.shopKey = key;
  pending.slots ||= [];
  const show = ({title,sub,body}) => UI.showOverlay('',`<main class="pg node-pg sc-shop" data-asset-key="scene-shop-bg"><section class="commission-story"><h2>${esc(title)}</h2><p>${esc(sub)}</p>${body}</section></main>`,'page');
  const bound = act => {
    const page = UI.el?.ovBody?.firstElementChild;
    return () => current() && UI.el?.ovBody?.firstElementChild === page && !!page?.querySelector(`[data-act="${act}"]`);
  };
  const story = () => {
    if (!current()) return;
    show({title:'校工已经替你结了账',sub:'行商接过配送凭据，核对了校工的签名。他划掉两张价签，把货物往你面前推近。',
      body:`<p>“送信的报酬。标亮的两格，免费拿走。”</p><p>${pending.slots.map(index => `第 ${index + 1} 格：${game.shopStock[index].mystery ? '神秘货箱' : esc(game.shopStock[index].card.name)}`).join('<br>')}</p><button class="ov-btn ok" data-act="commissionEnterShop">查看两格免费商品</button>`});
    const active = bound('commissionEnterShop');
    UI.act('commissionEnterShop', () => {
      if (!active()) return;
      pending.announced = true;
      if (save() === false) { pending.announced = false; return; }
      UI.log('[[icon:notes]] 配送凭据已交付：两格商品免费，金色边框标记，可整理背包后领取。','loot');
      renderShop();
    });
  };
  const next = () => {
    if (!current()) return;
    if (pending.slots.length === 2) {
      pending.slots.forEach(index => Object.assign(game.shopStock[index],{price:0,free:true,commissionFree:true}));
      pending.status = 'applied';
      if (save() === false) { leave(); return; }
      story(); return;
    }
    const outcomes = commissionEligibleSlots(game.shopStock,SDT.Cards.SHA)
      .filter(({index}) => !pending.slots.includes(index)).map(({slot,index}) => ({
        label:`第 ${index + 1} 格 · ${slot.mystery ? '神秘货箱' : slot.card.name}`,value:index,
      }));
    createEventDiceController({UI,SDT,save,show,bind:bound,onLeave:leave}).open({owner:pending,
      key:`free-slot:${pending.slots.length}`,title:`配送凭据 · 第 ${pending.slots.length + 1} 格免单`,outcomes,
      current, done:index => { pending.slots.push(index); next(); }});
  };
  if (pending.status === 'applied') story();
  else {
    show({title:'送到下一家店的信',sub:'你把校工的配送凭据递过柜台。行商扫了一眼签名，取出一枚骰子。',
      body:'<p>“老规矩，你亲手投两次。选中的两格货物由校工付钱，初始攻击不在这张凭据里。”</p><button class="ov-btn ok" data-act="commissionStart">交付凭据，投骰免单</button>'});
    const active = bound('commissionStart');
    UI.act('commissionStart',() => { if (active()) next(); });
  }
  save();
  return true;
}
