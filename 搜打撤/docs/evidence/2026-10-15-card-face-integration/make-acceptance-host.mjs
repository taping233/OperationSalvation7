import fs from 'node:fs';
const source = fs.readFileSync('game/index.html', 'utf8');
const samples = JSON.parse(fs.readFileSync('docs/previews/card-split-20261014/gallery-catalog.json', 'utf8'));
const toolbar = `<aside id="cardAcceptance" style="position:fixed;right:12px;top:8px;z-index:100000;display:flex;gap:5px;padding:6px;background:#101a24ee;border:1px solid #70818a;color:#d7e3e9;font:12px sans-serif"><span style="padding:5px">隔离节点验收</span>${[['battle','遭遇战'],['shop','商店'],['chest-medium','中宝箱'],['fire','火堆'],['event','事件']].map(([kind,label])=>`<button type="button" data-card-acceptance="${kind}">${label}</button>`).join('')}</aside>
<script type="module">
import '/src/main.js';
import { devJumpNode } from '/src/run/game.run.dev.js';
document.querySelectorAll('[data-card-acceptance]').forEach(button=>button.addEventListener('click',()=>devJumpNode(button.dataset.cardAcceptance)));
const samplesButton=document.createElement('button');samplesButton.textContent='全部样式';document.getElementById('cardAcceptance').append(samplesButton);
samplesButton.addEventListener('click',()=>{
  document.getElementById('cardSamples')?.remove();
  const panel=document.createElement('section');panel.id='cardSamples';panel.setAttribute('aria-label','生产卡牌接口全种类验收');
  panel.style.cssText='position:fixed;inset:50px 12px 12px;z-index:99999;overflow:auto;padding:24px 40px 60px;background:#14191f;color:#e5e8e9';
  const all=window.SDT.Cards.all();
  const groups=${JSON.stringify(samples)};
  panel.innerHTML='<button id="cardSamplesClose" style="position:sticky;top:0;z-index:20">关闭组件验收</button>'+groups.map(group=>'<h2 style="margin:28px 0 50px">'+({rarity:'品质框',career:'职业专属框',types:'卡牌类型'}[group.group])+'</h2><div style="display:grid;grid-template-columns:repeat(4,190px);justify-content:space-around;gap:85px 70px;margin-bottom:70px">'+group.cards.map(item=>{
    const original=all.find(card=>card.id===item.id)||all.find(card=>card.name===item.name);
    if(!original)throw new Error('Missing runtime representative: '+item.id);
    const card=item.frameOverride==='neutral'?{...original,cls:undefined}:original;
    return '<article style="width:190px">'+window.SDT.Cards.cardHTML(card,'sm')+'<p style="margin:44px 0 0;text-align:center;font-size:13px">'+item.caption+'</p></article>';
  }).join('')+'</div>').join('');
  document.body.append(panel);document.getElementById('cardSamplesClose').onclick=()=>panel.remove();
});
</script>`;
const page = source.replace('<head>', '<head><base href="/">').replace('src="./src/main.js"', 'src="/src/main.js"').replace('</body>', toolbar + '</body>');
fs.writeFileSync('docs/previews/card-split-20261014/runtime-acceptance.html', page);
console.log('Actual game entry/CSS with a task-only toolbar calling existing non-slot dev nodes.');
