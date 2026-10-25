import {afterEach,expect,it,vi} from 'vitest';
import {openShopCommission} from '../game/src/run/shop-commission.js';

const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return{promise,resolve};};
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
function setup(save) {
  const host=document.createElement('main');host.innerHTML='<div>shop entry</div>';document.body.append(host);
  const acts={},pending={status:'applied',slots:[0,1],shopKey:'one'};
  const stock=[0,1,2].map(i=>({card:{id:`c${i}`,name:`商品${i}`},price:0,free:true}));
  const UI={el:{ovBody:host,overlay:host},showOverlay(_t,html){host.innerHTML=html;},act:(name,fn)=>acts[name]=fn,log(){}};
  const leave=vi.fn(),renderShop=vi.fn();
  openShopCommission({game:{shopStock:stock,nodeRewards:{'0,1':{commission:pending}}},UI,SDT:{Cards:{SHA:{id:'sha'}}},
    stockKey:'one',save,current:()=>true,leave,renderShop});
  const replace=()=>{host.innerHTML='<main id="replacement">new menu</main>';};
  return{host,acts,pending,leave,renderShop,replace};
}

it.each([true,false])('commission startup save=%s cannot replace a newer page',async saved=>{
  const gate=deferred(),h=setup(()=>gate.promise);h.replace();gate.resolve(saved);await flush();
  expect(document.getElementById('replacement')?.textContent).toBe('new menu');
});

it.each([true,false])('commission announcement save=%s keeps saved facts without rendering into a newer page',async saved=>{
  let saving=()=>true;const h=setup(()=>saving());await flush();
  const gate=deferred();saving=()=>gate.promise;const entering=h.acts.commissionEnterShop();
  h.replace();gate.resolve(saved);await entering;
  expect(document.getElementById('replacement')?.textContent).toBe('new menu');
  expect(h.renderShop).not.toHaveBeenCalled();expect(!!h.pending.announced).toBe(saved);
});
