import { baseChibiHTML, mountBaseChibi } from '../hub/base-chibi.js';
const host = document.getElementById('hubMain');
const setup = new URL('../../assets/chibi/wu-v2/setup.webp', import.meta.url).href;
let dispose=()=>{};
function show(motion,pose=null) {
  dispose();
  for (const button of document.querySelectorAll('[data-motion]')) button.setAttribute('aria-pressed',String(button.dataset.motion===motion));
  if (motion==='setup') { host.innerHTML=`<img class="chibi-v2-reference" src="${setup}" alt="无的完整Q版原画">`; dispose=()=>{}; return; }
  host.innerHTML=baseChibiHTML({version:'v2'});
  dispose=mountBaseChibi(host,{motion:motion==='walk'&&!pose?'walk':'idle',startAt:.5,skin:'v2',rest:motion==='rebuild',pose});
  if (motion==='react') host.querySelector('.base-chibi').click();
}
for (const button of document.querySelectorAll('[data-motion]')) button.addEventListener('click',()=>show(button.dataset.motion));
for (const button of document.querySelectorAll('[data-phase]')) button.addEventListener('click',()=>{
  const phase=Number(button.dataset.phase);
  show('walk',{distance:phase*29,walk:1,time:phase,reaction:-1});
});
document.querySelector('[data-wave-pose]').addEventListener('click',()=>show('react',{distance:0,walk:0,time:0,reaction:.65}));
window.addEventListener('pagehide',()=>dispose());
show('setup');
