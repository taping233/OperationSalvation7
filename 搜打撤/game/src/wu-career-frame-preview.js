import '../css/wu-career-frame-preview.css';
// Independent preview section: it does not change the retained five-tier renderers or runtime frames.
const samples = [
  {name:'飞刃偷袭',file:'martial-tt7-throwblade',cost:0,rule:'造成（你的攻击力 − 3）点攻击伤害；对目标附加 1 层流血，并抽 1 张牌。'},
  {name:'金蝉脱壳',file:'martial-tt7-goldencicada',cost:0,rule:'消耗你的所有手牌，并抽 3 张牌。'},
  {name:'偷袭',file:'martial-tt7-sneak',cost:0,rule:'造成（你的攻击力 − 1）点攻击伤害。'},
];
let selected=0;
const workspace=document.querySelector('.workspace');
const panel=document.createElement('section');
panel.className='wu-preview'; panel.setAttribute('aria-label','无的职业卡边框预览');
panel.innerHTML='<header class="wu-preview-header"><div><h2>无 · 黑蔷薇职业框</h2><p>石墨护边 / 黑蔷薇 / 蓝缎带 · 第一款候选</p></div><button type="button" data-wu-back>查看原五档边框 →</button></header><div class="wu-preview-tools"><label>原画 <select aria-label="无职业框原画">'+samples.map((s,i)=>'<option value="'+i+'">'+s.name+'</option>').join('')+'</select></label><button type="button" data-wu-size aria-pressed="false">手牌尺寸</button><span class="wu-note">同图、同文案对比，点击卡牌放大。</span></div><div class="wu-comparison"></div>';
workspace.before(panel); workspace.hidden=true;
const launcher=document.createElement('button');launcher.type='button';launcher.className='wu-preview-launcher';launcher.textContent='无 · 职业框';launcher.addEventListener('click',()=>{panel.hidden=false;workspace.hidden=true;panel.scrollIntoView({block:'start'});});document.querySelector('.design-tabs').append(launcher);
const showcase=document.createElement('dialog');showcase.className='wu-preview wu-preview-dialog';showcase.setAttribute('aria-label','无职业卡边框放大');showcase.innerHTML='<button type="button" aria-label="关闭职业框放大">关闭 ×</button><div data-wu-detail></div>';document.body.append(showcase);showcase.querySelector('button').addEventListener('click',()=>showcase.close());
function card(old=false){const s=samples[selected];return '<div class="craft-card wu-card"><div class="picture"><img src="assets/cards/'+s.file+'.webp" alt="'+s.name+'原画"></div><span class="cost">'+s.cost+'</span><div class="rarity-band">职业 · 无</div><div class="first-copy"><span class="name">'+s.name+'</span><div class="rules">'+s.rule+'</div></div><div class="wu-frame'+(old?' wu-frame-old':'')+'" aria-hidden="true"><img src="css/card-frames/'+(old?'rose/class.svg':'wu-career-preview/frame.svg')+'" alt=""></div></div>';}
function render(){panel.querySelector('.wu-comparison').innerHTML=[true,false].map(old=>'<article><h3>'+(old?'现行职业框 / 对照':'无专属职业框 / 候选')+'</h3><button type="button" class="wu-sample" data-wu-old="'+old+'" aria-label="放大'+(old?'现行职业框':'无专属职业框')+'">'+card(old)+'</button><p class="wu-note">'+(old?'当前素钢职业包框。':'一朵黑蔷薇嵌在上沿；缎带绕右护角垂下，蓝星落在底部。')+'</p></article>').join('');}
panel.querySelector('select').addEventListener('change',event=>{selected=Number(event.target.value);render();});
panel.querySelector('[data-wu-back]').addEventListener('click',()=>{panel.hidden=true;workspace.hidden=false;});
panel.querySelector('[data-wu-size]').addEventListener('click',event=>{event.currentTarget.setAttribute('aria-pressed',String(panel.classList.toggle('small')));});
panel.addEventListener('click',event=>{const button=event.target.closest('[data-wu-old]');if(!button)return;showcase.querySelector('[data-wu-detail]').innerHTML='<h3>'+samples[selected].name+' · '+(button.dataset.wuOld==='true'?'现行职业框':'无专属职业框')+'</h3><div class="wu-sample">'+card(button.dataset.wuOld==='true')+'</div>';showcase.showModal();});
render();
