// Standalone ornaments over the retained full-art card. No gameplay data changes.
const tiers=[
 {name:'古朴',class:'common',tone:'#929b9f',shine:'#e3e9eb'},
 {name:'稀有',class:'rare',tone:'#509ccb',shine:'#c0e7ff'},
 {name:'史诗',class:'epic',tone:'#9e72ce',shine:'#e3caff'},
 {name:'传说',class:'legendary',tone:'#d0a13d',shine:'#ffe6a3'},
 {name:'棱彩',class:'prism',tone:'#c2b5eb',shine:'#f9e4f3'},
];
const arts=[
 {name:'青龙化身',file:'hero-warrior',cost:2,rule:'真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。',actual:'棱彩'},
 {name:'恶魔之力',file:'spell-cc-demon',cost:1,rule:'7′，损失 2 点生命。',actual:'职业'},
 {name:'霜月斩',file:'martial-tt3-frost-slash',cost:1,rule:'挥出霜月般的锋芒，撕裂敌方防线。',actual:null},
];
const schemes={
 orbit:{name:'A / 星轨',desc:'点、星、星群、日轮、双轨逐档改变形态；线纹只落在窄边和角部。',notes:['素净无纹','单星短轨','三点星群','日轮六芒','双轨棱星']},
 ink:{name:'B / 银墨',desc:'灰底宽笔块面：单笔、双笔、翼片、金色刃冠、交错棱片。以大形和断笔区分档位。',notes:['素净无纹','一笔钴蓝','双笔紫翼','暖金刃冠','交错棱片']},
 frost:{name:'C / 霜枝',desc:'从一片叶到分枝、霜羽与晶枝；减少碎线，以硬边叶片贴合原画的块面。',notes:['素净无纹','一片霜叶','三叶分枝','六叶霜羽','双枝晶簇']},
 blade:{name:'D / 刀铭',desc:'窄幅镶件随档位改变组合：单扣、双扣、刃铭、三棱镶；维持薄边框。',notes:['素净无纹','单角银扣','双角刃扣','金色刃铭','三棱镶件']},
 rose:{name:'E / 蔷薇',desc:'呼应项目黑蔷薇元素：芽、半开花、完整花章、双叶棱花；只占角部一小块。',notes:['素净无纹','单芽','半开花','完整蔷薇','双叶棱花']},
};
let chosen=0,design='ink',compare=false,compareTier=3;
let ornamentSerial=0;
const grid=document.querySelector('#cards'),dialog=document.querySelector('#detail');
const diamond=(x,y,size,cls='fill')=>`<g><path class="${cls}" d="M${x} ${y-size} ${x+size*.4} ${y-size*.4} ${x+size} ${y} ${x+size*.4} ${y+size*.4} ${x} ${y+size} ${x-size*.4} ${y+size*.4} ${x-size} ${y} ${x-size*.4} ${y-size*.4}Z"/><path class="facet-shadow" d="M${x} ${y} ${x+size} ${y} ${x+size*.4} ${y+size*.4} ${x} ${y+size}Z"/><path class="facet-light" d="M${x} ${y-size} ${x-size*.4} ${y-size*.4} ${x-size} ${y} ${x} ${y}Z"/></g>`;
function leaf(x,y,flip=false){const s=flip?-1:1;return `<path class="accent" d="m${x} ${y} ${s*10} -12 ${s*3} 8 ${-s*5} 8Z"/><path class="facet-shadow" d="m${x} ${y} ${s*10} -12 ${s*3} 8 ${-s*5} 8-2-4Z"/><path class="facet-light" d="m${x} ${y} ${s*10} -12 ${-s*3} 8Z"/><path class="engrave" d="m${x+s*2} ${y-1} ${s*5} -6"/>`;}
function paint(x,y,w,h,flip=false){const s=flip?-1:1;return `<path class="dark" d="m${x+1} ${y+1} ${s*w} -4 ${-s*4} ${h} ${-s*(w-4)} 5Z"/><path class="accent" d="m${x} ${y} ${s*w} -4 ${-s*5} 9 ${s*2} ${h-16} ${-s*(w-3)} 10 ${s*2} -8Z"/><path class="facet-shadow" d="m${x+s*w*.55} ${y+2} ${s*w*.35} -2 ${-s*3} ${h-8} ${-s*w*.3} 5Z"/><path class="ink" d="m${x+s*2} ${y+2} ${s*(w-6)} -3 ${-s*3} 4 ${-s*(w-9)} 3Z"/><path class="brush-cut" d="m${x+s*2} ${y+h*.52} ${s*w*.4} -4 ${-s*2} 4 ${-s*w*.35} 3Z"/><path class="engrave" d="m${x+s*w*.42} ${y+11} ${s*2} ${h*.32}m${-s*1} 5 ${s*1} 5"/>`;}
function topOrnament(s,i){
 let shape='';
 if(s==='orbit'){
  if(i===1)shape=`<path class="line faint" d="M94 9H137"/>${diamond(116,9,4)}`;
  if(i===2)shape=`<path class="line faint" d="M81 9H153"/>${diamond(94,9,3)}${diamond(116,12,6)}${diamond(140,9,3)}`;
  if(i===3)shape=`<path class="line" d="M68 7H94Q115 27 137 7H164"/><circle class="line faint" cx="116" cy="12" r="10"/>${diamond(116,12,7)}<path class="line" d="M116 0V3M116 23V27"/>`;
  if(i===4)shape=`<path class="line" d="M66 5Q116 34 166 5M68 14Q116-4 164 14"/>${diamond(87,11,4)}${diamond(116,16,8)}${diamond(147,11,4)}`;
 }
 if(s==='ink'){
  if(i===1)shape=`<path class="accent" d="M94 3 138 2 130 9 96 11Z"/><path class="ink" d="M96 3 132 3 126 5 99 6Z"/>`;
  if(i===2)shape=`<path class="accent" d="M82 3 116 6 108 14 85 9Z M119 6 154 3 150 10 125 15Z"/><path class="facet-shadow" d="M110 8 108 14 85 9Z M125 8 125 15 150 10Z"/>`;
  if(i===3)shape=`<path class="dark" d="M64 2 102 7 118 3 134 7 171 2 154 14 134 14 118 29 102 14 79 14Z"/><path class="accent" d="M65 2 103 7 118 3 133 7 169 2 152 12 132 12 118 27 103 12 81 12Z"/><path class="facet-light" d="M65 2 103 7 118 3 103 10 81 12Z"/><path class="facet-shadow" d="M118 8 132 12 118 27Z"/><path class="engrave" d="M95 9H105L116 19"/>`;
  if(i===4)shape=`<path class="dark" d="M66 2 95 6 116 2 139 6 167 2 145 17 123 31 108 15 86 17Z"/><path fill="#b7d6d7" d="M68 2 106 8 91 15 81 9Z"/><path fill="#d9c4e3" d="M96 5 116 2 139 6 122 28 112 10Z"/><path fill="#efdbbd" d="M130 10 165 2 147 16Z"/><path class="facet-shadow" d="M116 2 122 28 127 10Z"/><path class="ink" d="M101 6 116 2 123 4 111 7Z"/>`;
 }
 if(s==='frost'){
  const count=i===1?1:i===2?3:i===3?5:7;
  shape=`<path class="line ${i===1?'faint':''}" d="M${i===1?98:70} 8Q116 12 ${i===1?135:166} 7"/>`;
  for(let n=0;n<count;n++){const x=count===1?118:80+n*(76/(count-1));shape+=`<g transform="translate(${x} ${n%2?7:12}) rotate(${n%2?-80:80}) scale(.75)">${leaf(0,0,n%2===0)}</g>`;}
  if(i===4)shape+=`<path class="line faint" d="M80 17Q116 6 152 20"/>${diamond(116,20,5)}`;
 }
 if(s==='blade'){
  if(i===1)shape=`<path class="accent" d="M98 2H135L131 7H105L101 12H98Z"/><path class="ink" d="M100 2H131L126 4H100Z"/>`;
  if(i===2)shape=`<path class="accent" d="M84 2H112L116 7 106 12H89L84 8Z M121 7 125 2H153V8L147 12H132Z"/><path class="engrave" d="M90 6H108M132 6H147"/>`;
  if(i===3)shape=`<path class="dark" d="M66 3H102L117 0 132 3H170L154 14H131L117 28 102 14H80Z"/><path class="accent" d="M68 3H102L117 0 132 3H168L153 12H130L117 25 104 12H82Z"/><path class="facet-shadow" d="M117 0 130 12 117 25Z"/><path class="engrave" d="M83 7H104L113 12M135 7H152"/>`;
  if(i===4)shape=`<path fill="#bccedc" d="M69 2 109 7 91 18Z"/><path fill="#dec4dd" d="M102 5 118 0 139 6 120 28Z"/><path fill="#c5ddd1" d="M132 7 166 2 151 17Z"/><path class="facet-shadow" d="M118 0 120 28 128 8Z"/><path class="ink" d="M73 3 106 7 90 9Z"/>`;
 }
 if(s==='rose'){
  if(i===1)shape=`<path class="accent" d="M115 3 121 7 119 15 113 16 109 8Z"/><path class="facet-light" d="M115 3 119 7 114 10Z"/>`;
  else {const n=i===2?3:5;for(let a=0;a<n;a++)shape+=`<g transform="rotate(${a*72} 117 13)"><path class="dark" d="M117 13 111 5 114 0 121 1 125 7 121 12Z"/><path class="accent" d="M117 13 113 5 115 2 121 3 123 7 120 11Z"/><path class="facet-light" d="M115 3 120 3 122 6 116 7Z"/></g>`;shape+=`<path class="line" d="M${i===2?93:73} 7Q100 6 109 12M125 12Q140 6 ${i===2?143:164} 7"/>${diamond(117,13,3)}`;}
  if(i>=3)shape+=`<g transform="translate(90 13) rotate(-70) scale(.75)">${leaf(0,0)}</g><g transform="translate(146 13) rotate(70) scale(.75)">${leaf(0,0,true)}</g>`;
  if(i===4)shape+=`<path fill="#bcdad6" d="M101 15 107 23 110 14Z"/><path fill="#d9c2df" d="M125 14 128 24 136 17Z"/>`;
 }
 return `<g class="top-ornament">${shape}</g>`;
}
function ornament(s,i){
 if(i===0)return '';
 let main='',edge='';
 if(s==='orbit'){
  if(i===1)main=diamond(250,80,12)+`<path class="line" d="M249 96 255 122"/>`;
  if(i===2)main=`<path class="line faint" d="M247 78 231 111 257 145"/>${diamond(247,78,12)}${diamond(231,111,8)}${diamond(257,145,6)}`;
  if(i===3)main=`<g transform="translate(247 88)"><circle class="line bold" r="23"/><circle class="line faint" r="18"/>${diamond(0,0,16)}<path class="line bold" d="M0-31V-24M0 24V31M-31 0H-24M24 0H31M-22-22-17-17M17 17l5 5M-22 22-17 17M17-17l5-5"/></g><path class="line" d="M249 122 253 159"/>`;
  if(i===4)main=`<path class="line bold" d="M265 55Q208 82 237 127T270 191M270 70Q214 107 250 152"/><path class="line faint" d="M219 59Q278 90 224 148"/>${diamond(245,86,16)}${diamond(236,131,10)}${diamond(258,172,7)}`;
  if(i>=3)edge=`<path class="line" d="M-8 348Q36 375 4 415"/>${diamond(8,377,8)}`;
 }
 if(s==='ink'){
  if(i===1)main=paint(272,56,22,70,true);
  if(i===2)main=paint(272,57,26,58,true)+paint(250,82,22,64,true);
  if(i===3)main=`<path class="dark" d="m278 59-57 24 20 14-11 37 27-22 4 44 16-31Z"/><path class="accent" d="m274 57-52 24 20 9-9 35 24-20 6 45 11-32Z"/><path class="ink" d="m274 57-49 24 18-2Z"/>`;
  if(i===4)main=`<path class="dark" d="m276 50-47 17-14 62 39 39 26-57Z"/><path fill="#b7d6d7" d="m276 51-44 16 13 34 31-13-24-13Z"/><path fill="#d9c4e3" d="m233 77-20 42 27 38-7-50 20-17Z"/><path fill="#efdbbd" d="m273 114-26 29 18 43 12-27-18-14Z"/><path class="ink" d="m231 83-12 32 11-12Z"/>`;
  if(i>=2)edge=paint(2,73,15,46);
  if(i>=3)edge+=paint(0,348,18,65)+paint(274,365,17,51,true);
  if(i===3){main+=`<path class="facet-shadow" d="M248 85 233 125 257 105 263 150 262 93Z"/><path class="facet-light" d="M274 57 222 81 242 90 248 85Z"/><path class="engrave" d="M267 77 250 88 258 89M266 93 267 119"/>`;edge+=`<path class="engrave" d="M6 362 15 372 7 385M12 379 14 397"/>`;}
  if(i===4){main+=`<path class="facet-shadow" d="M276 51 245 101 252 75Z M233 77 213 119 233 107 240 157 238 119Z M273 114 247 143 259 145 265 186 263 148Z"/><path class="facet-light" d="M276 51 232 67 252 75Z M233 77 219 109 234 98Z M273 114 250 141 258 138Z"/><path class="engrave" d="M262 67 253 81M229 100 227 118M264 150 269 159"/>`;edge+=`<path class="facet-light" d="M3 363 13 373 7 382Z M7 383 17 388 10 400Z"/>`;}
 }
 if(s==='frost'){
  const bigLeaf=(x,y,flip=false)=>`<g transform="translate(${x} ${y}) scale(2)">${leaf(0,0,flip)}</g>`;
  if(i===1)main=bigLeaf(270,87,true);
  if(i===2)main=`<path class="line bold" d="M270 55Q235 95 264 149"/>${bigLeaf(256,88,true)}${bigLeaf(247,116)}${bigLeaf(265,141,true)}`;
  if(i>=3)main=`<path class="line bold" d="M270 52Q232 92 267 178"/>${bigLeaf(260,75,true)}${bigLeaf(245,102)}${bigLeaf(248,115,true)}${bigLeaf(251,135)}${bigLeaf(261,158,true)}${bigLeaf(267,176)}`;
  if(i===4)main+=`<path class="line" d="M263 78 220 121 243 182"/>${bigLeaf(234,134,true)}${diamond(236,160,9)}${diamond(268,60,7)}`;
  if(i>=3)edge=`<path class="line bold" d="M-3 347Q21 374 9 416"/>${bigLeaf(10,374)}${bigLeaf(8,399)}`;
 }
 if(s==='blade'){
  const fitting=(x,y,mirror=false)=>{const k=mirror?-1:1;return `<path class="dark" d="m${x} ${y} ${k*35} 0 0 9 ${-k*25} 0 0 44 ${-k*10} 13Z"/><path class="accent" d="m${x} ${y} ${k*35} 0 ${-k*8} 8 ${-k*18} 0 0 39 ${-k*9} 12Z"/><path class="ink" d="m${x+k*2} ${y+2} ${k*25} 0 ${-k*7} 3 ${-k*18} 0Z"/>`;};
  if(i===1)main=fitting(273,56,true);
  if(i===2)main=fitting(273,56,true)+fitting(252,80,true);
  if(i===3)main=`<path class="dark" d="m277 54-48 47 15 13 18-27 3 65 16-23Z"/><path class="accent" d="m272 53-43 44 13 11 18-26 3 61 9-18Z"/><path class="ink" d="m266 65-28 30 10-2 18-23Z"/>${diamond(255,123,7)}`;
  if(i===4)main=`<path class="dark" d="m277 50-26 8-28 47 33 74 21-54Z"/><path fill="#bccedc" d="m273 54-23 37 16 37 12-24Z"/><path fill="#dec4dd" d="m242 85-22 31 27 30 7-26Z"/><path fill="#c5ddd1" d="m264 140-21 19 22 37 12-23Z"/>`;
  if(i>=2)edge=fitting(-4,69)+fitting(-4,357);
  if(i===3)main+=`<path class="facet-shadow" d="M260 80 229 97 242 108 260 82 263 143 269 125Z"/><path class="engrave" d="M258 94 254 104 258 114M261 88 263 123"/>`;
  if(i===4)main+=`<path class="facet-shadow" d="M273 54 250 91 266 128 260 97Z M242 85 220 116 247 146 239 120Z M264 140 243 159 265 196 256 164Z"/><path class="facet-light" d="M273 54 250 91 260 88Z M242 85 220 116 232 108Z"/><path class="engrave" d="M268 81 263 93M237 106 236 119M262 159 264 173"/>`;
 }
 if(s==='rose'){
  const flower=(x,y,n)=>{let p='';for(let a=0;a<n;a++){p+=`<g transform="rotate(${a*72} ${x} ${y})"><path class="dark" d="m${x} ${y} -14-16 4-16 16-2 12 16-6 14Z"/><path class="accent" d="m${x} ${y} -12-16 4-12 12 0 10 12-6 10Z"/><path class="facet-shadow" d="m${x} ${y} 8-17-5-9 11 10-6 10Z"/><path class="ink" d="m${x-6} ${y-14} 9-8 5 4-7 5Z"/><path class="engrave" d="m${x-5} ${y-9} 3-8 5-2"/></g>`;}return p+`<path class="dark" d="m${x-8} ${y-7} 12-3 8 9-9 11-13-5Z"/><path class="fill" d="m${x-6} ${y-6} 10-2 6 8-8 8-10-4Z"/><path class="facet-shadow" d="m${x} ${y} 10 0-8 8-8-3Z"/>`;};
  if(i===1)main=`<path class="dark" d="m249 58-18 19 6 23 23-5 7-20Z"/><path class="accent" d="m249 59-14 17 6 18 18-4 5-17Z"/>`;
  if(i>=2)main=flower(250,87,i===2?3:5)+`<path class="line bold" d="M254 110 271 174"/><g transform="translate(264 145) scale(2)">${leaf(0,0,true)}</g>`;
  if(i>=3)main+=`<g transform="translate(254 125) scale(2)">${leaf(0,0)}</g>`;
  if(i===4)main+=`<path fill="#bcdad6" d="m238 120-22 9 9 23 19-16Z"/><path fill="#d9c2df" d="m262 155 20 11-7 26-18-21Z"/>`;
  if(i>=3)edge=`<path class="line bold" d="M0 350 17 420"/><g transform="translate(10 383) scale(2)">${leaf(0,0)}</g>`;
 }
 // Both clipping layers are necessary: rounded card edge, then safe information areas.
 const clip=`safe-${s}-${i}-${++ornamentSerial}`,round=`round-${clip}`;
 const pigment=`pigment-${clip}`,t=tiers[i];
 return `<div class="ornament-layer"><svg class="ornament" viewBox="0 0 272 406" style="--paint-fill:url(#${pigment})" aria-hidden="true"><defs><linearGradient id="${pigment}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.shine}"/><stop offset=".2" stop-color="${t.shine}"/><stop offset=".2" stop-color="${t.tone}"/><stop offset=".65" stop-color="${t.tone}"/><stop offset=".65" stop-color="#465165"/><stop offset="1" stop-color="#465165"/></linearGradient><clipPath id="${round}"><rect x="0" y="0" width="272" height="406" rx="9"/></clipPath><clipPath id="${clip}"><rect x="210" y="52" width="62" height="151"/><rect x="0" y="60" width="20" height="112"/><rect x="0" y="342" width="20" height="64"/><rect x="252" y="342" width="20" height="64"/><rect x="62" y="0" width="106" height="32"/></clipPath></defs><g clip-path="url(#${round})"><g clip-path="url(#${clip})">${main}${edge}${topOrnament(s,i)}</g></g></svg></div>`;
}
function jewel(i){const t=tiers[i],c=i===4?['#f6c7e9','#fff0be','#b0e6d8','#b3caf5','#c4aceb']:[t.shine,t.tone,'#293549',t.shine,t.tone];return `<svg class="gem" viewBox="0 0 18 24" aria-hidden="true"><path d="M9 1 15 5 17 12 15 19 9 23 3 19 1 12 3 5Z" fill="${c[1]}" stroke="${c[0]}"/><path d="M9 2 5 7l4 5 4-5Z" fill="${c[0]}"/><path d="m1 12 4-5 4 5-4 5Z" fill="${c[2]}"/><path d="m17 12-4-5-4 5 4 5Z" fill="${c[3]}"/><path d="m5 17 4-5 4 5-4 5Z" fill="${c[4]}"/></svg>`;}
function style(i){const t=tiers[i];return `--tone:${t.tone};--shine:${t.shine};--rim:${i===4?'linear-gradient(135deg,#f6c7e9,#f6df9d,#a3ecda,#adc9f8,#c9b6ef)':`linear-gradient(135deg,${t.shine},${t.tone} 25%,#202e39 52%,${t.tone} 75%,${t.shine})`}`;}
function card(i,s){const a=arts[chosen];return `<div class="craft-card ${tiers[i].class}" style="${style(i)}"><div class="picture"><img src="assets/cards/${a.file}.webp" alt="${a.name}原画"></div><span class="cost" aria-label="展示费用 ${a.cost}">${a.cost}</span><div class="rarity-band">${jewel(i)}<span>${tiers[i].name}</span></div><div class="first-copy"><span class="name">${a.name}</span><div class="rules">${a.rule}</div></div>${ornament(s,i)}${i>=2?'<i class="edge-sheen" aria-hidden="true"></i>':''}</div>`;}
function sample(i,s){return `<article class="tier tier-${i}" style="${style(i)}"><div class="tier-heading"><h3>${compare?schemes[s].name:tiers[i].name}</h3><span>${compare?tiers[i].name:''}</span></div><button class="card-button" data-open="${i}" data-scheme="${s}" aria-label="放大${schemes[s].name.split(' / ')[1]}${tiers[i].name}卡面">${card(i,s)}</button><p class="tier-note">${schemes[s].notes[i]}<span>${i===0?'原版素净基准':'角部 / 边沿装饰'}</span></p></article>`;}
function render(){grid.innerHTML=compare?Object.keys(schemes).map(s=>sample(compareTier,s)).join(''):tiers.map((_,i)=>sample(i,design)).join('');document.querySelector('#compare-label').hidden=!compare;document.querySelector('#scheme-title').textContent=compare?`同图同档 / ${tiers[compareTier].name} · 五种装饰`:schemes[design].name+' / 五档递进';document.querySelector('#scheme-description').textContent=compare?'比较五套稀有度装饰语言；选择标签可查看每套方案完整的五档递进。':schemes[design].desc;const a=arts[chosen];document.querySelector('#sample-note').textContent=`${a.name} · 同图档位仅作外观比较${a.actual?`，实际分类「${a.actual}」`:''}。全幅布局沿用原版，尚未接入游戏。`;document.querySelectorAll('[data-design]').forEach(b=>b.setAttribute('aria-pressed',String(!compare&&b.dataset.design===design)));document.querySelector('#compare').setAttribute('aria-pressed',String(compare));}
document.querySelectorAll('[data-design]').forEach(b=>b.addEventListener('click',()=>{design=b.dataset.design;compare=false;render();}));
document.querySelector('#compare').addEventListener('click',()=>{compare=!compare;render();});document.querySelector('#compare-tier').addEventListener('change',e=>{compareTier=Number(e.target.value);render();});document.querySelector('#art').addEventListener('change',e=>{chosen=Number(e.target.value);render();});
for(const [id,cls] of [['gray','grayscale'],['compact','compact'],['decoration','no-decoration']]){document.querySelector(`#${id}`).addEventListener('click',e=>{const active=document.body.classList.toggle(cls);e.currentTarget.setAttribute('aria-pressed',String(id==='decoration'?!active:active));if(id==='decoration')e.currentTarget.textContent=`装饰：${active?'关':'开'}`;});}
grid.addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(!b)return;const i=Number(b.dataset.open),s=b.dataset.scheme;document.querySelector('#detail-title').textContent=`${schemes[s].name} · ${tiers[i].name}`;document.querySelector('#detail-card').innerHTML=`<div class="tier-${i}">${card(i,s)}</div>`;document.querySelector('#detail-note').textContent=schemes[s].notes[i];dialog.showModal();});document.querySelector('#close').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog&&(e.offsetX<0||e.offsetY<0||e.offsetX>dialog.clientWidth||e.offsetY>dialog.clientHeight))dialog.close();});render();
