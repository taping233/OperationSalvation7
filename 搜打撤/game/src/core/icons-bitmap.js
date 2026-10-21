import { sdtDefine } from './sdt-facade.js';
  'use strict';
import { assetUrl } from './asset-url.js';
import { esc } from './shared.js';
import { observeIconHydration } from './icon-hydration.js';

  
  const ROOT = 'assets/ui/icons/';
  const NAMES = new Set('altar heart broken coin pouch sword swords bag dice upload download book cards home fire skull gem lantern key lock unlock crystal trash door exit tools pocket broom wood bread trophy paw map notes medal shield plate blood flask scroll save helmet question sparkles bolt recycle check cross arrow play skip hourglass gear pen folder archive mouse flag slime demon runner'.split(' '));
  const missingKeys = new Set();
  function reportMissing(kind, key) {
    const label = `${kind}:${String(key || '(empty)')}`;
    if (!missingKeys.has(label)) {
      missingKeys.add(label);
      console.error(`[SDT.Icons] missing bitmap: ${label}`);
    }
  }
  // W5-08（0926）：语义别名——chart/info 尚无专属位图，映射到现有位图消灭 missing bitmap
  // 空缺（跑局数据页头/终局结算提示）；零新素材，后续专属图出图后在此改指向即可。
  const ALIAS = { chart: 'archive', info: 'scroll' };
  function safe(name) { name = ALIAS[name] || name; if (NAMES.has(name)) return name; reportMissing('icon', name); return 'question'; }
  // 金币货币图标统一使用地图资源栏同源美术（2026-10-15 老板指示），不再走 icons/coin.png。
  const COIN_ART_URL = assetUrl('assets/ui/map-hud-1015/gold-is7-v2.webp');
  const ALTAR_ART_URL = assetUrl('assets/scenes/map-nodes/altar-symbol-1017-v2.webp');
  function url(name) { return safe(name) === 'altar' ? ALTAR_ART_URL : safe(name) === 'coin' ? COIN_ART_URL : assetUrl(`${ROOT}${safe(name)}.png`); }
  function img(name, cls, alt) { const n=safe(name); if(n==='altar') return `<span class="ic${cls?' '+esc(cls):''}" role="img" aria-label="${esc(alt||'祭坛')}" data-asset-key="icon-altar" style="position:relative;display:inline-block;overflow:hidden;filter:none"><img src="${url(n)}" alt="" draggable="false" loading="eager" decoding="async" style="position:absolute;left:-37.1%;top:-39.6%;width:171.3%;height:171.3%;max-width:none;max-height:none;object-fit:fill;filter:none"></span>`; return `<img class="ic${cls?' '+esc(cls):''}" src="${url(n)}" alt="${esc(alt||n)}" data-asset-key="icon-${esc(n)}" draggable="false" loading="eager" decoding="async">`; }

  const MAP = Object.create(null);
  const add = (name, codes) => codes.forEach(code => { MAP[String.fromCodePoint(code)] = name; });
  add('heart',[0x2764,0x1f49a,0x1f497,0x1f494,0x1f496,0x1f691]); add('coin',[0x1fa99,0x1f4b0,0x1f4b8]);
  add('sword',[0x1f5e1]); add('swords',[0x2694,0x1f3f9,0x1f3af]); add('bag',[0x1f392,0x1f6d2]); add('dice',[0x1f3b2]);
  add('upload',[0x1f4e4]); add('download',[0x1f4e5]); add('book',[0x1f4da]); add('cards',[0x1f3b4,0x1f0cf]); add('home',[0x1f3e0,0x1f3d5]);
  add('fire',[0x1f525,0x1f4a5]); add('skull',[0x1f480,0x2620,0x1faa6]); add('gem',[0x1f48e]); add('lantern',[0x1f4a1]);
  add('key',[0x1f511,0x1f5dd]); add('lock',[0x1f512]); add('unlock',[0x1f513]); add('crystal',[0x1f52e,0x1f537]);
  add('trash',[0x1f5d1]); add('door',[0x1f6aa]); add('exit',[0x1f681]); add('tools',[0x1f6e0,0x1f528,0x26d3,0x1f9f0]);
  add('pocket',[0x1f9f3,0x1f45d]); add('broom',[0x1f9f9]); add('wood',[0x1fab5,0x1f33f]); add('bread',[0x1f35e]); add('trophy',[0x1f3c6]);
  add('paw',[0x1f43e,0x1f415]); add('map',[0x1f5fa]); add('notes',[0x1f4dd]); add('medal',[0x1f396,0x1f3c5]);
  add('shield',[0x1f6e1]); add('plate',[0x1faa8]); add('blood',[0x1fa78]); add('flask',[0x1f9ea,0x2697]); add('scroll',[0x1f4dc]);
  add('save',[0x1f4be]); add('helmet',[0x1f9b8]); add('question',[0x2754,0x2753,0x1f50d]); add('sparkles',[0x2728,0x1f31f,0x1f30c,0x1f4ab,0x2b50]);
  add('bolt',[0x26a1]); add('recycle',[0x267b,0x1f504,0x1f500]); add('check',[0x2714,0x2705]); add('cross',[0x2715,0x274c,0x1f6ab,0x1f910]);
  add('arrow',[0x27a1,0x1f4c8,0x1f4c9]); add('play',[0x25b6]); add('skip',[0x23ed]); add('hourglass',[0x23f3,0x231b]);
  add('gear',[0x2699,0x1f50a,0x1f4e1]); add('pen',[0x2712,0x270e]); add('folder',[0x1f4c1]); add('archive',[0x1f5c2,0x1f5c3,0x1f4e6]);
  add('mouse',[0x1f5b1]); add('flag',[0x1f3f3]); add('slime',[0x1f47e]); add('demon',[0x1f479,0x1f608,0x1f409]); add('runner',[0x1f3c3,0x1f47b,0x1f4a8]);
  add('question',[0x26a0,0x267e,0x221e,0x1f4cc]); add('crystal',[0x2744]);

  const EMOJI_RE = /(?:[\uD83C-\uDBFF][\uDC00-\uDFFF](?:\uFE0F|\u200D[\s\S])?|[\u2300-\u27BF]\x75FE0?|[\u2B00-\u2BFF]\x75FE0?)/g;
  const ICON_TOKEN_RE = /\[\[icon:[a-z-]+\]\]/;
  function hasTokens(text) {
    EMOJI_RE.lastIndex = 0;
    return EMOJI_RE.test(text) || ICON_TOKEN_RE.test(text);
  }
  function rich(html) {
    if (!html) return html;
    const source=String(html);
    if (!hasTokens(source)) return source;
    const parity=new Uint8Array(source.length+1);
    for(let i=0;i<source.length;i++) parity[i+1]=parity[i]^(source.charCodeAt(i)===34?1:0);
    const tokenRe=/\[\[icon:([a-z-]+)\]\]/g;
    let out='',last=0,match;
    while((match=tokenRe.exec(source))){out+=source.slice(last,match.index)+(parity[match.index]?'':img(match[1]));last=match.index+match[0].length;}
    const tokenized=out+source.slice(last);
    EMOJI_RE.lastIndex=0;
    if (!EMOJI_RE.test(tokenized)) return tokenized;
    const tokenParity=new Uint8Array(tokenized.length+1);
    for(let i=0;i<tokenized.length;i++)tokenParity[i+1]=tokenParity[i]^(tokenized.charCodeAt(i)===34?1:0);
    out='';last=0;EMOJI_RE.lastIndex=0;
    while((match=EMOJI_RE.exec(tokenized))){if(tokenParity[match.index])continue;const symbol=match[0].replace(/\uFE0F/g,'');out+=tokenized.slice(last,match.index)+img(MAP[symbol]||'question');last=match.index+match[0].length;}
    return out+tokenized.slice(last);
  }
  function scrubAttrs(el) {
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      if (!el?.hasAttribute?.(attr)) continue;
      const before = el.getAttribute(attr);
      if (!before.includes('[[icon:')) continue;
      const after = before.replace(/\s*\[\[icon:[a-z-]+\]\]\s*/g, ' ').trim();
      if (after !== before) el.setAttribute(attr, after);
    }
  }
  function hydrate(root) {
    if(!root||typeof document==='undefined') return;
    // 单次遍历同时检出 emoji 与 [[icon:]] 两种 token（旧实现两个 TreeWalker +
    // nodes.includes O(n²) 去重；战斗/背包整页重建时这段叠在渲染成本上）
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),nodes=[];let node;
    while((node=walker.nextNode())){if(hasTokens(node.nodeValue))nodes.push(node);}
    nodes.forEach(textNode=>{
      // 文本节点的 nodeValue 是转义前的原文，直接 innerHTML 会把它重新解析成 HTML——
      // 自定义卡名/备注里的 <img onerror=…> 会变成真实标签（09-30 深审 INFRA-01）。
      // 先 esc 再进 rich：文本段保持字面显示，图标 img 仍由本模块生成
      const span=document.createElement('span');span.innerHTML=rich(esc(textNode.nodeValue));const frag=document.createDocumentFragment();while(span.firstChild)frag.appendChild(span.firstChild);textNode.parentNode.replaceChild(frag,textNode);});
    scrubAttrs(root);
    if(root.querySelectorAll)root.querySelectorAll('[title],[placeholder],[aria-label]').forEach(scrubAttrs);
  }
  const TYPE_ART={'武术':'swords','法术':'sparkles','道具':'flask','装备':'shield','事件':'dice','能力卡':'helmet','资源':'gem'};
  if(typeof document!=='undefined'&&document.body)hydrate(document.body);
  if (typeof MutationObserver!=='undefined'&&typeof document!=='undefined'&&document.body){
    observeIconHydration(document.body, { hydrate, scrubAttrs, hasTokens });
  }
  if (typeof window !== 'undefined') window.addEventListener('error', event => {
    const target=/** @type {HTMLImageElement | null} */ (event.target);
    if(target&&target.tagName==='IMG'&&target.dataset&&target.dataset.assetKey) reportMissing('file',target.getAttribute('src'));
  }, true);
  // 图标由可见 DOM 按需加载；启动不枚举全图标目录。
  // 旧独立 iconUrls/warmAllIcons 预热链已经退役。
  export const Icons = sdtDefine('Icons', {img,url,rich,hydrate,TYPE_ART,NAMES});
