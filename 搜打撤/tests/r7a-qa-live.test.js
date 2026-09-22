import {beforeEach,expect,it,vi} from 'vitest';
import map from '../game/data/map.json';

const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));
beforeEach(()=>{
  document.body.innerHTML=`<header><button data-sample="l2-archer-cavalry">L2</button><button data-sample="l4-fire-grass">L4</button><button id="qaEnd">结束回合</button><button id="qaReset">退出样本</button><output id="qaState"></output></header><section id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></section><div id="log"></div>`;
  localStorage.clear();localStorage.setItem('existing-player-save','KEEP');
  window.Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){}});
  window.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:()=>()=>{}});
  vi.stubGlobal('fetch',vi.fn(async()=>({json:async()=>structuredClone(map)})));
});

it('loads isolated real view, plays one card, ends and exits without storage writes',async()=>{
  const writes=vi.spyOn(Storage.prototype,'setItem');writes.mockClear();
  await import('../game/src/r7a.qa.js?live');
  document.querySelector('[data-sample="l2-archer-cavalry"]').click();await tick(40);
  expect(document.querySelector('[data-act="btBag"]')?.disabled).toBe(true);
  expect(document.querySelector('[data-act="btSettings"]')?.disabled).toBe(true);
  for(const name of ['btBag','btSettings']){const blocked=document.querySelector(`[data-act="${name}"]`);blocked.disabled=false;blocked.click();expect(document.getElementById('log').textContent).toContain('隔离验收页未接入此功能');}
  expect(document.querySelectorAll('.sts-foe')).toHaveLength(2);expect(document.querySelectorAll('.sts-hand .bt-card').length).toBeGreaterThan(0);
  const card=document.querySelector('.sts-hand .bt-card'),foe=document.querySelector('.sts-foe');card.click();foe.click();await tick(80);
  document.getElementById('qaEnd').click();await tick(1100);document.getElementById('qaReset').click();
  expect(localStorage.getItem('existing-player-save')).toBe('KEEP');expect(writes).not.toHaveBeenCalled();expect(document.getElementById('qaState').textContent).toContain('存储快照=未变化');
});
