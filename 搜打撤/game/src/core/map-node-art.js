import { prepareMapBrushArt } from './map-brush-art.js';
// Original painted node assets inside the current map badge and detail layout.
// Presentation only; no topology, fog, route or persistent state writes.
import { drawTacticalIcon } from './renderer.icons.js';
import { mapImageReady } from './map-image-ready.js';
const art = {
  altar: { url:new URL('../../assets/scenes/map-nodes/altar-symbol-1017-v2.webp',import.meta.url).href, bounds:[134,133,386,402] },
  blank: { url:new URL('../../assets/scenes/map-nodes/blank-symbol-foreground-1013-v1.webp',import.meta.url).href, bounds:[86,77,435,443] },
  fire: { url:new URL('../../assets/scenes/map-nodes/fire-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[82,120,428,410] },
  battle: { url:new URL('../../assets/scenes/map-nodes/battle-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[75,32,429,477] },
  shop: { url:new URL('../../assets/scenes/map-nodes/shop-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[106,69,440,478] },
  event: { url:new URL('../../assets/scenes/map-nodes/event-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[95,53,448,482] },
  door: { url:new URL('../../assets/scenes/map-nodes/passage-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[105,61,405,447] },
  chest: { url:new URL('../../assets/scenes/map-nodes/supply-symbol-foreground-1012-v5.webp',import.meta.url).href, bounds:[86,82,432,433] },
  resource: { url:new URL('../../assets/scenes/map-nodes/resource-symbol-1015-v1.webp',import.meta.url).href, bounds:[105,90,399,397] },
  // 金币节点与全局货币图标同源（gold-is7，整图 128×128）。
  coin: { url:new URL('../../assets/ui/map-hud-1015/gold-is7-v2.webp',import.meta.url).href, bounds:[0,0,128,128] },
};
const aliases={boss:'battle',elite:'battle',battleElite:'battle',entrance:'door',emergencyExit:'door',extraction:'door'};
const images = new Map();

function nodeImage(url) {
  let image = images.get(url);
  if (!image) {
    image = new Image(); image.decoding = 'async';
    image.onload = () => window.SDT?.RenderScheduler?.invalidate();
    image.src = url; images.set(url, image);
  }
  return image;
}

export function prepareMapNodeArt() {
  const urls = Object.values(art).map(entry => entry.url);
  const portrait = document.querySelector('#heroAva img, #charPanel .hero-ava img');
  const portraitUrl = portrait?.src || portrait?.currentSrc;
  if (portraitUrl) urls.push(portraitUrl);
  return Promise.all([prepareMapBrushArt(), ...urls.map(url => mapImageReady(nodeImage(url)))]);
}

export function drawMapNodeArt(ctx,type,x,y,r) {
  const entry=art[aliases[type]||type];
  if (!entry) return false;
  const image = nodeImage(entry.url);
  if (!image.complete || !image.naturalWidth) return false;
  const bounds=entry.bounds || [0,0,image.naturalWidth,image.naturalHeight];
  const scale=r*1.56/Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1]);
  ctx.drawImage(image,x-(bounds[0]+bounds[2])*scale/2,y-(bounds[1]+bounds[3])*scale/2,
    image.naturalWidth*scale,image.naturalHeight*scale);
  return true;
}


export function getMapNodeArt(type) { return art[aliases[type]||type] || null; }

// The detail icon uses the same original WebP and bounds as the map canvas.
export function mapNodeArtHTML(type,extent=58) {
  const entry=getMapNodeArt(type);
  if (!entry) return null;
  const [x0,y0,x1,y1]=entry.bounds;
  const scale=extent*.92/Math.max(x1-x0,y1-y0);
  const size=(512*scale).toFixed(3);
  const left=(extent/2-(x0+x1)*scale/2).toFixed(3);
  const top=(extent/2-(y0+y1)*scale/2).toFixed(3);
  return `<span class="ic map-node-painted${type==='blank'?' empty-node-icon':''}" style="position:relative;display:block;overflow:hidden;width:${extent}px;height:${extent}px;filter:none"><img src="${entry.url}" alt="" draggable="false" style="position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;max-width:none;max-height:none;filter:none;object-fit:fill"></span>`;
}

const nativeInk=type=>type==='altar'?'#c2b0df':['coin','wood','rations','key','resource'].includes(type)?'#e2c28b':'#b5c4c8';
const glyphImages = new Map();
export function mapNodeIconDataUrl(type) {
  // Painted types always use their original art URL, never a generated flat glyph.
  if (getMapNodeArt(type) || typeof CanvasRenderingContext2D === 'undefined') return null;
  if (glyphImages.has(type)) return glyphImages.get(type);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  if(!drawMapNativeSymbol(ctx,type,48,48,3,nativeInk(type))) drawTacticalIcon(ctx,type,48,48,2.4,nativeInk(type));
  const url=canvas.toDataURL();glyphImages.set(type,url);return url;
}

// The reference is 1280px wide. Map decoration follows the actual canvas viewport,
// which is already in UiScale's display coordinate space.
export function mapViewportScale(width) {
  return Number.isFinite(width)&&width>0 ? width/1280 : 1;
}

export function mapNodeAppearance(state) {
  return {
    current:{ink:'#caebe6',alpha:1}, selected:{ink:'#f3f6f5',alpha:1},
    legal:{ink:'#d4dfdd',alpha:.92}, route:{ink:'#cfe9e5',alpha:.88},
    visited:{ink:'#bdc9ca',alpha:.24}, known:{ink:'#bdc9ca',alpha:.38},
  }[state]||{ink:'#bdc9ca',alpha:.38};
}

// Bake the small dark support and one-sided light once per type, never a rectangular UI plate.
const nodeSupports=new Map();
function mapNodeSupport(type){
  const key=aliases[type]||type;if(nodeSupports.has(key))return nodeSupports.get(key);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const tint={fire:'208,163,91',battle:'111,138,188',shop:'92,176,167',event:'127,169,186',door:'106,173,155',chest:'116,178,193',altar:'146,123,183'}[key]||'127,162,176';
  ctx.translate(64,64);
  const glow=ctx.createRadialGradient(-16,-9,4,-8,-4,48);
  glow.addColorStop(0,`rgba(${tint},.35)`);glow.addColorStop(.55,`rgba(${tint},.12)`);glow.addColorStop(1,`rgba(${tint},0)`);
  ctx.fillStyle=glow;ctx.fillRect(-56,-56,112,112);
  const disk=ctx.createRadialGradient(-8,-10,2,0,0,34);
  disk.addColorStop(0,'#111e26ee');disk.addColorStop(.85,'#060d14eb');disk.addColorStop(1,'#07111980');
  ctx.fillStyle=disk;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=`rgba(${tint},.22)`;
  for(const [x,y,h] of [[-27,20,7],[-21,26,4],[28,12,8],[33,0,5]]){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+h);ctx.stroke();}
  nodeSupports.set(key,canvas);return canvas;
}

// 当前/可达节点的常驻辉光：径向光晕叠在暗色底座之下；pulse 为呼吸振幅（1→0 收束为静态）。
const GLOW_TINT={current:'104,230,222',legal:'187,229,187'};
function drawMapNodeGlow(ctx,type,state,time,pulse){
  const tint=GLOW_TINT[state];if(!tint)return;
  const empty=type==='blank';
  const breath=Math.sin(time*Math.PI*2/2.2+(state==='legal'?.9:0))*pulse;
  const r=(state==='current'?empty?52:76:empty?44:64)+(state==='current'?4:3)*breath;
  const a=(state==='current'?.68:.48)+(state==='current'?.12:.10)*breath;
  ctx.save();ctx.globalCompositeOperation='lighter';
  const glow=ctx.createRadialGradient(0,0,r*.18,0,0,r);
  glow.addColorStop(0,`rgba(${tint},${a.toFixed(3)})`);
  glow.addColorStop(.38,`rgba(${tint},${(a*.78).toFixed(3)})`);
  glow.addColorStop(.72,`rgba(${tint},${(a*.22).toFixed(3)})`);
  glow.addColorStop(1,`rgba(${tint},0)`);
  ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.restore();
}

const NODE_LABEL_FONT='600 18px "HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans SC Sub",sans-serif';
const NODE_STATUS_FONT='600 14px "HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans SC Sub",sans-serif';
const CONTENT_STATUS_INK={
  incomplete:{ink:'#e0e6e3',background:'#20282cf5',line:'#6c7b80'},
  pending:{ink:'#eed09a',background:'#302719f5',line:'#a47e3f'},
  completed:{ink:'#abc3b8',background:'#1a2824f5',line:'#4d6b5f'},
  'shop-open':{ink:'#9bd2bd',background:'#172d28f5',line:'#477a69'},
  'shop-closed':{ink:'#afbeb7',background:'#202824f5',line:'#52655b'},
};

// Content labels have their own opaque support. Position/reachability glow never
// changes this state colour, and faded visited artwork does not fade the words.
function drawMapContentStatus(ctx,status,top,scale) {
  if(!status?.label)return null;
  const ink=CONTENT_STATUS_INK[status.id]||CONTENT_STATUS_INK.incomplete;
  ctx.save();ctx.translate(0,top);ctx.scale(scale,scale);
  ctx.font=NODE_STATUS_FONT;ctx.textAlign='center';ctx.textBaseline='middle';
  const width=Math.ceil(ctx.measureText(status.label).width)+20,height=24;
  ctx.fillStyle=ink.background;ctx.fillRect(-width/2,0,width,height);
  ctx.strokeStyle=ink.line;ctx.lineWidth=.8;ctx.strokeRect(-width/2+.4,.4,width-.8,height-.8);
  ctx.fillStyle=ink.ink;ctx.fillText(status.label,0,height/2+.5);
  ctx.restore();
  return {left:-width*scale/2,right:width*scale/2,top,bottom:top+height*scale};
}

export function drawMapNodeBadge(ctx,type,label,state,{note=false,completed=false,showLabel=true,time=0,pulse=0,reachable=false,status=null,statusScale=1}={}) {
  const baseAlpha=ctx.globalAlpha;
  const style=mapNodeAppearance(state);ctx.globalAlpha*=style.alpha;
  const glowState=state==='current'?'current':state==='legal'||reachable?'legal':null;
  if(glowState)drawMapNodeGlow(ctx,type,glowState,time,pulse);
  const empty=type==='blank';
  if(!empty){const support=mapNodeSupport(type);if(support)ctx.drawImage(support,-64,-64,128,128);}
  if(getMapNodeArt(type)) drawMapNodeArt(ctx,type,0,0,empty?18:32);
  else if(!drawMapNativeSymbol(ctx,type,0,0,3.1,nativeInk(type))) drawTacticalIcon(ctx,type,0,0,2.8,nativeInk(type));
  let labelBounds=null;
  const labelY=empty?27:44,labelHeight=empty?18:20;
  if(showLabel){
    ctx.font=NODE_LABEL_FONT;
    ctx.textAlign='center';ctx.textBaseline='middle';
    const width=Math.ceil(ctx.measureText(label).width+12);
    labelBounds={left:-width/2,right:width/2,top:labelY,bottom:labelY+labelHeight};
    if(state==='current'){
      ctx.strokeStyle='#78c8be88';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-width/2,labelY+labelHeight+3);ctx.lineTo(width/2,labelY+labelHeight+3);ctx.stroke();
    }
    ctx.fillStyle=style.ink;
    ctx.shadowColor='#030a0e';ctx.shadowBlur=3;
    ctx.fillText(label,0,labelY+labelHeight/2);ctx.shadowBlur=0;
  }
  if(note){ctx.fillStyle='#e8bd68';ctx.fillRect(28,-26,4,4);}
  if(completed){
    ctx.save();ctx.fillStyle='#0a171c';ctx.beginPath();ctx.arc(30,27,10,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#9bbdb1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(25,27);ctx.lineTo(29,31);ctx.lineTo(35,23);ctx.stroke();ctx.restore();
  }
  ctx.globalAlpha=baseAlpha;
  const statusTop=(showLabel?labelY+labelHeight:empty?22:39)+6*statusScale;
  const statusBounds=drawMapContentStatus(ctx,status,statusTop,statusScale);
  if(!labelBounds)return statusBounds;
  if(!statusBounds)return labelBounds;
  return {left:Math.min(labelBounds.left,statusBounds.left),right:Math.max(labelBounds.right,statusBounds.right),
    top:labelBounds.top,bottom:statusBounds.bottom};
}

// 迷雾剪影徽章（2026-10-15 老板）：未揭示节点渲染为「黑色模糊+微光晕」——结构可见、
// 类型未知、不带任何图形语义（老板明确不要问号）。底座烘焙一次，避免每帧建渐变。
let fogBadge=null;
export function drawMapFogBadge(ctx) {
  if(!fogBadge){
    fogBadge=document.createElement('canvas');fogBadge.width=fogBadge.height=128;
    const b=fogBadge.getContext('2d');if(!b)return;
    b.translate(64,64);
    const halo=b.createRadialGradient(0,0,12,0,0,52);
    halo.addColorStop(0,'rgba(150,178,190,.12)');
    halo.addColorStop(.6,'rgba(150,178,190,.055)');
    halo.addColorStop(1,'rgba(150,178,190,0)');
    b.fillStyle=halo;b.beginPath();b.arc(0,0,52,0,Math.PI*2);b.fill();
    const blob=b.createRadialGradient(-6,-8,4,0,0,34);
    blob.addColorStop(0,'rgba(7,13,19,.85)');
    blob.addColorStop(.66,'rgba(7,13,19,.55)');
    blob.addColorStop(1,'rgba(7,13,19,0)');
    b.fillStyle=blob;b.beginPath();b.arc(0,0,34,0,Math.PI*2);b.fill();
  }
  ctx.drawImage(fogBadge,-64,-64,128,128);
}

export function drawMapTraveller(ctx,x,y,zoom,anchor,screenScale=1,arrived=false) {
  // Hidden HUD portraits may remain lazy. The map owns an eager image of that same URL.
  const portrait=document.querySelector('#heroAva img, #charPanel .hero-ava img');
  const url=portrait?.src||portrait?.currentSrc;
  const image = url ? nodeImage(url) : null;
  ctx.save(); ctx.translate(x,y); ctx.scale(screenScale/zoom,screenScale/zoom);
  ctx.fillStyle='#0c151bf2';ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=arrived?'#8ef1e5':'#e7eeee';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,22,0,Math.PI*2);ctx.stroke();
  if (image?.complete && image.naturalWidth) {
    ctx.save();ctx.beginPath();ctx.arc(0,0,20.5,0,Math.PI*2);ctx.clip();
    const crop=Math.min(image.naturalWidth,image.naturalHeight);
    ctx.drawImage(image,(image.naturalWidth-crop)/2,(image.naturalHeight-crop)/2,crop,crop,-21,-21,42,42);
    ctx.restore();
  }
  ctx.strokeStyle='#dfd1a4';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,22);ctx.lineTo(0,34);ctx.stroke();
  ctx.fillStyle='#ebd6a3';ctx.beginPath();ctx.moveTo(-5,30);ctx.lineTo(5,30);ctx.lineTo(0,37);ctx.fill();
  if(anchor){
    const ax=(anchor.x-x)*zoom/screenScale,ay=(anchor.y-y)*zoom/screenScale;
    ctx.strokeStyle='#e8d6a488';ctx.beginPath();ctx.moveTo(0,37);ctx.lineTo(ax,ay);ctx.stroke();
    ctx.fillStyle='#e8d6a4';ctx.beginPath();ctx.arc(ax,ay,2.3,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

export function drawMapNativeSymbol(ctx,type,x,y,u,color) {
  if (!['coin','wood','rations','key','resource','altar'].includes(type)) return false;
  ctx.save();ctx.translate(x,y);ctx.scale(u,u);ctx.strokeStyle=color;
  ctx.lineWidth=1.7;ctx.lineCap='round';ctx.lineJoin='round';
  if (type==='coin') {
    ctx.beginPath();ctx.ellipse(0,0,8,9,-.25,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(-2,-4);ctx.lineTo(3,-4);ctx.lineTo(-3,4);ctx.lineTo(2,4);ctx.stroke();
  } else if (type==='wood') {
    for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-7+i*3,6);ctx.lineTo(1+i*3,-7);ctx.lineTo(5+i*3,-5);ctx.lineTo(-3+i*3,8);ctx.closePath();ctx.stroke();}
  } else if (type==='rations') {
    ctx.strokeRect(-7,-8,14,16);ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(5,-3);ctx.moveTo(-3,2);ctx.lineTo(3,2);ctx.moveTo(-5,6);ctx.lineTo(5,6);ctx.stroke();
  } else if (type==='key') {
    ctx.strokeRect(-8,-6,16,12);ctx.strokeRect(-5,-3,4,4);
    ctx.beginPath();ctx.moveTo(2,2);ctx.lineTo(5,2);ctx.stroke();
  } else if (type==='altar') {
    ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(6,-1);ctx.lineTo(0,6);ctx.lineTo(-6,-1);ctx.closePath();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-8,10);ctx.lineTo(8,10);ctx.stroke();
  } else {
    ctx.strokeRect(-8,-7,12,12);ctx.beginPath();ctx.moveTo(8,-3);ctx.lineTo(8,9);ctx.lineTo(-4,9);ctx.stroke();
  }
  ctx.restore();return true;
}
