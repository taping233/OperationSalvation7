// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindCardBrowser, cardBrowserHTML, refreshCardBrowser } from '../game/src/ui/card-browser.js';

afterEach(async () => { document.body.replaceChildren(); await Promise.resolve(); vi.unstubAllGlobals(); });
let id = 0;
function mount() {
  window.SDT = { Icons:{rich:html=>html.replace('[[icon:coin]]','<i class="coin">币</i>')} };
  document.body.innerHTML = cardBrowserHTML(`deferred-${++id}`, '卡牌', Array.from({length:20},(_,i)=>`<button data-browser-key="${i}"><span data-browser-art></span><b>卡${i}</b></button>`).join(''), {rows:1,columns:4});
  const root=document.querySelector('[data-card-browser]');
  const track=root.querySelector('.card-browser-track');
  Object.defineProperty(track,'clientWidth',{value:1000});
  const render=vi.fn(item=>`<div class="hs-card">${item.dataset.browserKey} [[icon:coin]]</div>`);
  return {root,track,render};
}

describe('deferred card browser artwork',()=>{
  it('mounts only the visible page and reuses visited card faces across pagination',()=>{
    const {root,track,render}=mount();bindCardBrowser(root,{renderArt:render});
    expect(render).toHaveBeenCalledTimes(4);expect(track.querySelectorAll('.hs-card')).toHaveLength(4);
    const first=track.querySelector('.hs-card');expect(first.querySelector('.coin')).not.toBeNull();
    root.querySelector('[data-browser-page="next"]').click();expect(render).toHaveBeenCalledTimes(8);
    root.querySelector('[data-browser-page="previous"]').click();
    expect(render).toHaveBeenCalledTimes(8);expect(track.querySelector('.hs-card')).toBe(first);
    expect(track.children).toHaveLength(20);
  });
  it('honors filters before first render, rehydrates a replacement host, and preserves focused-card paging',()=>{
    const {root,track,render}=mount();
    for(const item of track.children)item.dataset.browseFiltered=String(Number(item.dataset.browserKey)<12);
    bindCardBrowser(root,{renderArt:render});expect(render.mock.calls.map(([item])=>item.dataset.browserKey)).toEqual(['12','13','14','15']);
    track.children[12].querySelector('[data-browser-art]').replaceWith(document.createElement('span'));
    track.children[12].firstElementChild.dataset.browserArt='';refreshCardBrowser(root);
    expect(render).toHaveBeenCalledTimes(5);
    track.children[12].focus();root.querySelector('[data-browser-page="next"]').click();
    expect(document.activeElement).toBe(track.children[16]);
    expect(track.children[16].querySelector('.hs-card')).not.toBeNull();
  });
  it('does not populate removed pages or retain an old renderer through position history',()=>{
    const {root,render}=mount();bindCardBrowser(root,{renderArt:render});root.remove();refreshCardBrowser(root);expect(render).toHaveBeenCalledTimes(4);
    document.body.append(root.cloneNode(true));const replacement=document.body.firstElementChild;
    replacement.querySelectorAll('[data-browser-art]').forEach(host=>host.replaceChildren());
    const next=vi.fn(()=>'<span class="new-art">new</span>');bindCardBrowser(replacement,{renderArt:next});
    expect(next).toHaveBeenCalledTimes(4);expect(render).toHaveBeenCalledTimes(4);
  });
  it('retries absent art without marking it rendered and responds to page size changes',()=>{
    const {root,track}=mount();let available=false;
    const render=vi.fn(()=>available?'<i class="ready"></i>':null);bindCardBrowser(root,{renderArt:render});expect(track.querySelector('.ready')).toBeNull();
    available=true;refreshCardBrowser(root);expect(track.querySelectorAll('.ready')).toHaveLength(4);
    root.dataset.browserColumns='6';refreshCardBrowser(root);expect(track.querySelectorAll('.ready')).toHaveLength(6);
  });
  it('keeps the old page, controls and focus usable after a renderer throws, then retries the same page',()=>{
    const {root,track}=mount();let fail=true;const opened=vi.fn();
    const render=vi.fn(item=>{
      if(fail&&item.dataset.browserKey==='5')throw new Error('broken card renderer');
      return `<div class="hs-card">${item.dataset.browserKey}</div>`;
    });
    bindCardBrowser(root,{renderArt:render,onOpen:opened});
    const first=track.children[0];first.focus();const oldArt=first.querySelector('.hs-card');
    const shown=()=>[...track.children].filter(item=>!item.hidden).map(item=>item.dataset.browserKey);
    expect(()=>refreshCardBrowser(root,{page:1})).toThrow('broken card renderer');
    expect(shown()).toEqual(['0','1','2','3']);
    expect(root.querySelector('.card-browser-position').textContent).toBe('1 / 5');
    expect(root.querySelector('[data-browser-page="previous"]').disabled).toBe(true);
    expect(document.activeElement).toBe(first);expect(first.querySelector('.hs-card')).toBe(oldArt);
    expect(track.children[4].querySelector('.hs-card')).toBeNull();
    first.click();expect(opened).toHaveBeenCalledWith('0',first);
    fail=false;root.querySelector('[data-browser-page="next"]').click();
    expect(shown()).toEqual(['4','5','6','7']);expect(document.activeElement).toBe(track.children[4]);
    expect(root.querySelector('.card-browser-position').textContent).toBe('2 / 5');
    root.querySelector('[data-browser-page="previous"]').click();
    expect(first.querySelector('.hs-card')).toBe(oldArt);
  });

});
