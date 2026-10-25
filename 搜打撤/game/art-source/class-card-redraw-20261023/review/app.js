const $=id=>document.getElementById(id);
const labels={pending:'还没想好',keep:'可以保留',adjust:'局部调整',redesign:'重新设计'};
const preferences={nai:'NAI5 草稿',repaint:'内置重绘',combine:'结合两者',neither:'两个都需要改'};
const tagNames=['人设','构图','画风','比例','背景','细节'];
let cards=[],feedback={},active=0,filter='all',saveTimers=new Map(),saveChain=Promise.resolve(),toastTimer;
const blank=()=>({verdict:'pending',preference:'',tags:[],notes:''});
const entry=id=>feedback[id]||(feedback[id]=blank());
const reviewed=id=>{const x=entry(id);return x.verdict!=='pending'||!!x.preference||!!x.notes.trim()||x.tags.length>0;};
function message(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2200);}
function cache(){try{localStorage.setItem('career-art-review-1023',JSON.stringify(feedback));}catch{}}
function updateProgress(){const n=cards.filter(c=>reviewed(c.id)).length;$('progressText').textContent=`${n} / ${cards.length} 张已有反馈`;$('progressBar').style.width=`${n/cards.length*100}%`;}
function renderNav(){
 const list=$('cardList');list.replaceChildren();
 cards.forEach((c,i)=>{
  if(filter==='pending'&&reviewed(c.id)||filter==='noted'&&!reviewed(c.id)||filter==='redesign'&&entry(c.id).verdict!=='redesign')return;
  const b=document.createElement('button');b.className='card-link'+(i===active?' active':'');b.setAttribute('aria-label',`选择卡牌：${c.name}`);b.setAttribute('aria-current',i===active?'true':'false');
  const im=document.createElement('img');im.src=c.paint;im.alt='';im.loading='lazy';
  const txt=document.createElement('span');txt.className='card-text';const title=document.createElement('b');title.textContent=`${String(i+1).padStart(2,'0')} ${c.name}`;const sub=document.createElement('small');sub.textContent=`${c.character} · ${reviewed(c.id)?labels[entry(c.id).verdict]:'尚未评价'}`;txt.append(title,sub);
  const dot=document.createElement('i');dot.className='review-dot'+(reviewed(c.id)?' done':'');b.append(im,txt,dot);b.addEventListener('click',()=>show(i));list.append(b);
 });updateProgress();
}
function show(i){
 active=Math.max(0,Math.min(cards.length-1,i));const c=cards[active],f=entry(c.id);
 $('cardTitle').textContent=c.name;$('eyebrow').textContent=`${c.character} / ${c.career}`;$('shot').textContent=c.shot;$('position').textContent=`${String(active+1).padStart(2,'0')} / ${cards.length}`;
 $('draftImage').src=c.nai;$('draftImage').alt=`${c.name} · NAI5草稿`;$('paintImage').src=c.paint;$('paintImage').alt=`${c.name} · 内置重绘`;
 $('paintLabel').textContent=c.revision===2?'内置修订 · 第 2 版':'内置重绘 · 保留';$('previousVersion').hidden=c.revision!==2;
 $('revisionNote').textContent=c.revision===2?'已按上轮意见修订，原反馈保留，可继续补充。':'这张沿用你认可的版本。';
 $('notes').value=f.notes;$('preference').value=f.preference;
 document.querySelectorAll('[data-verdict]').forEach(b=>{const on=b.dataset.verdict===f.verdict;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
 document.querySelectorAll('[data-tag]').forEach(el=>el.checked=f.tags.includes(el.dataset.tag));
 $('previous').disabled=active===0;$('next').disabled=active===cards.length-1;
 $('saveState').className='save-state';$('saveState').textContent=f.updated_at?'已自动保存到项目':reviewed(c.id)?'已在本机恢复':'尚无反馈';renderNav();
}
function changed(field,value){const c=cards[active],x=entry(c.id);x[field]=value;cache();$('saveState').textContent='正在保存…';$('saveState').className='save-state';renderNav();if(field==='verdict')document.querySelectorAll('[data-verdict]').forEach(b=>{const on=b.dataset.verdict===value;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});clearTimeout(saveTimers.get(c.id));saveTimers.set(c.id,setTimeout(()=>save(c.id),450));}
function save(id){
 clearTimeout(saveTimers.get(id));saveTimers.delete(id);const sent={...entry(id),tags:[...entry(id).tags]};
 saveChain=saveChain.catch(()=>{}).then(async()=>{
  try{const res=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({card_id:id,...sent})});if(!res.ok)throw Error('保存失败');const r=await res.json();
   const current=entry(id);if(current.notes===sent.notes&&current.verdict===sent.verdict&&current.preference===sent.preference&&JSON.stringify(current.tags)===JSON.stringify(sent.tags)){current.updated_at=r.updated_at;cache();if(cards[active].id===id){$('saveState').className='save-state';$('saveState').textContent='✓ 已自动保存到项目';}}
  }catch{if(cards[active].id===id){$('saveState').className='save-state error';$('saveState').textContent='已暂存在浏览器，项目保存失败；请导出备份';}}
 });return saveChain;
}
async function flush(){for(const id of [...saveTimers.keys()])save(id);await saveChain;}
function cardText(c){const f=entry(c.id);return `## ${c.name}\n人物：${c.character}\n处理意见：${labels[f.verdict]}\n偏好版本：${preferences[f.preference]||'暂不选择'}\n关注：${f.tags.join('、')||'未选择'}\n\n${f.notes.trim()||'（暂无具体建议）'}\n`;}
function zoom(kind){const c=cards[active];$('largeImage').src=kind==='nai'?c.nai:kind==='previous'?c.previous:c.paint;$('largeImage').alt=`${c.name} ${kind==='nai'?'NAI5草稿':kind==='previous'?'上一版内置重绘':'内置修订'}`;$('lightboxTitle').textContent=$('largeImage').alt;$('lightbox').showModal();}
document.querySelectorAll('[data-verdict]').forEach(b=>b.addEventListener('click',()=>changed('verdict',b.dataset.verdict)));
tagNames.forEach(name=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.tag=name;input.addEventListener('change',()=>changed('tags',[...document.querySelectorAll('[data-tag]:checked')].map(x=>x.dataset.tag)));label.append(input,document.createTextNode(name));$('tags').append(label);});
$('notes').addEventListener('input',()=>changed('notes',$('notes').value));$('preference').addEventListener('change',()=>changed('preference',$('preference').value));$('filter').addEventListener('change',()=>{filter=$('filter').value;renderNav();});
$('previous').onclick=()=>show(active-1);$('next').onclick=()=>show(active+1);$('draftZoom').onclick=()=>zoom('nai');$('paintZoom').onclick=()=>zoom('paint');$('closeZoom').onclick=()=>$('lightbox').close();
 $('previousVersion').onclick=()=>zoom('previous');
$('lightbox').addEventListener('click',e=>{if(e.target===$('lightbox'))$('lightbox').close();});
$('copyCurrent').onclick=async()=>{try{await navigator.clipboard.writeText(cardText(cards[active]));message('已复制这张的反馈');}catch{message('复制不可用，可使用导出全部反馈');}};
$('export').onclick=async()=>{await flush();const body='# 职业卡重绘反馈\n\n'+cards.map(cardText).join('\n---\n\n');const url=URL.createObjectURL(new Blob(['\ufeff'+body],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='职业卡逐张反馈.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('已导出全部反馈');};
window.addEventListener('beforeunload',()=>{cache();for(const id of saveTimers.keys()){const data=JSON.stringify({card_id:id,...entry(id)});navigator.sendBeacon('/api/feedback',new Blob([data],{type:'application/json'}));}});
async function init(){try{const [a,b]=await Promise.all([fetch('/api/cards'),fetch('/api/feedback')]);if(!a.ok||!b.ok)throw Error();cards=await a.json();feedback=await b.json();try{const local=JSON.parse(localStorage.getItem('career-art-review-1023')||'{}');for(const c of cards)if(local[c.id]&&!feedback[c.id])feedback[c.id]=local[c.id];}catch{}show(0);}catch{$('cardTitle').textContent='页面暂时无法载入';$('shot').textContent='请确认本地审阅服务仍在运行，再刷新页面。';}}
init();
