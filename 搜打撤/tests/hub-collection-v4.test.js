// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
vi.mock('../game/src/ui/inventory-zoom.js', () => ({ decorateInventoryZoom:vi.fn() }));
import { collectionCardsHTML, bindCollectionCards } from '../game/src/hub/hub.collection-v4.js';

let serial = 0, base, cards, root, ui;
beforeEach(() => {
  const catalog = [{ id:'owned',name:'已收藏招式',type:'能力卡' },{ id:'missing',name:'未收藏招式',type:'武术' },{ id:'normal',name:'已收藏普通牌',type:'武术' }];
  base = { slot:++serial,data:{collection:{owned:{name:'已收藏招式'},normal:true},stash:[{card:catalog[1],count:2}]} };
  cards = { all:()=>catalog,cardHTML:card=>`<div class="hs-card">${card.name}</div>` };
  window.SDT={Base:base};
  ui={act:vi.fn(),showCardZoom:vi.fn()};
  vi.stubGlobal('matchMedia',()=>({matches:true}));
});
afterEach(()=>{ document.body.replaceChildren();vi.unstubAllGlobals(); });
function render(){ document.body.innerHTML=`<main id="hubMain">${collectionCardsHTML(base,cards)}</main>`;root=document.getElementById('hubMain');bindCollectionCards({root,base,cards,ui});return root; }

it('shows permanent collected records only, including ordinary cards, without duplicating stash or the character pool',()=>{
  const before=JSON.stringify(base.data);render();
  expect([...root.querySelectorAll('[data-browser-key]')].map(b=>b.dataset.browserKey)).toEqual(['owned','normal']);
  expect(root.textContent).not.toContain('未收藏招式');
  expect(root.querySelector('[data-act="claimColl"]')).toBeNull();
  expect(JSON.stringify(base.data)).toBe(before);
});
it('filters existing collection and opens the exact original card from its current source',()=>{
  render();const input=root.querySelector('input');input.value='普通';input.dispatchEvent(new Event('input'));
  expect(root.querySelector('[data-browser-key="owned"]').hidden).toBe(true);
  const from=root.querySelector('[data-browser-key="normal"]');from.click();
  expect(from.getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('.collection-v12-info h3').textContent).toBe('已收藏普通牌');
  const detail=root.querySelector('[data-act="collectionV12Zoom"]');
  ui.act.mock.calls.find(([name])=>name==='collectionV12Zoom')[1]({id:detail.dataset.id});
  expect(ui.showCardZoom).toHaveBeenCalledWith(cards.all()[2],{presentation:'inventory',from:detail});
  expect(root.querySelector('[data-collection-count]').textContent).toBe('1 张已收藏');
});
it('preserves retired record identity without inventing a working card preview',()=>{
  base.data.collection.retired={name:'旧版永久收藏'};render();
  const record=root.querySelector('[data-browser-key="retired"]');
  record.click();
  expect(record.getAttribute('aria-pressed')).toBe('true');expect(record.textContent).toContain('旧版永久收藏');
  expect(root.querySelector('.collection-v12-info h3').textContent).toBe('旧版永久收藏');
  expect(root.querySelector('[data-act="collectionV12Zoom"]')).toBeNull();
  expect(root.querySelectorAll('[data-browser-key]')).toHaveLength(3);
});
it('isolates filters between saves and provides a real empty-state route to the stash',()=>{
  render();root.querySelector('input').value='找不到';root.querySelector('input').dispatchEvent(new Event('input'));
  expect(root.querySelector('.collection-empty').hidden).toBe(false);
  base.slot++;base.data.collection={};render();
  expect(root.querySelector('input').value).toBe('');
  expect(root.querySelectorAll('[data-browser-key]')).toHaveLength(0);
  expect(root.querySelector('.collection-empty [data-act="hubTab"]').dataset.tab).toBe('stash');
});
