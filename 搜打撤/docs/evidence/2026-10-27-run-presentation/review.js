// Constructed visual cases, using production renderers and the real commission controller.
import '/src/ui/ui-scale.js';
import { eventSceneHTML } from '/src/ui/node-scene-view.js';
import { encounterOpeningHTML } from '/src/ui/encounter-presentation.js';
import { extractionDoneHTML } from '/src/ui/extraction-rewards-view.js';
import { runMementoHTML } from '/src/ui/run-memento-view.js';
import { settlementReportHTML } from '/src/ui/settlement-report.js';
import { buildRunMemento } from '/src/run/run-memento.js';
import { openShopCommission } from '/src/run/shop-commission.js';
import '/css/entry-events.css';
import '/css/event-dice.css';

const body = document.getElementById('ovBody');
const overlay = document.getElementById('overlay');
let scenario = 0;
const rich = html => html.replace(/\[\[icon:[^\]]+\]\]/g, '');
const fixture = () => ({ layerIdx:3, trackPos:0, coins:8, turn:12,
  layerData:['外围荒地','风雪哨线','冻土遗迹','污染核心'].map(name => ({ name, logical:[{}, {}, {}] })),
  explored:{'0,0':1,'0,1':1,'1,0':1,'1,1':1,'2,0':1,'2,1':1,'3,0':1},
  nodeRewards:{ '1,1':{ type:'closed', commission:{ status:'applied' } } },
  altarActivated:true, bossKilled:true, eventLog:[] });
const UI = { el:{ovBody:body,overlay}, _overlayRevision:0, acts:{},
  showOverlay(_title, html) {
    body.parentElement.className = html.includes('settlement-report') ? 'card doom' : 'card page';
    overlay.className = html.includes('settlement-report') ? 'fx-doom' : '';
    body.innerHTML = rich(html); this._overlayRevision++;
  },
  act(name, handler) { this.acts[name] = handler; }, log() {} };
body.addEventListener('click', event => {
  const button = event.target.closest('[data-act]');
  if (button && !button.disabled) UI.acts[button.dataset.act]?.(button.dataset);
});
function render(kind) {
  const generation = ++scenario; UI.acts = {};
  if (kind === 'commission') {
    body.innerHTML = '<main>正在核对凭据</main>';
    const game = { shopStock:[{card:{name:'精神药水'},price:0,free:true},{card:{name:'长剑'},price:0,free:true}],
      nodeRewards:{ '0,1':{ commission:{status:'applied',slots:[0,1],shopKey:'review'} } } };
    openShopCommission({game,UI,SDT:{Cards:{SHA:{id:'sha'}}},stockKey:'review',save:()=>true,
      current:()=>scenario === generation,leave:()=>{},renderShop:()=>{
        UI.showOverlay('', '<main class="pg sc-shop"><section class="commission-story"><h2>接应凭据已兑付</h2><p>两件商品仍可在货架免费领取。</p><button type="button" data-act="reviewBack">返回兑付场景</button></section></main>');
        UI.act('reviewBack',()=>render('commission'));
      }});
    return;
  }
  if (kind === 'success' || kind === 'failure') {
    const game = fixture();
    if (kind === 'failure') { game.bossKilled = false; game.altarActivated = false; }
    const memento = buildRunMemento(game,[{card:{name:'长剑',rarity:'稀有'},count:1}]);
    UI.showOverlay('', kind === 'success' ? extractionDoneHTML({receipt:{outcome:'clear',layersReached:4,durationSec:603,
      netTake:{cardsStashed:7,wood:2,rations:1},firstExplore:{xp:42},memento}})
      : settlementReportHTML({title:'撤离失败',subtitle:'战斗中生命归零 · 远征到此为止',banner:'',
        content:'<p>安全格抢运回基地 1 张。</p>' + runMementoHTML(memento,{failed:true}),
        actions:[{action:'reviewEnd',label:'返回基地',primary:true}]}));
    UI.act('goBase',()=>render('success')); UI.act('reviewEnd',()=>render('failure'));
    return;
  }
  const supply = kind === 'supply', altar = kind === 'altar';
  UI.showOverlay('',eventSceneHTML({tone:supply ? 'event' : altar ? 'altar' : 'battle',title:supply ? '失联配给柜' : altar ? '污染祭坛' : '首脑迎战',
    sub:supply ? '封存的配给柜仍与备用电源连接。' : altar ? '沉睡的祭坛等待你的献礼。' : '首脑战使用独立牌库，请先检查随身卡牌。',
    body:encounterOpeningHTML(supply ? 'tt6-mystery' : altar ? 'altar' : 'boss',{animate:true}) +
      `<button type="button" class="evt-opt" data-act="reviewChoice"><b>${supply ? '启动配给柜' : altar ? '弃 3 张 · 激活祭坛' : '继续迎战'}</b><span>${supply ? '1～3 点：员工通行证A碎片 ×1；4～6 点：3 币' : altar ? '回赠二选一；本页仅验证呈现，不进行献祭。' : '开战前整理并选择牌库；本页不启动战斗。'}</span></button>`,
    foot:'<button type="button" class="ov-btn" data-act="reviewChoice">返回地图</button>',region:'污染核心',layer:3}));
  UI.act('reviewChoice',()=>{ document.getElementById('reviewStatus').textContent = '操作已响应，演出未阻挡按钮。'; });
}
document.querySelectorAll('[data-scene]').forEach(button => button.addEventListener('click',()=>render(button.dataset.scene)));
document.getElementById('reviewMotion').addEventListener('change',event=>document.body.classList.toggle('reduce-motion',event.target.checked));
render('success');
