import { afterEach, expect, it, vi } from 'vitest';
import { bindRewardFeedback, runRewardClaim } from '../game/src/hub/hub.reward-feedback.js';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
function setup(){
 let received=false,unlocked=[];
 const base={slot:1,data:{wood:2,rations:0,keys:0,stash:[]},isBackUnlocked:id=>unlocked.includes(id)};
 const meta={isClaimed:()=>received,isCollClaimed:()=>received,ACHIEVEMENTS:[{id:'a',name:'真实目标'}],COLL_MILESTONES:[{id:'c'}],collMsNeed:()=>10};
 const cards={CARD_BACKS:[{id:'snow',name:'雪原'}]};
 document.body.innerHTML='<div id="hubMain"><section class="hub-archive-v3"><main class="av12-content"><button data-act="claimAch" data-id="a">领取</button><button class="on" data-act="archiveV12Record">目标</button></main></section></div>';
 const root=document.querySelector('.hub-archive-v3'),button=root.querySelector('[data-act="claimAch"]');
 const claim=(run,extra={})=>runRewardClaim({root,base,meta,cards,action:'claimAch',id:'a',run,...extra});
 return{base,meta,cards,root,button,claim,mark:()=>{received=true;},unlock:()=>unlocked.push('snow'),panel:()=>document.querySelector('.reward-receipt')};
}
it('reports committed resource and actual randomized card deltas, then closes without another command',async()=>{
 const h=setup(),run=vi.fn(()=>{h.base.data.wood+=3;h.base.data.stash.push({card:{id:'random',name:'实际抽中的卡牌'},count:1});h.mark();return{ok:true};});
 expect(await h.claim(run)).toMatchObject({ok:true});const panel=h.panel();expect(panel.dataset.outcome).toBe('claimed');
 expect(panel.textContent).toContain('木材 ×3');expect(panel.textContent).toContain('实际抽中的卡牌 ×1');expect(panel.textContent).toContain('后勤 · 卡牌仓库');
 panel.querySelector('[data-reward-close]').click();expect(h.panel()).toBeNull();expect(run).toHaveBeenCalledOnce();
 expect(document.activeElement.dataset.act).toBe('archiveV12Record');
});
it('renders saving immediately and restores command controls only after the promise settles',async()=>{
 const h=setup();let finish;const pending=h.claim(()=>new Promise(r=>{finish=r;}));
 expect(h.panel().dataset.outcome).toBe('saving');expect(h.button.disabled).toBe(true);
 h.mark();finish({ok:true});await pending;expect(h.panel().dataset.outcome).toBe('claimed');expect(h.button.disabled).toBe(false);expect(h.button.hasAttribute('aria-busy')).toBe(false);
});
it('a committed marker survives a later notification exception',async()=>{
 const h=setup();expect(await h.claim(()=>{h.mark();throw Error('notification');})).toEqual({ok:true});expect(h.panel().dataset.outcome).toBe('claimed');
});
it('a rejected command with no committed marker reports uncertainty without inventing rewards',async()=>{
 const h=setup();expect(await h.claim(()=>Promise.reject(Error('disk')))).toMatchObject({ok:false,why:'unknown'});expect(h.panel().dataset.outcome).toBe('unknown');expect(h.panel().textContent).toContain('领取结果尚未确认');expect(h.panel().textContent).not.toContain('木材 ×');
});
it.each([['full','仓库容量不足'],['save','基地存档未保存'],['claimed','已经领取'],['unavailable','奖励内容暂不可用']])('%s failure retains its concrete reason and does not claim inventory',async(why,text)=>{
 const h=setup();await h.claim(()=>({ok:false,why}));expect(h.panel().dataset.outcome).toBe('unclaimed');expect(h.panel().textContent).toContain(text);expect(h.meta.isClaimed()).toBe(false);
 expect(!!h.panel().querySelector('[data-act="hubTab"][data-tab="upgrade"]')).toBe(why==='full');
});
it('uses a supplied failure message without copying an unrelated old log',async()=>{
 const h=setup();document.body.insertAdjacentHTML('beforeend','<p>旧错误</p>');await h.claim(()=>({ok:false,msg:'本次保存不可用'}));expect(h.panel().textContent).toContain('本次保存不可用');expect(h.panel().textContent).not.toContain('旧错误');
});
it('a slot change discards this slot receipt and restores controls',async()=>{
 const h=setup();await h.claim(()=>{h.mark();h.base.slot=2;return{ok:true};});expect(h.panel()).toBeNull();expect(h.button.disabled).toBe(false);
});
it('repaints the confirmed receipt in a new archive only through its current renderer',async()=>{
 const h=setup();await h.claim(()=>{h.mark();h.unlock();h.root.remove();return{ok:true};});expect(h.panel()).toBeNull();
 document.querySelector('#hubMain').innerHTML='<section class="hub-archive-v3"><main class="av12-content"></main></section>';
 bindRewardFeedback({root:document.querySelector('.hub-archive-v3'),base:h.base});expect(h.panel().textContent).toContain('卡背 · 雪原');
 expect(h.panel().querySelector('[data-act="hubCollectionView"]').dataset.id).toBe('snow');
});
it('Escape closes only the current receipt and respects composition and a higher zoom',async()=>{
 const h=setup();await h.claim(()=>({ok:false,why:'save'}));const event=extra=>h.panel().dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,...extra}));
 event({isComposing:true});expect(h.panel()).not.toBeNull();document.body.insertAdjacentHTML('beforeend','<section id="cardZoom"></section>');event();expect(h.panel()).not.toBeNull();document.getElementById('cardZoom').remove();event();expect(h.panel()).toBeNull();
});
it('a stale command boundary never runs a reward mutation',async()=>{
 const h=setup(),run=vi.fn();expect(await h.claim(run,{isCurrent:()=>false})).toMatchObject({ok:false,why:'stale'});expect(run).not.toHaveBeenCalled();expect(h.panel()).toBeNull();
});
