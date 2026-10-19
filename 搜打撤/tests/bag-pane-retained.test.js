import { beforeEach, expect, it } from 'vitest';
import { patchBackpackPane } from '../game/src/hub/bag-pane-view.js';
let UI;
const SDT={Icons:{rich:x=>x}};
const tile=(key,name,count=1,extra='')=>`<div class="bag-tile" data-pane-key="${key}" data-stack="${name}" data-act="inspectStack" data-name="${name}" tabindex="0" ${extra}><img src="${name}.webp"><span class="count">${count}</span></div>`;
const markup=(tiles, {zone='bag',receipt='',filter='all'}={})=>`<div class="bag-v2"><nav>${['bag','safe','pocket'].map(z=>`<button class="bag-rz${z===zone?' on':''}" data-zone="${z}" aria-pressed="${z===zone}" aria-label="${z}"><span class="bag-bdg">0</span></button>`).join('')}</nav><section class="bag-col"><header class="bag-head2">背包</header><div class="bag-tools"><button data-act="bagFilter" data-f="all" aria-pressed="${filter==='all'}">全部</button><button data-act="bagFilter" data-f="move" aria-pressed="${filter==='move'}">招式</button></div><div class="bag-board">${receipt?`<p class="bag-receipt">${receipt}</p>`:''}<div class="bag-grid" data-zone="${zone}">${tiles}</div>${tiles?'':'<p class="bag-empty2">空</p>'}</div></section></div>`;
function patch(html,zone='bag'){expect(patchBackpackPane(UI,SDT,html,zone,true)).toBe(true);}
beforeEach(()=>{document.body.innerHTML=`<div id="overlay"><div id="ovBody">${markup(tile('a','A')+tile('b','B'))}</div></div>`;UI={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')}};});
it('retains pane, board, grid and unaffected artwork on remove/reorder, preserving scroll and tile focus',()=>{
 const pane=document.querySelector('.bag-col'),board=document.querySelector('.bag-board'),grid=document.querySelector('.bag-grid'),a=grid.children[0],b=grid.children[1],art=b.firstChild;
 board.scrollTop=219;b.focus();patch(markup(tile('b','B')));
 expect(document.querySelector('.bag-col')).toBe(pane);expect(document.querySelector('.bag-board')).toBe(board);expect(document.querySelector('.bag-grid')).toBe(grid);expect(grid.children[0]).toBe(b);expect(b.firstChild).toBe(art);expect(a.isConnected).toBe(false);expect(board.scrollTop).toBe(219);expect(document.activeElement).toBe(b);
});
it('updates count, status and removed datasets while preserving unchanged face; changed UID gets a new tile',()=>{
 const a=document.querySelector('[data-stack="A"]'),art=a.firstChild;a.dataset.safe='1';a.dataset.pocket='1';
 patch(markup(tile('a','A',3,'data-state="临时"')));
 expect(document.querySelector('[data-stack="A"]')).toBe(a);expect(a.firstChild).toBe(art);expect(a.textContent).toBe('3');expect(a.dataset.safe).toBeUndefined();expect(a.dataset.pocket).toBeUndefined();expect(a.dataset.state).toBe('临时');
 patch(markup(tile('new-a','A',3)));expect(document.querySelector('[data-stack="A"]')).not.toBe(a);
});
it('same-name distinct UID keys reorder without confusing instances and changed artwork is replaced',()=>{
 patch(markup(tile('a1','A')+tile('a2','A',2)));const [a,b]=document.querySelector('.bag-grid').children;
 patch(markup(tile('a2','A',2)+tile('a1','A')));expect([...document.querySelector('.bag-grid').children]).toEqual([b,a]);
 const art=b.firstChild;patch(markup(tile('a2','A',2).replace('A.webp','new.webp')));expect(b.firstChild).not.toBe(art);
});
it('filter controls regain equivalent focus and removed tile falls back; receipts and empty state stay live',()=>{
 const filter=document.querySelector('[data-f="move"]');filter.focus();patch(markup('',{filter:'move',receipt:'成功'}));expect(document.activeElement.dataset.f).toBe('move');expect(document.querySelector('.bag-receipt').textContent).toBe('成功');expect(document.querySelector('.bag-empty2')).not.toBeNull();
 patch(markup(tile('b','B')));document.querySelector('[data-stack="B"]').focus();patch(markup(''));expect(document.activeElement.dataset.zone).toBe('bag');expect(document.querySelector('.bag-receipt')).toBeNull();
});
it('100 unchanged patches produce no mutations and never focus from elsewhere',()=>{
 document.querySelector('.bag-rz').focus();const active=document.activeElement,observer=new MutationObserver(()=>{});observer.observe(UI.el.ovBody,{subtree:true,childList:true,attributes:true,characterData:true});
 for(let i=0;i<100;i++)patch(markup(tile('a','A')+tile('b','B')));
 expect(observer.takeRecords()).toHaveLength(0);expect(document.activeElement).toBe(active);observer.disconnect();
});
it('zone changes retain existing replacement boundary and hidden/closing pages reject patching',()=>{
 const pane=document.querySelector('.bag-col');patch(markup(tile('s','S'),{zone:'safe'}),'safe');expect(document.querySelector('.bag-col')).not.toBe(pane);
 UI.el.overlay.hidden=true;expect(patchBackpackPane(UI,SDT,markup(''),'bag',true)).toBe(false);
});
it('retains card motion state on same-zone refresh while accepting new material and removing stale business state',()=>{
 const a=document.querySelector('[data-stack="A"]');a.dataset.cardStateMotion='true';a.dataset.safe='1';
 a.style.cssText='--tint:#57a8f01c;--glow:#57a8f030;transform:translateY(-6px) scale(1.02);outline-color:rgba(87,168,240,.84)';
 const transform=a.style.transform,outline=a.style.outlineColor;
 patch(markup(tile('a','A',2,'style="--tint:#b184e81c;--glow:#b184e830"')));
 expect(document.querySelector('[data-stack="A"]')).toBe(a);expect(a.dataset.cardStateMotion).toBe('true');expect(a.dataset.safe).toBeUndefined();
 expect(a.style.transform).toBe(transform);expect(a.style.outlineColor).toBe(outline);expect(a.style.getPropertyValue('--tint')).toBe('#b184e81c');expect(a.style.getPropertyValue('--glow')).toBe('#b184e830');
 delete a.dataset.cardStateMotion;patch(markup(tile('a','A',3)));expect(a.hasAttribute('style')).toBe(false);
});
