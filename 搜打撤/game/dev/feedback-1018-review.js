// 构造隔离测试局；不选择玩家档位，不写入Base/Run，不替代自然跑局证据。
import '../src/main.js';
import { game, newUid, _set_active_slot } from '../src/run/game.session.js';
import { devJumpNode } from '../src/run/game.run.dev.js';
import { showBackpack } from '../src/hub/game.bag.js';
import { openBossGate } from '../src/run/game.run.altar.js';
import { startBattle } from '../src/battle/battle-loader.js';
import { warehouseHTML, bindWarehouse } from '../src/hub/hub.warehouse.js';
const SDT=window.SDT, UI=SDT.UI;
const card=id=>{const found=SDT.Cards.all().find(c=>c.id===id);if(!found)throw new Error(`缺少卡牌 ${id}`);return {...found};};
function prepare(ids) {
  _set_active_slot(null);
  SDT.Sound.setMuted?.(true);
  devJumpNode('shop');
  UI.hideOverlay({immediate:true});
  game.state='idle';game.battleActive=false;game.hp=30;game.maxHp=30;
  game.inventory=[];game.usedPocket=[];game.cardOrder=[];
  game.ownedCards=ids.map(id=>({uid:newUid(),card:card(id)}));
}
const controls=document.createElement('nav');
controls.style.cssText='position:fixed;left:12px;top:12px;z-index:100000;display:flex;gap:6px;background:#18232b;padding:8px;color:white;font:14px sans-serif';
controls.innerHTML='<button data-review="bag">构造背包</button><button data-review="battle">构造战斗</button><button data-review="boss">构造首脑入口</button><button data-review="warehouse">构造后勤资源</button><button data-review="hide">隐藏验收入口</button>';
controls.addEventListener('click',async event=>{
  const kind=event.target.closest('[data-review]')?.dataset.review;
  if(!kind)return;
  if(kind==='hide'){controls.hidden=true;return;}
  if(game.battleActive){UI.log('请刷新隔离夹具后再切换场景','warn');return;}
  if(kind==='bag'){
    prepare(['tt4-shine-token','tt4-shine-token','tt3-grass-armor','tt3-grass-armor',...Array(5).fill('starter-attack')]);
    game.inventory=[{name:'木材',tier:'C',value:1,count:4}];
    showBackpack();
  }else if(kind==='battle'){
    prepare(['tt3-grass-armor','cc-cursed-blade','tt12-barriermend','tt3-holy-shield','tt3-frostfall',...Array(5).fill('starter-attack')]);
    await startBattle(game,{id:'infantry',name:'留言训练靶',hp:999,maxHp:999,atk:1},{isBoss:false,devSample:true});
  }else if(kind==='boss'){
    prepare(['tt3-grass-armor','tt3-frostfall',...Array(16).fill('tt3-holy-shield'),...Array(5).fill('starter-attack')]);
    game.altarActivated=true;openBossGate();
  }else if(kind==='warehouse'){
    prepare([]);
    // 此Base端口仅持有夹具内存，不调用真实基地持久化。
    const base={slot:'feedback-fixture',PET_EGG_ID:'egg',data:{stash:[{card:card('tt-wood'),count:2}],pocket:[],keys:0,wood:0},stashUsed:()=>base.data.stash.reduce((n,s)=>n+s.count,0),stashCap:()=>25,
      materialInfo:()=>({kind:'wood',label:'木材'}),useStashMaterial(name){const stack=base.data.stash.find(s=>s.card.name===name);if(!stack)return {ok:false};stack.count--;base.data.wood++;if(!stack.count)base.data.stash=[];return {ok:true,msg:`已使用木材；夹具库存 ${base.data.wood}`};}};
    SDT.Base=base;
    const render=()=>{game.state='modal';UI.showOverlay('后勤隔离夹具',warehouseHTML(),'page');bindWarehouse({ui:UI,base,sound:{tick(){},ding(){}},refresh:render});};render();
  }
});
document.body.append(controls);
