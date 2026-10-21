// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createBattleDecisionPresenter } from '../game/src/battle/view/battle.decision-shell.js';
import { battlePileBodyHTML, battleChoiceBodyHTML, battleHandSelectBodyHTML, battleDiscoverLifecycleNote } from '../game/src/battle/view/battle.decision-content.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';

const face = card => `<div class="hs-card" data-card-id="${card.id}">${card.name}</div>`;
const cards = [
  {uid:'first',card:{id:'same',name:'甲',type:'法术',cost:1,desc:'第一张的规则'}},
  {uid:'second',card:{id:'other',name:'乙',type:'武术',cost:2,desc:'另一张的规则'}},
  {uid:'copy',card:{id:'same',name:'甲',type:'法术',cost:1,desc:'第一张的规则'}},
];
const snapshot = {battleToken:12,turn:9,energy:3,maxEnergy:3,opts:{isBoss:true}};
function setup() {
  document.body.innerHTML='<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
  const UI={el:{ovBody:document.getElementById('ovBody')},showOverlay:vi.fn((_title,html)=>{UI.el.ovBody.innerHTML=html;})};
  return {UI,show:createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:3})})};
}
afterEach(()=>document.body.replaceChildren());

describe('统一战斗二级界面展示契约',()=>{
  it.each(['deck','grave'])('%s保留身份分组、首现顺序、数量和只读返回',kind=>{
    const before=JSON.stringify(cards), {show}=setup();
    const {html,stacks}=battlePileBodyHTML({cards,cardHTML:face,kind,isBoss:true});
    show('牌堆',html,true,snapshot);
    expect(stacks.map(s=>s.card.id)).toEqual(['same','other']);
    expect(stacks.map(s=>s.count)).toEqual([2,1]);
    expect(stacks[0].card).toBe(cards[0].card);
    expect([...document.querySelectorAll('.battle-pile-card')].map(b=>b.dataset.i)).toEqual(['0','1']);
    expect(document.querySelector('.battle-decision-actions button').dataset.act).toBe(kind==='deck'?'btDeckBack':'btGraveBack');
    expect(document.querySelector('.battle-pile-summary').textContent).toContain('3');
    expect(document.querySelector('.battle-pile-context').textContent).toContain('首脑战');
    expect(document.querySelector('.battle-decision-actions .battle-pile-note')).not.toBeNull();
    expect(document.querySelector('.battle-decision-content .battle-pile-note')).toBeNull();
    expect(JSON.stringify(cards)).toBe(before);
    expect(html).not.toMatch(/下一张|抽牌顺序/);
  });
  it('空牌堆仍按pile分类，保留返回且不构造假卡',()=>{
    const {show}=setup();
    show('空牌库',battlePileBodyHTML({cards:[],cardHTML:face,kind:'deck',isBoss:true}).html,true,snapshot);
    expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe('pile');
    expect(document.querySelector('.battle-decision-empty').textContent).toContain('牌库已空');
    expect(document.querySelector('.battle-decision-actions [data-act="btDeckBack"]')).not.toBeNull();
    expect(document.querySelectorAll('.battle-pile-card')).toHaveLength(0);
  });
  it('抉择明确来源、动作、数量；仍是即时单选且没有擅加取消或确认',()=>{
    const {show}=setup();
    show('抉择',battleChoiceBodyHTML({cardName:'<来源>',options:['抽 2 张牌','获得 3 点护甲']}),'discover',snapshot);
    expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe('choice');
    expect(document.querySelector('.battle-decision-source').textContent).toContain('<来源>');
    const choices=[...document.querySelectorAll('[data-act]')];
    expect(choices.map(b=>b.dataset.act)).toEqual(['btChoicePick','btChoicePick']);
    expect(choices.map(b=>b.dataset.i)).toEqual(['0','1']);
    expect(choices.every(b=>b.dataset.cancel==='false')).toBe(true);
    expect(document.querySelector('.battle-decision-actions')).toBeNull();
  });
  it('材料支付保留剩余/已选与必要选择，候选UID和详情索引分离',()=>{
    const {show}=setup();
    const selection={act:'payment',n:2,selectedUids:['previous'],mandatory:true,payment:{card:{name:'剑荡妖邪'}}};
    show('支付',battleHandSelectBodyHTML({pool:cards.slice(0,2),handSelecting:selection,cardHTML:face}),'discover',snapshot);
    expect([...document.querySelectorAll('[data-act="btPickHand"]')].map(b=>b.dataset.uid)).toEqual(['first','second']);
    expect([...document.querySelectorAll('[data-act="btDecisionInspect"]')].map(b=>b.dataset.i)).toEqual(['0','1']);
    expect(document.querySelector('.battle-task-summary').textContent).toContain('已选 1 张');
    expect(document.querySelector('[data-act="btPickHandSkip"]')).toBeNull();
    expect(selection.n).toBe(2);expect(selection.selectedUids).toEqual(['previous']);
  });
  it.each([
    ['play','免费打出'],['copy','复制，原牌保留'],['zero','下回合零费，原牌保留'],['consume','消耗'],
  ])('非支付手选%s仅摘要说明效果，来源与候选动作保持', (act, action)=>{
    const {show}=setup();
    const selection={act,n:1,mandatory:false,sourceCardName:'<来源>'};
    show('选牌',battleHandSelectBodyHTML({pool:cards.slice(0,1),handSelecting:selection,cardHTML:face}),'discover',snapshot);
    expect(document.querySelector('.battle-task-progress').textContent).toBe(action);
    expect(document.querySelector('.battle-decision-source').textContent).toBe('来自 <来源>');
    expect(document.querySelector('.battle-decision-source b img')).toBeNull();
    expect(document.querySelector('.battle-decision-guidance').textContent).toBe('点击选择，选满指定数量后继续结算。');
    expect(document.querySelector('[data-act="btPickHand"]').dataset.uid).toBe('first');
    expect(document.querySelector('[data-act="btPickHandSkip"]')).not.toBeNull();
    expect(selection.n).toBe(1);
  });
  it('无来源手选不重复效果，支付仍保留消耗后果与支付时点',()=>{
    const root=document.createElement('div');
    root.innerHTML=battleHandSelectBodyHTML({pool:[],handSelecting:{act:'copy',n:1},cardHTML:face});
    expect(root.querySelector('.battle-decision-source').textContent).toBe('从当前手牌中选择');
    root.innerHTML=battleHandSelectBodyHTML({pool:[],handSelecting:{act:'payment',n:2,selectedUids:['selected'],mandatory:true,payment:{card:{name:'代价来源'}}},cardHTML:face});
    expect(root.querySelector('.battle-task-progress').textContent).toBe('已选 1 张');
    expect(root.querySelector('.battle-decision-source').textContent).toBe('来自 代价来源 · 作为支付代价消耗');
    expect(root.querySelector('.battle-decision-guidance').textContent).toContain('选满后支付代价');
    expect(root.querySelector('[data-act="btPickHandSkip"]')).toBeNull();
  });
  it('空手牌仍按hand-select分类；仅可选效果提供原跳过动作',()=>{
    const {show}=setup();
    show('选牌',battleHandSelectBodyHTML({pool:[],handSelecting:{act:'copy',n:1,mandatory:false},cardHTML:face}),'discover',snapshot);
    expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe('hand-select');
    expect(document.querySelector('.battle-decision-actions [data-act="btPickHandSkip"]')).not.toBeNull();
  });
  it('发现详情是独立按钮，原选择凭据及顺序不变',()=>{
    const {show}=setup();
    show('发现',battleDiscoverBodyHTML({candidates:cards.map(entry=>({card:entry.card})),cardHTML:face,action:'选择 1 张免费施放',remaining:1,pageToken:'ticket'}),'discover',snapshot);
    const picks=[...document.querySelectorAll('[data-act="btDiscover"]')];
    expect(picks).toHaveLength(3);expect(picks.map(b=>b.dataset.i)).toEqual(['0','1','2']);
    expect(picks.every(b=>b.dataset.discoverPage==='ticket')).toBe(true);
    expect(picks.every(b=>!b.querySelector('button'))).toBe(true);
    expect(document.querySelectorAll('[data-act="btDecisionInspect"]')).toHaveLength(3);
  });
  it('普通和首脑的发现牌统一进入消耗牌堆，锦囊取出保留原支付规则',()=>{
    const boss=battleDiscoverLifecycleNote({act:'play',isBoss:true});
    expect(boss).toContain('使用或消耗后进入消耗牌堆');expect(boss).toContain('不自动洗回，仅由卡牌效果取回');
    expect(boss).not.toContain('使用或消耗后进入消耗区');
    expect(battleDiscoverLifecycleNote({act:'play',isBoss:false})).toContain('未用则战后消散');
    expect(battleDiscoverLifecycleNote({act:'pouch',isBoss:true})).toContain('背包原牌随之消耗');
    expect(battleDiscoverLifecycleNote({act:'play',isBoss:true,fromDeckBottom:true})).toContain('来自当前牌库底');
  });
  it('同页更新保留中部滚动和焦点；不同页面不继承',()=>{
    const {show}=setup();
    const html=battleChoiceBodyHTML({cardName:'来源',options:['甲','乙']});
    show('抉择',html,'discover',snapshot);
    document.querySelector('.battle-decision-content').scrollTop=120;
    document.querySelector('[data-i="1"]').focus();
    show('抉择',html,'discover',snapshot);
    expect(document.querySelector('.battle-decision-content').scrollTop).toBe(120);
    expect(document.activeElement.dataset.i).toBe('1');
    show('另一页',html,'discover',snapshot);
    expect(document.querySelector('.battle-decision-content').scrollTop).toBe(0);
  });
  it('新共用壳显式解除ovBody窄上限并保持动作栏独立，卡宽不挤压成文本列表',()=>{
    const css=postcss.parse(readFileSync('game/css/battle-decision.css','utf8'));
    const rules=[];css.walkRules(r=>rules.push({selector:r.selector,decl:Object.fromEntries(r.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]))}));
    const body=rules.find(r=>r.selector.endsWith('> #ovBody'));
    expect(body.decl).toMatchObject({width:'100%','max-width':'none',overflow:'hidden','min-width':'0'});
    expect(rules.find(r=>r.selector.endsWith('.battle-decision-actions')).decl.flex).toBe('none');
    expect(rules.find(r=>r.selector.endsWith('[data-decision-kind="pile"] .battle-pile-card')).decl.width).toBe('280px');
    expect(rules.every(r=>r.selector.includes('#overlay'))).toBe(true);
  });
});
