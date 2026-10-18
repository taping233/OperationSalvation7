// Scenario construction only; controls below use the production event/shop handlers.
// The HTML installs memory-only storage before the game boots.
import '../src/main.js';
import { game, _set_active_slot, newRun, newUid, saveGame, bagCap, usedSlots } from '../src/run/game.session.js';
import { _set_cardPageOpen, cardHTML } from '../src/hub/game.cardslib.js';
import { runEventDeck } from '../src/run/game.run.flow.js';
import { createShopController } from '../src/run/game.run.shop.js';
const SDT=window.SDT, UI=SDT.UI;
const controls=document.createElement('nav');
controls.style.cssText='position:fixed;left:8px;top:5px;z-index:100000;display:flex;gap:6px;background:#17212b;padding:7px;color:white;font:12px sans-serif';
controls.innerHTML='<span>事件验收 · 内存隔离</span>'+[
  ['tt6-bandits','暴雨劫道'],['tt6-mystery','实验室余粮'],['tt6-goldhammer','满电动力锤'],['tt6-relief','临时救护站'],['tt6-chestdraw','熔断物资箱'],['ev19-gamble','黑市'],['ev19-recode','重编'],
].map(([id,label])=>`<button data-review-event="${id}">${label}</button>`).join('')+'<button id="review-shop">下一商店</button><button id="review-reenter">重进事件</button><output id="review-status"></output>';
document.body.append(controls);
// Review controls must remain operable while production dialogs isolate their background.
new MutationObserver(() => { if (controls.hasAttribute('inert')) controls.removeAttribute('inert'); })
  .observe(controls,{attributes:true,attributeFilter:['inert']});
function status(){document.getElementById('review-status').textContent=`${game.coins||0}币 / 碎片${game.fragments||0} / HP${game.hp||0} / 委托${Object.values(game.nodeRewards||{}).map(r=>r.commission?.status).filter(Boolean).join(',')}`;}
function prepare(){
  _set_active_slot(null);SDT.Sound.setMuted?.(true);game.runActive=false;game.battleActive=false;
  newRun('standard',[],{skipClassChoice:true});document.getElementById('title').hidden=true;
  game.characterId='heixiang';game.myClass='战士';UI.hideOverlay({immediate:true});game.state='idle';game.coins=18;game.hp=10;game.maxHp=35;game.fragments=0;
  game.entrySupply=null;game.nodeRewards={};game.nodeChestRewards={};game.visited={};game.shopStocks={};
  game.ownedCards=SDT.Cards.all().filter(c=>['武术','法术'].includes(c.type)&&c.rarity==='古朴'&&SDT.Cards.isRandomObtainable(c)).slice(0,3).map(card=>({uid:newUid(),card:{...card}}));
  const layer=game.layerData[game.layerIdx];game.trackPos=layer.logical.findIndex((n,i)=>i>0&&n&&!(layer.doors||[]).some(d=>d.at===i));
  layer.logical[game.trackPos].def={type:'event'};
}
controls.querySelectorAll('[data-review-event]').forEach(button=>button.onclick=async()=>{
  prepare();game.nodeRewards[`${game.layerIdx},${game.trackPos}`]={version:1,type:'event',eventId:button.dataset.reviewEvent};
  await runEventDeck();status();
});
document.getElementById('review-reenter').onclick=async()=>{UI.hideOverlay({immediate:true});game.state='idle';await runEventDeck();status();};
const shop=createShopController({UI,SDT,game,bagCap,cardHTML,newUid,saveGame,setCardPageOpen:_set_cardPageOpen,usedSlots});
document.getElementById('review-shop').onclick=()=>{UI.hideOverlay({immediate:true});game.state='idle';game.trackPos++;shop.openShop('review-next-shop');status();};
document.addEventListener('click',()=>queueMicrotask(status));
