import SDT from '../src/core/sdt-facade.js';
import '../src/core/icons-bitmap.js';
import '../src/core/art.js';
import '../src/ui/ui-scale.js';
import { eventSceneHTML } from '../src/ui/node-scene-view.js';
import { wireEventChoiceSelection } from '../src/ui/event-choice-selection.js';
import { fireRestDecisionHTML } from '../src/ui/fire-rest-view.js';
import { entrySupplyIntroHTML } from '../src/ui/node-decision-view.js';
import { chestRewardFrameHTML, chestRewardOverviewHTML } from '../src/ui/chest-reward-overview.js';

// Uses production views and event binding, fixed examples only; no saves or grants.
const host = document.querySelector('#ovBody');
function paint(mode = 'event') {
  const frame = {region:'城市外围',layer:0};
  if (mode === 'entry') {
    host.innerHTML = SDT.Icons.rich(eventSceneHTML({...frame,tone:'entry',title:'入城补给',sub:'随行的职业补给已留在城门旁。',asset:'scene-door-bg',body:entrySupplyIntroHTML({count:3,character:'星月',capacity:'8 / 16 格'})}));
  } else if (mode === 'chest') {
    host.innerHTML = SDT.Icons.rich(chestRewardFrameHTML({overview:chestRewardOverviewHTML({title:'物资箱',boxes:[{index:0,name:'密封物资箱'}],footer:'背包 8 / 16 格'})}));
  } else if (mode === 'boxes') {
    host.innerHTML = SDT.Icons.rich(chestRewardFrameHTML({overview:chestRewardOverviewHTML({title:'本次收获',source:'废弃哨站',boxes:[{index:0,name:'职业补给箱',choice:true},{index:1,name:'密封物资箱'},{index:2,name:'旧物资箱',completed:true,takenCount:2}],footer:'背包 8 / 16 格'})}));
  } else if (mode === 'fire') {
    host.innerHTML = SDT.Icons.rich(eventSceneHTML({...frame,tone:'fire',title:'营火休整',sub:'火光拦住了风雪。稍作休整，再继续前行。',asset:'scene-fire-bg',body:fireRestDecisionHTML({heal:10,hp:24,maxHp:40,chance:30,restorable:4,fits:true,capacity:'8 / 16 格'}),foot:'<button class="ov-btn" data-act="previewBag">整理背包</button><button class="ov-btn" data-act="previewReturn">离开火堆</button>'}));
  } else {
    const body = '<button class="evt-opt ok" data-act="previewSearch"><b>在外侧搜寻</b><span>获得 <strong>3</strong> 币</span></button><button class="evt-opt danger" data-act="previewBreach"><b>冒险挖深</b><span>获得 <strong>6</strong> 币，<em>失去 3 生命</em></span></button>' + (mode === 'long' ? Array.from({length:4},(_,i) => `<button class="evt-opt" data-act="previewMore" data-i="${i}"><b>调查第 ${i+1} 处遗迹的残留信号</b><span>检查积雪覆盖的废弃物资，不同的路径可能通向不同结果。保持警惕。</span></button>`).join('') : '');
    host.innerHTML = SDT.Icons.rich(eventSceneHTML({...frame,tone:'event',title:'废弃金矿',sub:'塌陷的矿井里仍有金属反光，但支撑梁正在呻吟。',body,asset:'scene-event-goldmine'}));
    wireEventChoiceSelection(host.querySelector('.event-scene'), `preview:${mode}`);
  }
}
document.querySelectorAll('[data-preview]').forEach(button => button.addEventListener('click', () => paint(button.dataset.preview)));
document.querySelector('#hideTools').addEventListener('click', () => { document.querySelector('.review-tools').hidden = true; });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { host.querySelector('.event-scene')?._clearEventChoice?.(); document.querySelector('.review-tools').hidden = false; } });
host.addEventListener('click', event => {
  const button = event.target.closest('[data-act]');
  if (!button || button.disabled) return;
  if (/^preview(Search|Breach|More)$/.test(button.dataset.act)) {
    host.querySelector('.event-narrative').textContent = '预览确认成功；这里不改变金币、生命或存档。';
  }
});
paint();
