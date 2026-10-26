import {describe,expect,it} from 'vitest';
import {extractionDoneHTML,extractionStashHTML} from '../game/src/ui/extraction-rewards-view.js';
import {esc} from '../game/src/core/shared.js';
const common={id:'c',name:'普通卡',rarity:'古朴'},rare={id:'l',name:'传说卡',rarity:'传说'};
const cardHTML=c=>`<div class="hs-card">${esc(c.name)}</div>`;
const show=opts=>{document.body.innerHTML=extractionStashHTML({cardHTML,...opts});};
describe('extraction reward presentation',()=>{
 it('partial capacity offers explicit rarity and value choices and preserves original command indices',()=>{
  show({remainingCards:[{card:common,count:5},{card:rare,count:14}],room:7,stashUsed:21,stashCap:28});
  expect(document.querySelector('[data-act=exAll]')).toBeNull();
  expect(document.querySelector('[data-act=exRarity]').textContent).toContain('7 张');
  const smart=document.querySelector('[data-act=exSmart]');expect(smart.disabled).toBe(false);expect(smart.textContent).toBe('按估值入库');expect(smart.title).toContain('同估值按背包原次序');
  expect(document.querySelector('[data-act=exInspect]').dataset.i).toBe('1');expect(document.querySelector('[data-act=exStash]').dataset.i).toBe('1');
  expect(document.querySelector('.exr-finish-note').textContent).toContain('将丢失 19 张');expect(document.querySelector('[data-act=exFinish]').textContent).toContain('放弃 19 张');
 });
 it('all-in is offered only when the complete candidate set fits',()=>{
  show({remainingCards:[{card:common,count:5}],room:5});expect(document.querySelector('[data-act=exAll]').textContent).toContain('5 张');expect(document.querySelector('[data-act=exSmart]')).toBeNull();expect(document.querySelector('[data-act=exRarity]').disabled).toBe(false);
 });
 it('full storage disables deposits while leaving inspection and finish available',()=>{
  show({remainingCards:[{card:rare,count:5}],room:0});for(const act of ['exStash','exRarity','exSmart'])expect(document.querySelector(`[data-act=${act}]`).disabled).toBe(true);for(const act of ['exInspect','exFinish'])expect(document.querySelector(`[data-act=${act}]`).disabled).toBe(false);
 });
 it('a partial stack exposes the exact amount and warehouse capacity',()=>{
  show({remainingCards:[{card:common,count:5}],room:2,stashUsed:8,stashCap:10});const b=document.querySelector('[data-act=exStash]');expect(b.textContent).toContain('入库 2/5 张');expect(b.getAttribute('aria-label')).toContain('可入库 2/5 张');const meter=document.querySelector('[role=meter]');expect(meter.getAttribute('aria-valuenow')).toBe('8');expect(meter.getAttribute('aria-valuemax')).toBe('10');
 });
 it('saved cards and retained consumption cards remain separate with probability and rule losses',()=>{
  show({savedCards:[{card:rare,count:7}],pocketKept:20,pocketLost:58,pocketRuleLost:9,keptPocket:[{card:common,count:20}]});expect(document.querySelector('.exr-saved-shelf').textContent).toContain('本次已入库 7 张');expect(document.querySelector('.exr-pocket-count').textContent).toBe('20 张');expect(document.querySelector('.exr-pocket-loss').textContent).toContain('概率散失 49 张');expect(document.querySelector('.exr-pocket-loss').textContent).toContain('初始攻击/职业卡 9 张不可带回');expect(document.querySelector('[data-act=exPocketInspect]')).not.toBeNull();
 });
 it('secondary receipts start collapsed and the permanent loss warning stays in the footer',()=>{
  show({remainingCards:[{card:rare,count:5}],room:2,pocketKept:3,pocketLost:7});expect(document.querySelector('.exr-storage-details').open).toBe(false);expect(document.querySelector('.exr-pocket-list').open).toBe(false);expect(document.querySelector('.exr-finish-note').closest('details')).toBeNull();expect(document.querySelector('.exr-finish-note').textContent).toContain('永久失去');
 });
 it('empty storage shows a saved completion action without irrelevant probability or deposit controls',()=>{
  show({});expect(document.querySelector('[data-act=exAll],[data-act=exRarity],[data-act=exSmart]')).toBeNull();expect(document.querySelector('[data-act=exFinish]').textContent).toContain('完成整理');expect(document.querySelector('.exr-pocket')).toBeNull();
 });
 it('done shows four distinct receipt totals and keeps saved cards inspectable under a disclosure',()=>{
  document.body.innerHTML=extractionDoneHTML({cardHTML,receipt:{savedCards:[{card:rare,count:2}],netTake:{cardsStashed:2,pocketKept:3,wood:9,rations:4},growth:{actualXp:20}}});
  expect([...document.querySelectorAll('.exr-totals>div')].map(n=>n.textContent)).toEqual(['卡牌入库2 张','木材+9','口粮+4','人物经验+20']);expect(document.querySelector('.exr-done-cards').open).toBe(false);expect(document.querySelectorAll('[data-act=exDoneInspect]')).toHaveLength(1);expect(document.querySelector('.exr-receipt-details summary').textContent).toContain('待复原 3 张');expect(document.querySelector('[data-act=goBase]')).not.toBeNull();
 });
 it('remaining-card confirmation escapes names and exposes separate cancel and irreversible finish actions',()=>{
  show({remainingCards:[{card:{...common,name:'<script>unsafe</script>'},count:12}],room:2,confirmFinish:true});expect(document.querySelector('.exr-confirm-list').textContent).toContain('<script>unsafe</script>×12');expect(document.querySelector('script')).toBeNull();expect(document.querySelector('[data-act=exFinish]')).toBeNull();expect(document.querySelector('[data-act=exCancelFinish]').classList.contains('exr-primary')).toBe(true);expect(document.querySelector('[data-act=exConfirmFinish]').textContent).toBe('确认放弃 12 张并完成');expect(document.querySelector('.exr-confirm-actions').closest('.exr-confirm-list')).toBeNull();
 });
 it('historical carried counts do not relabel the source of a remaining stack',()=>{
  show({remainingCards:[{card:common,count:3}],savedCards:[{card:common,count:2}],room:0,broughtByName:new Map([[common.name,2]])});expect(document.querySelector('.exr-brought')).toBeNull();expect(document.querySelector('.exr-item-meta').textContent).toContain('×3');expect(document.querySelector('.exr-finish-note').textContent).toContain('带入卡同样适用');
 });
});
