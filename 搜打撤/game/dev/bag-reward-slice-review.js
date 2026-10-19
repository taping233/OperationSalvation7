// Production reward commands and views, with deterministic rewards and memory-only ports.
import SDT, { sdtDefine } from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import '../src/ui/ui-scale.js';
import { rulesSlice } from '../src/cards/cards.rules.js';
import { dataSlice } from '../src/cards/cards.data.js';
import { cardHTML } from '../src/cards/cards.view.js';
import { UI } from '../src/ui/ui.js';
import { canAcceptCardAtCapacity, canReceiveCardFromBag, stackCapOf } from '../src/core/card-capacity.js';
import { createRewardOrganizer } from '../src/hub/game.reward-organizer.js';
import { bagSlots } from '../src/hub/game.bag.bridge.js';
import { pageHTML as bagPageHTML } from '../src/hub/game.bag.view2.js';
import { inspectVisibleLayout } from './visible-layout-check.js';
import { markReviewReady } from './review-readiness.js';
import { installTargetMotionLifecycle } from '../src/ui/target-motion.js';
import { installCardStateMotion } from '../src/ui/card-state-motion.js';
import { installSelectionStateMotion } from '../src/ui/selection-state-motion.js';

// The isolated reward harness uses the same public interaction services as UI.
installTargetMotionLifecycle(document.body);
installCardStateMotion(document.body);
installSelectionStateMotion(document.body);

// Reuse the production stylesheet order without executing the game bootstrap.
const source = new DOMParser().parseFromString(await (await fetch('/index.html')).text(), 'text/html');
await Promise.all([...source.querySelectorAll('link[rel="stylesheet"]')].map(link => new Promise(resolve => {
  const style = link.cloneNode(); style.href = new URL(link.getAttribute('href'), location.origin).href;
  style.onload = style.onerror = resolve; document.head.append(style);
})));
const catalog = Object.values(dataSlice).filter(Array.isArray).flat();
sdtDefine('Cards', { ...rulesSlice, ...dataSlice, all:() => catalog, cardHTML });
sdtDefine('Sound', { sfx() {} });
sdtDefine('Base', { slot:null, bagCap:() => game.capacity, isSha:card => card.id === 'starter-attack' });
sdtDefine('MAP', { chestKinds:{ small:{name:'小型物资箱',cards:1}, medium:{name:'密封物资箱',cards:3,pickFrom:3}, large:{name:'大型物资箱',cards:6} } });
const body = document.querySelector('#ovBody'), overlay = document.querySelector('#overlay');
const output = document.querySelector('#sliceOutput'), select = document.querySelector('#sliceCase');
UI.el = { ovBody:body, overlay, ovTitle:document.querySelector('#ovTitle'), ovCloseX:null };
UI.showOverlay = (title, html) => { UI.el.ovTitle.innerHTML = title; body.innerHTML = SDT.Icons.rich(html); overlay.hidden = false; markReviewReady(body); };
UI.hideOverlay = () => { overlay.hidden = true; };
UI.refresh = () => {};
UI.log = () => {};
body.addEventListener('click', event => {
  const button = event.target.closest('[data-act]');
  if (button && !button.disabled) UI._acts[button.dataset.act]?.(button.dataset);
});
let uid = 0, game, parked = null, firstCards = [], firstImages = [];
function usedSlots(safe = false) {
  const groups = new Map();
  for (const owned of game.ownedCards) {
    if (!!owned.safe !== safe) continue;
    const group = groups.get(owned.card.name) || {card:owned.card,count:0};
    group.count++; groups.set(owned.card.name, group);
  }
  return [...groups.values()].reduce((sum, group) => sum + Math.ceil(group.count / stackCapOf(group.card)), 0);
}
const card = id => ({...catalog.find(item => item.id === id)});
function rememberCards() {
  firstCards = [...body.querySelectorAll('.reward-card')];
  firstImages = [...body.querySelectorAll('.reward-card img')];
}
const { SDT: facade } = await import('../src/run/chests.js');
function reset() {
  document.getElementById('cardZoom')?._closeCardZoom?.(true);
  parked = null;
  const full = select.value === 'full';
  game = { seed:190019, layerIdx:0, trackPos:0, discoveredPairs:{}, state:'idle', battleActive:false,
    capacity:full ? 2 : 16, inventory:[], ownedCards:full ? ['tt3-azure-sword','tt3-grass-armor'].map(id => ({uid:++uid,card:card(id)})) : [],
    usedSlots:() => usedSlots(), bagCap:() => game.capacity, stackCapOf,
    bagCapacityText:() => `${usedSlots()}/${game.capacity} 格`, gainCoins() {}, persistSave() {},
    canReceiveCard:item => canReceiveCardFromBag(item, {ownedCards:game.ownedCards,canAcceptCard:next => canAcceptCardAtCapacity(next,{usedSlots:usedSlots(),baseCap:game.capacity,totalCap:game.capacity})}),
    grantCard(item) { if (!this.canReceiveCard(item)) return false; this.ownedCards.push({uid:++uid,card:item}); return true; },
  };
  bagSlots.organizeReward = createRewardOrganizer({UI,game,shaName:'初始攻击',usedSlots:() => usedSlots(),bagCap:game.bagCap,safeUsed:() => usedSlots(true),safeCap:() => 3,
    moveStackSafe(name, safe) { const stack = game.ownedCards.filter(owned => !owned.safe && owned.card.name === name); stack.forEach(owned => {owned.safe = safe;}); return !!stack.length; },
    discardOwnedCard(name, safe, id) { const index = game.ownedCards.findIndex(owned => owned.uid === id && owned.card.name === name && !!owned.safe === safe); if (index < 0) return false; game.ownedCards.splice(index,1); return true; },
  });
  bagSlots.showBackpack = () => {
    facade.Chests.suspend();
    const tiles = game.ownedCards.filter(owned => !owned.safe).map(owned => ({uids:[owned.uid],name:owned.card.name,card:owned.card,rarity:owned.card.rarity,type:owned.card.type,count:1,zone:'bag'}));
    UI.showOverlay('背包 · 隔离只读', bagPageHTML({bagZone:'bag',bagFilter:'all',bagSortKey:'rarity',cap:game.capacity,baseCap:game.capacity,total:game.ownedCards.length,safeUsedN:usedSlots(true),sCap:3,pkN:0,used:usedSlots(),coins:0,fragments:0,tiles}));
    UI.act('closeBag', () => facade.Chests.resume());
    UI.act('inspectStack', data => { const owned = game.ownedCards.find(item => item.card.name === data.name); if (owned) UI.showCardZoom(owned.card,{hideNote:true,presentation:'inventory'}); });
  };
  const ids = select.value === 'choice' ? ['tt3-ice-spike','tt3-azure-sword','tt4-woodify','tt3-iceheart-potion'] : full ? ['tt3-ice-spike','tt4-woodify'] : ['tt3-ice-spike','tt3-azure-sword','tt4-woodify','tt3-iceheart-potion','tt3-grass-armor','tt3-frostfall'];
  const reward = {kind:'large',source:'隔离奖励',title:'领取奖励',cards:ids.map(card),coins:0,coinsReceived:true,claimMode:select.value === 'choice' ? 'one' : 'all',choiceCount:select.value === 'choice' ? 3 : ids.length,taken:[],lost:[],rewardStage:'cards',selected:null,leaveConfirm:false,notice:''};
  const saved = {version:1,seed:game.seed,layerIdx:0,trackPos:0,queue:[{kind:'large',reward}],index:1,current:reward,screen:'cards',context:{onCell:true}};
  facade.Chests.restore(game,saved,() => {output.textContent = '隔离奖励已处理完毕。'; output.hidden = false;});
  output.hidden = true; rememberCards(); markReviewReady(body);
}
document.querySelector('#sliceReset').addEventListener('click', reset);
select.addEventListener('change', reset);
document.querySelector('#sliceResume').addEventListener('click', () => {
  const saved = parked || game.nodeChestRewards?.['0,0'];
  if (saved) { facade.Chests.restore(game,saved,() => {}); parked = null; rememberCards(); markReviewReady(body); }
});
document.querySelector('#sliceInspect').addEventListener('click', () => {
  parked = facade.Chests.serialize(game) || parked;
  output.textContent = JSON.stringify({sameCardNodes:firstCards.filter(node => node.isConnected).length,initialCardNodes:firstCards.length,sameImageNodes:firstImages.filter(node => node.isConnected).length,initialImageNodes:firstImages.length,focus:document.activeElement?.dataset,owned:game.ownedCards.map(owned => ({name:owned.card.name,safe:!!owned.safe})),layout:inspectVisibleLayout(body)},null,2);
  output.hidden = false;
});
document.querySelector('#sliceHide').addEventListener('click', () => { document.querySelector('.slice-tools').hidden = true; output.hidden = true; });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const zoom = document.getElementById('cardZoom');
  if (zoom) { zoom._closeCardZoom?.(); return; }
  const back = body.querySelector('[data-cancel="true"]');
  if (back) back.click(); else document.querySelector('.slice-tools').hidden = false;
});
reset();
