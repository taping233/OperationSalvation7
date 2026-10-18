import { getQualityPreset } from './performance-settings.js';
import { drawMapBrushRoad, mapBrushRoadInView } from './map-brush-art.js';

import { font, hash2 } from './renderer.primitives.js';
import { revealProgress } from './map-reveals.js';
import { ease } from './motion-primitives.js';
import { renderScheduler } from './render-scheduler.js';
import { mapNodeInfo } from './node-info.js';
import { isConsumedMapNode, mapNodeStatus } from './map-node-state.js';
import { createMapCityAtmosphere } from './map-city-atmosphere.js';
import { drawMapNodeBadge, drawMapFogBadge, drawMapTraveller, mapViewportScale, prepareMapNodeArt } from './map-node-art.js';
import { noteGlowPulse, glowPulse } from './map-node-glow.js';
import { entrySupplyGate } from '../run/node-reward-state.js';
import { mapImageReady } from './map-image-ready.js';
import { getExpeditionPreview, findMapTravelPath, getMapTravelPresentation, mapTravelCurve, mapTravelPoint } from '../run/expedition.view.js';
const SDT = window.SDT;

  const NODE_R = 22;         // 普通战术结点半径（世界像素）
  const BOSS_R = 24;         // BOSS 结点半径
  const ALTAR_R = 24;        // 祭坛结点半径
  const LINK_GAP = 24;       // 连线两端距结点边缘的留白


  let rendererDisposed = false;
  const mapAtmosphere = new Image();
  mapAtmosphere.decoding='async';
  mapAtmosphere.onload=()=>{if(rendererDisposed)return;backdropCanvas=null;SDT.RenderScheduler?.invalidate();};
  mapAtmosphere.src=new URL('../../assets/scenes/map-nodes/map-atmosphere-is7-1012.webp',import.meta.url).href;
  function backdropFor(){return {img:mapAtmosphere};}
  let backdropCanvas = null;               // 壁纸合成层（尺寸/层或就绪状态变化时重建）
  const drawMapCityAtmosphere = createMapCityAtmosphere(() => {
    if (rendererDisposed) return;
    backdropCanvas = null;
    renderScheduler.invalidate();
  });
  const backdropKey = { w: 0, h: 0, dpr: 0, ready: false, li: -1 };
  // 换层溶解状态：snap=旧层烘焙画布引用（重建不销毁旧对象，直接留用），t0=起播时刻
  const backdropFade = { snap: null, t0: 0 };
  const BACKDROP_FADE_MS = 480;
  let backdropFadeDriving = false, backdropFadeFrame = 0;
  function driveBackdropFade() {
    if (rendererDisposed || backdropFadeDriving || typeof requestAnimationFrame !== 'function') return;
    backdropFadeDriving = true;
    const tick = (now) => {
      backdropFadeFrame = 0;
      if (rendererDisposed) return;
      if (backdropFade.snap && now - backdropFade.t0 < BACKDROP_FADE_MS + 60) {
        renderScheduler.invalidateAnimation();
        backdropFadeFrame = requestAnimationFrame(tick);
      } else {
        backdropFadeDriving = false;
        renderScheduler.invalidate();
      }
    };
    backdropFadeFrame = requestAnimationFrame(tick);
  }
  // 拖拽窗口防抖（迭代评审 09-20 D-P2）：拖拽时视口尺寸逐帧变化，原逻辑每帧全屏重烘焙
  // 底图（5 渐变+3 填充，10ms 级长帧连发）。尺寸连续变化期间直接复用旧底，由绘制端
  // drawImage 按目标尺寸拉伸铺满；停止 ~150ms 后置空强制重烘焙一次。
  // 壁纸 onload 置空 backdropCanvas 的强制重建路径不受影响
  let backdropResizeTimer = null, backdropResizeKey = null;
  function clearBackdropResize() {
    clearTimeout(backdropResizeTimer);
    backdropResizeTimer = null;
    backdropResizeKey = null;
  }
  function ensureBackdrop(cam, li) {
    const { img } = backdropFor(li);
    const ready = img.complete && img.naturalWidth > 0;
    const dpr = Math.min(window.devicePixelRatio || 1, getQualityPreset().backdropScale);
    const sizeChanged = backdropCanvas && (backdropKey.w !== cam.viewW || backdropKey.h !== cam.viewH);
    if (sizeChanged && backdropKey.li === li && backdropKey.ready === ready && backdropKey.dpr === dpr) {
      const resizeKey = `${cam.viewW}x${cam.viewH}`;
      // Only new target dimensions restart debounce; ongoing draws must not postpone it.
      if (backdropResizeKey !== resizeKey) {
        clearBackdropResize();
        backdropResizeKey = resizeKey;
        backdropResizeTimer = setTimeout(() => {
          clearBackdropResize(); backdropCanvas = null; SDT.RenderScheduler?.invalidate();
        }, 150);
      }
      return backdropCanvas;
    }
    clearBackdropResize();
    if (backdropCanvas && backdropKey.w === cam.viewW && backdropKey.h === cam.viewH &&
        backdropKey.ready === ready && backdropKey.li === li && backdropKey.dpr === dpr) return backdropCanvas;
    // 换层交叉溶解（2026-09-27 二轮动效）：层变化重建前把旧壁纸快照留下，draw 里叠画淡出——
    // 原为逐层硬切（全游戏最大的场景切换零过渡）。减动效直接切。
    if (backdropCanvas && backdropKey.ready && backdropKey.li !== li &&
        !(typeof document !== 'undefined' && document.body?.classList.contains('reduce-motion'))) {
      backdropFade.snap = backdropCanvas;
      backdropFade.t0 = performance.now();
      driveBackdropFade();
    }
    backdropKey.w = cam.viewW; backdropKey.h = cam.viewH; backdropKey.ready = ready; backdropKey.li = li; backdropKey.dpr = dpr;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cam.viewW * dpr));
    c.height = Math.max(1, Math.round(cam.viewH * dpr));
    // alpha:false：不透明烘焙层走更省显存带宽的合成路径，也规避透明纹理混合异常
    const b = c.getContext('2d', { alpha: false });
    b.scale(c.width / cam.viewW, c.height / cam.viewH);
    // Structural backdrop and independent winter light layers; retain cache/transition lifecycle.
    b.fillStyle = '#06080a';
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    if(ready){
      const scale=Math.max(cam.viewW/img.naturalWidth,cam.viewH/img.naturalHeight);
      const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
      b.filter='grayscale(.9) brightness(.34) contrast(1.14)';
      b.drawImage(img,(cam.viewW-dw)/2,(cam.viewH-dh)/2,dw,dh);b.filter='none';
    }
    drawMapCityAtmosphere(b, cam.viewW, cam.viewH);
    b.fillStyle='rgba(1,10,17,.25)';b.fillRect(0,0,cam.viewW,cam.viewH);
    const cold=b.createRadialGradient(cam.viewW*.22,cam.viewH*.20,0,cam.viewW*.22,cam.viewH*.20,cam.viewW*.62);
    cold.addColorStop(0,'rgba(34,71,97,.20)');cold.addColorStop(1,'rgba(9,20,30,0)');
    b.fillStyle=cold;b.fillRect(0,0,cam.viewW,cam.viewH);
    // Quiet winter scenery supports the routes; no separate beams or node-coloured particles.
    b.globalAlpha=1;
    backdropCanvas = c;
    return c;
  }

  // 暗角渐变按视口尺寸缓存（原每帧 createRadialGradient，对象只随尺寸变化）
  let vignetteKey = '';
  let vignetteGrad = null;
  const mapRoadCache = new WeakMap();
  const renderedLabelBounds = new Map();
  let labelBoundsGame = null, labelBoundsNodes = null, labelBoundsLayer = null;

  // The input layer combines these real painted text bounds with its icon hit radius.
  // Only bounds from the current revealed layer are exposed, never fog silhouettes.
  function nodeLabelBounds(game,node) {
    if(labelBoundsGame!==game||labelBoundsNodes!==game.nodes||labelBoundsLayer!==game.layerIdx||node.li!==game.layerIdx)return null;
    const key=`${node.li},${node.idx}`;
    if(Object.keys(game.seen||{}).length&&game.seen[key]!==1)return null;
    return renderedLabelBounds.get(key)||null;
  }


  const isCurrentNode = (game, n) => n.li === game.layerIdx && n.idx === game.trackPos;
  const nodeRadius = (n) => n.li === -1 ? (n.def.type === 'altar' ? ALTAR_R : BOSS_R) : NODE_R;



  /* ============================================================
   * 结点几何缓存（连线 Path2D 确定性生成，同输入必得同一条线）
   * ============================================================ */
  let geo = null;
  // 辉光呼吸窗口触发器：当前/可达集合变化时重开窗口（见 map-node-glow.js 的零绘制口径）
  let lastGlowSig = '';
  function nodeGeo(game) {
    const geometryVersion = game.geometryVersion ?? game.layoutVersion ?? game.map?.geometryVersion ?? 0;
    // 入城闸门参与缓存键：领完补给解锁时，可达集合/可达边立即重算（辉光同步亮起）。
    const entryGate = entrySupplyGate(game);
    if (geo && geo.src === game.nodes && geo.layerIdx === game.layerIdx && geo.trackPos === game.trackPos &&
        geo.nodePos === game.nodePos && geo.layerData === game.layerData &&
        geo.geometryVersion === geometryVersion && geo.entryGate === entryGate &&
        geo.seenCount === (game.seen ? Object.keys(game.seen).length : 0)) return geo;
    // 当前层始终可见；中央祭坛/BOSS 作为终局锚点保留，便于祭坛引导线落点明确。
    // 战争迷雾（2026-09-09 老板）：只显示走过的节点（game.seen）与相邻可走节点；
    // seen 为空（旧档/基地）时保持全可见兼容。
    // 迷雾剪影（2026-10-15 老板修订）：未揭示节点改为「黑色模糊+微光晕」渲染——结构可见、
    // 类型未知、不带图形语义。剪影仅进渲染层，命中检测（pickNode 的 seen 过滤）与 run 域揭示逻辑不变。
    const seenMap = game.seen || null;
    const fogOn = !!(seenMap && Object.keys(seenMap).length);
    const seenOnLayer = (li, idx) => !fogOn || (li === game.layerIdx && seenMap[li + ',' + idx] === 1);
    const visible = game.nodes.filter(n => n.li === -1 || (n.li === game.layerIdx && seenOnLayer(n.li, n.idx)));
    const nodes = visible.map(n => ({ ...n, r: nodeRadius(n) }));
    const fogNodes = fogOn ? game.nodes
      .filter(n => n.li === game.layerIdx && !seenOnLayer(n.li, n.idx))
      .map(n => ({ ...n, r: nodeRadius(n), fog: true })) : [];
    const byKey = new Map(nodes.map(n => [`${n.li},${n.idx}`, n]));

    // 轻微确定性弯曲，避免分支边重合；端点由调用方按节点半径裁剪。
    const hand = (a, b, seed) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = (hash2(seed, 7) - 0.5) * 2 * Math.min(18, len * 0.08);
      const mx = (a.x + b.x) / 2 - dy / len * off;
      const my = (a.y + b.y) / 2 + dx / len * off;
      const p = new Path2D();
      p.moveTo(a.x, a.y);
      p.quadraticCurveTo(mx, my, b.x, b.y);
      return p;
    };
    // 两端按实际节点半径裁剪，避免道路穿入图标。
    const trim = (from, to, gap) => {
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const t = gap / len;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
    };
    const trimNodes = (from, to) => {
      const a = trim(from, to, (from.r || nodeRadius(from)) + 8);
      const b = trim(to, from, (to.r || nodeRadius(to)) + 8);
      return [a, b];
    };
    const arrowAt = (from, to) => {
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const arr = new Path2D();
      arr.moveTo(to.x, to.y);
      arr.lineTo(to.x - 7 * Math.cos(ang - 0.5), to.y - 7 * Math.sin(ang - 0.5));
      arr.lineTo(to.x - 7 * Math.cos(ang + 0.5), to.y - 7 * Math.sin(ang + 0.5));
      arr.closePath();
      return arr;
    };

    // 当前层道路按真实 next 去重；同时保留分组，供可达边/悬停边单独强调。
    const fogRoads = [];
    const linksByLayer = game.nodePos.map(() => new Path2D());
    const legalLinks = new Path2D();
    const edgeKeys = new Set();
    const current = game.layerData[game.layerIdx]?.logical[game.trackPos];
    const currentKey = `${game.layerIdx},${game.trackPos}`;
    // 闸门激活时无可达节点：不亮可达辉光、不描可达边，与点击/移动判定同源。
    const legalKeys = new Set(entryGate ? [] : (current?.next || []).map(([li, idx]) => `${li},${idx}`));
    game.layerData.forEach((ld, li) => {
      if (li !== game.layerIdx) return;
      ld.logical.forEach((cell, i) => {
        const p = game.nodePos[li][i];
        for (const [toLi, toIdx] of (cell.next || [])) {
          const q = game.nodePos[toLi][toIdx];
          if (!q) continue;
          // 迷雾：两端都走过的边才绘制（fog 关闭时 seenOnLayer 恒真）
          if (!seenOnLayer(li, i) || !seenOnLayer(toLi, toIdx)) continue;
          const aKey = `${li},${i}`, bKey = `${toLi},${toIdx}`;
          const edgeKey = [aKey, bKey].sort().join('|');
          if (edgeKeys.has(edgeKey)) continue;
          edgeKeys.add(edgeKey);
          const from = byKey.get(aKey) || { ...p, r: nodeRadius({ li, def: cell.def }) };
          const to = byKey.get(bKey) || { ...q, r: nodeRadius({ li: toLi, def: game.layerData[toLi]?.logical[toIdx]?.def || {} }) };
          const [a, b] = trimNodes(from, to);
          const path = hand(a, b, li * 57 + i * 13 + toLi * 3 + toIdx);
          const legal = (aKey === currentKey && legalKeys.has(bKey)) ||
            (bKey === currentKey && legalKeys.has(aKey));
          if (toLi === li) {
            linksByLayer[li].addPath(path);
            if (legal) legalLinks.addPath(path);
          }
        }
      });
    });
    // 未探明结构边：至少一端未揭示的同层边走极淡虚线，只表达「此处有路」，
    // 不参与可达/规划高亮（drawLinks 里真实道路只画两端已知边）。
    if (fogNodes.length) {
      const knownKeys = new Set(nodes.map(n => `${n.li},${n.idx}`));
      const stub = (li, idx) => {
        const p = game.nodePos[li]?.[idx];
        if (!p) return null;
        return { ...p, r: nodeRadius({ li, def: game.layerData[li]?.logical[idx]?.def || {} }) };
      };
      const fogEdgeKeys = new Set();
      game.layerData.forEach((ld, li) => {
        if (li !== game.layerIdx) return;
        ld.logical.forEach((cell, i) => {
          for (const [toLi, toIdx] of (cell.next || [])) {
            if (toLi !== li) continue;
            const aKey = `${li},${i}`, bKey = `${toLi},${toIdx}`;
            const edgeKey = [aKey, bKey].sort().join('|');
            if (edgeKeys.has(edgeKey) || fogEdgeKeys.has(edgeKey)) continue;
            if (knownKeys.has(aKey) && knownKeys.has(bKey)) continue;
            fogEdgeKeys.add(edgeKey);
            const a = stub(li, i), b = stub(toLi, toIdx);
            if (!a || !b) continue;
            const [pa, pb] = trimNodes(a, b);
            fogRoads.push({edgeKey, section:mapTravelCurve(pa,pb)});
          }
        });
      });
    }
    const doorLinks = [];
    // 跨层出口不在当前层地图内绘制；玩家点击当前层的出口节点后切换地图。
    // 祭坛引导线（紫，第三环入口 → 中央祭坛）
    const altarNode = nodes.find(n => n.li === -1 && n.def.type === 'altar');
    const altarLinks = [];
    const ld3 = game.layerData.find(ld => (ld.altarEntrances || []).length);
    if (ld3 && altarNode) {
      for (const ae of (ld3.altarEntrances || [])) {
        const altarLi = game.layerData.indexOf(ld3);
        const p = game.nodePos[altarLi][ae.at];
        altarLinks.push({ path: hand(trim(p, altarNode, LINK_GAP), trim(altarNode, p, LINK_GAP), 700 + ae.at * 11),
          arrow: arrowAt(p, altarNode) });
      }
    }
    // 各环包围盒（环名标签摆放用）
    const bounds = game.nodePos.map(arr => {
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (const p of arr) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      return { minX, maxX, minY, maxY };
    });
    geo = { src: game.nodes, layerIdx: game.layerIdx, trackPos: game.trackPos, nodePos: game.nodePos, layerData: game.layerData,
      geometryVersion, entryGate, seenCount: game.seen ? Object.keys(game.seen).length : 0,
      nodes, fogNodes, fogRoads, legalLinks, legalKeys, linksByLayer, doorLinks, altarLinks, bounds, altarNode };
    return geo;
  }

  function selectedMapPath(game){
    const travel=getMapTravelPresentation(game);
    if(travel?.path?.length)return travel.path;
    const target=getExpeditionPreview(game)||game.moveTarget;
    if(!target)return [];
    const route=findMapTravelPath(game,target);
    return route?.length?[{li:game.layerIdx,idx:game.trackPos},...route]:[];
  }
  const mapKey=n=>`${n.li},${n.idx}`;
  const mapEdgeKey=(a,b)=>[mapKey(a),mapKey(b)].sort().join('|');

  // Artwork and type names remain small relative to the complete viewport.
  function drawIcons(ctx,game,g,statuses,path){
    const z=game.cam.zoom,unit=mapViewportScale(game.cam.viewW);
    renderedLabelBounds.clear();labelBoundsGame=game;labelBoundsNodes=game.nodes;labelBoundsLayer=game.layerIdx;
    const travel=getMapTravelPresentation(game);
    const preview=travel?.path?.at(-1)||getExpeditionPreview(game)||game.moveTarget;
    const onPath=new Set(path.map(mapKey));
    const reduced=SDT.Motion?.reduceMotion?.()||false;
    const glowSig=`${game.layerIdx},${game.trackPos}:${[...g.legalKeys].join(';')}`;
    // 呼吸窗口只在活跃对局的站立态武装：被动重绘（resize 重烘焙/测试极简 mock）不触发，
    // 也不占用渲染调度器的定时器口径（renderer-resource-lifecycle 断言空闲零计时器）。
    if(glowSig!==lastGlowSig&&(game.runActive&&game.state==='idle')){lastGlowSig=glowSig;noteGlowPulse(game.time||0);}
    // 迷雾剪影先画：叠在手绘路径上、真实节点之下；不可交互、无标签、不泄露类型。
    for(const n of g.fogNodes){
      const screen=game.cam.worldToScreen(n.x,n.y);
      if(screen.y<58*unit||screen.y>game.cam.viewH-105*unit)continue;
      const scale=unit*Math.min(1,Math.max(.35,z*.8))/z;
      ctx.save();ctx.translate(n.x,n.y);ctx.scale(scale,scale);
      drawMapFogBadge(ctx);
      ctx.restore();
    }
    for(const n of g.nodes){
      const key=mapKey(n),current=isCurrentNode(game,n),legal=g.legalKeys.has(key);
      const selected=preview?.li===n.li&&preview?.idx===n.idx;
      const routed=onPath.has(key),primary=current||selected||legal||routed;
      const screen=game.cam.worldToScreen(n.x,n.y);
      if(!primary&&(screen.y<58*unit||screen.y>game.cam.viewH-105*unit))continue;
      const door=game.doorKeys?.has(key)||game.layerData[n.li]?.doors?.some(d=>d.at===n.idx);
      const supply=game.entrySupply;
      const entryPending=supply?.layerIdx===n.li&&supply.trackPos===n.idx&&(supply.taken?.length||0)<(supply.cardIds?.length||0);
      const completed=isConsumedMapNode(game,n);
      const status=statuses.get(key);
      const type=entryPending?'event':door?'door':n.def.type;
      const name=entryPending?'入城补给':mapNodeInfo(game,n,status)[0];
      const state=current?'current':selected?'selected':routed?'route':legal?'legal':game.visited?.[key]?'visited':'known';
      const rv=reduced?1:revealProgress(key,game.time||0);
      const detailScale=primary?Math.min(1,Math.max(.65,z)):Math.min(1,Math.max(.25,z*.65));
      const scale=unit*detailScale*(rv<1?.75+.25*rv:1)/z;
      ctx.save();ctx.translate(n.x,n.y);ctx.scale(scale,scale);ctx.globalAlpha=rv<1?Math.min(1,rv*1.4):1;
      const labelBounds=drawMapNodeBadge(ctx,type,name,state,{
        completed,reachable:legal,
        status,statusScale:1/detailScale,
        note:game.noteMap?.has(`${game.map?.boardId}|${key}`),
        showLabel:current||selected||(type!=='blank'&&!routed&&(legal?z>=.65:z>=.85)),
        time:game.time||0,pulse:glowPulse(game.time||0),
      });
      ctx.restore();
      if(labelBounds)renderedLabelBounds.set(key,{left:n.x+labelBounds.left*scale,right:n.x+labelBounds.right*scale,
        top:n.y+labelBounds.top*scale,bottom:n.y+labelBounds.bottom*scale});
    }
  }

  const lerpPoint=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function splitMapCurve(c,t){
    const a=lerpPoint(c.from,c.c1,t),b=lerpPoint(c.c1,c.c2,t),d=lerpPoint(c.c2,c.to,t);
    const e=lerpPoint(a,b,t),f=lerpPoint(b,d,t),p=lerpPoint(e,f,t);
    return [{from:c.from,c1:a,c2:e,to:p},{from:p,c1:f,c2:d,to:c.to}];
  }
  function mapCurveSection(c,start,end){
    const left=splitMapCurve(c,end)[0];
    return start>0?splitMapCurve(left,start/end)[1]:left;
  }
  function mapCurvePath(c){
    const p=new Path2D();p.moveTo(c.from.x,c.from.y);p.bezierCurveTo(c.c1.x,c.c1.y,c.c2.x,c.c2.y,c.to.x,c.to.y);return p;
  }
  function clippedMapRoad(from,to,game,unit,statuses){
    const z=game.cam.zoom,len=Math.hypot(to.x-from.x,to.y-from.y);
    if(len<1)return null;
    const selected=getExpeditionPreview(game)||game.moveTarget;
    const pad=n=>{
      const marked=isCurrentNode(game,n)||(selected?.li===n.li&&selected?.idx===n.idx);
      const supply=game.entrySupply;
      const pending=supply?.layerIdx===n.li&&supply.trackPos===n.idx&&(supply.taken?.length||0)<(supply.cardIds?.length||0);
      const hasStatus=!!statuses.get(mapKey(n)).label;
      if(!pending&&!hasStatus&&(n.def?.type==='blank'||isConsumedMapNode(game,n)))return {x:24*unit/z,top:24*unit/z,bottom:(marked?52:24)*unit/z};
      return {x:(marked?60:56)*unit/z,top:56*unit/z,bottom:(hasStatus?100:78)*unit/z};
    };
    const outside=(p,n,box)=>Math.abs(p.x-n.x)>Math.min(box.x,len*.32)||p.y-n.y < -Math.min(box.top,len*.32)||p.y-n.y > Math.min(box.bottom,len*.32);
    const exit=(origin,target)=>{
      let low=0,high=.49;const box=pad(origin);
      for(let i=0;i<12;i++){const mid=(low+high)/2;if(outside(mapTravelPoint(origin,target,mid),origin,box))high=mid;else low=mid;}
      return high;
    };
    const start=exit(from,to),end=1-exit(to,from);
    const curve=mapTravelCurve(from,to),section=mapCurveSection(curve,start,end);
    return {curve,start,end,section,path:mapCurvePath(section)};
  }

  function drawLinks(ctx,game,g,statuses,path){
    const z=game.cam.zoom,unit=mapViewportScale(game.cam.viewW),curLi=game.layerIdx;
    const view={left:game.cam.cx-game.cam.viewW/(2*z),right:game.cam.cx+game.cam.viewW/(2*z),
      top:game.cam.cy-game.cam.viewH/(2*z),bottom:game.cam.cy+game.cam.viewH/(2*z)};
    const preview=getExpeditionPreview(game)||game.moveTarget;
    const selectedKey=preview?mapKey(preview):'';
    const contentKey=`${Object.keys(game.visited||{}).length}:${game.entrySupply?.taken?.length||0}:${!!game.altarActivated}:${!!game.altarRewardPending}:${g.nodes.map(n=>`${mapKey(n)}:${statuses.get(mapKey(n)).id}`).join(';')}`;
    let cached=mapRoadCache.get(g);
    if(!cached){
      const roads=[],known=new Map(g.nodes.map(n=>[mapKey(n),n])),done=new Set();
      for(const n of g.nodes){
        if(n.li!==curLi)continue;
        for(const [li,idx] of game.layerData[n.li]?.logical[n.idx]?.next||[]){
          const q=known.get(`${li},${idx}`);if(!q||li!==curLi)continue;
          const edgeKey=mapEdgeKey(n,q);if(done.has(edgeKey))continue;done.add(edgeKey);
          if(Math.hypot(q.x-n.x,q.y-n.y)<1)continue;
          const fromKey=mapKey(n),toKey=mapKey(q),currentKey=`${game.layerIdx},${game.trackPos}`;
          const legal=(fromKey===currentKey&&g.legalKeys.has(toKey))||(toKey===currentKey&&g.legalKeys.has(fromKey));
          roads.push({curve:mapTravelCurve(n,q),from:n,to:q,edgeKey,fromKey,toKey,legal,paint:null});
        }
      }
      cached={roads};mapRoadCache.set(g,cached);
    }
    const planned=new Map();
    for(let i=1;i<path.length;i++)planned.set(mapEdgeKey(path[i-1],path[i]),mapKey(path[i-1]));
    const travel=getMapTravelPresentation(game),moving=travel?.phase==='moving';
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    for (const road of g.fogRoads) drawMapBrushRoad(ctx,road,unit/z,{alpha:.12,view});
    for(const descriptor of cached.roads){
      if(!mapBrushRoadInView(descriptor.curve,unit/z,view))continue;
      // Keep one paint object/canvas per edge across zoom and content changes.
      // Offscreen edges catch up lazily when panned back into the viewport.
      if(!descriptor.paint||descriptor.zoom!==z||descriptor.viewW!==game.cam.viewW
          ||descriptor.selectedKey!==selectedKey||descriptor.contentKey!==contentKey){
        descriptor.paint=Object.assign(descriptor.paint||{},clippedMapRoad(descriptor.from,descriptor.to,game,unit,statuses),
          {edgeKey:descriptor.edgeKey,fromKey:descriptor.fromKey,toKey:descriptor.toKey,legal:descriptor.legal});
        Object.assign(descriptor,{zoom:z,viewW:game.cam.viewW,selectedKey,contentKey});
      }
      const road=descriptor.paint;
      const chosen=planned.has(road.edgeKey),legal=road.legal;
      const color=chosen?'#79c9c4':legal?'#c7d1ca':'#b9c8c2';
      drawMapBrushRoad(ctx,road,unit/z,{alpha:chosen?(moving?.45:.95):legal?.8:.45});
      if(chosen||road.legal){
        const forward=chosen?planned.get(road.edgeKey)===road.fromKey:road.fromKey===`${game.layerIdx},${game.trackPos}`;
        const c=road.section,tip=forward?c.to:c.from,control=forward?c.c2:c.c1;
        ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(Math.atan2(tip.y-control.y,tip.x-control.x));ctx.scale(unit/z,unit/z);
        ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-15,-4.4);ctx.lineTo(-11,0);ctx.lineTo(-15,4.4);ctx.closePath();ctx.fill();ctx.restore();
      }
    }
    if(travel?.path?.length){
      for(let i=1;i<travel.path.length;i++){
        if(i>travel.segmentIndex)break;
        const a=travel.path[i-1],b=travel.path[i];if(a.li!==curLi||b.li!==curLi)continue;
        const road=cached.roads.find(r=>r.edgeKey===mapEdgeKey(a,b))?.paint;if(!road)continue;
        const progress=i<travel.segmentIndex?1:Math.max(0,Math.min(1,travel.progress));
        const forward=mapKey(a)===road.fromKey;
        const start=forward?road.start:Math.max(road.start,1-progress),end=forward?Math.min(road.end,progress):road.end;
        if(end<=start)continue;
        ctx.globalAlpha=.88;ctx.strokeStyle='#9bdad0';ctx.lineWidth=3*unit/z;
        ctx.stroke(mapCurvePath(mapCurveSection(road.curve,start,end)));
      }
    }
    // Preserve the original altar guidance; it never creates a legal route.
    if(g.altarLinks.length){
      ctx.strokeStyle='rgba(154,124,200,.8)';ctx.fillStyle='rgba(154,124,200,.8)';ctx.globalAlpha=curLi===2?.75:.16;
      ctx.lineWidth=2*unit/z;for(const l of g.altarLinks){ctx.stroke(l.path);ctx.fill(l.arrow);}
    }
    ctx.restore();
  }

  // ---------- 火堆结点（辉光环 + 摇曳火焰） ----------
  // ---------- 编号（当前环结点，顶部长小字） ----------
  function drawIndexes(ctx, game, g) {
    if (!game.toggles.index) return;
    ctx.font = font(game.cam, 9);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const n of g.nodes) {
      if (n.li !== game.layerIdx || n.li < 0 || n.fog) continue;
      ctx.globalAlpha = isCurrentNode(game, n) ? 0.85 : 0.18;
      ctx.fillText(String(n.idx + 1), n.x, n.y - n.r - 4);
    }
    ctx.globalAlpha = 1;
  }

  // The confirmed old portrait and pointer identify the real position at rest and in motion.
  function drawPlayer(ctx,game,g){
    const n=g.nodes.find(n=>isCurrentNode(game,n));
    const p=game.pos||(n&&{x:n.x,y:n.y});if(!p)return;
    const z=game.cam.zoom,unit=mapViewportScale(game.cam.viewW),travel=getMapTravelPresentation(game);
    drawMapTraveller(ctx,p.x+44*unit/z,p.y-38*unit/z,z,
      {x:p.x+28*unit/z,y:p.y+4*unit/z},unit,travel?.phase==='arrived');
  }

  function draw(ctx, game) {
    if (rendererDisposed || !game.nodes || !game.nodes.length) return;   // 结点布局未构建前不绘制
    const cam = game.cam;
    // The environment remains readable beneath routes and is cached by viewport/layer.
    ctx.drawImage(ensureBackdrop(cam, game.layerIdx), 0, 0, cam.viewW, cam.viewH);
    // 换层溶解：旧层壁纸叠在新层上淡出（snap 画布同视口尺寸，直接铺）
    if (backdropFade.snap) {
      const u = Math.min(1, (performance.now() - backdropFade.t0) / BACKDROP_FADE_MS);
      if (u >= 1) backdropFade.snap = null;
      else {
        ctx.globalAlpha = 1 - ease.smoother(u);
        ctx.drawImage(backdropFade.snap, 0, 0, cam.viewW, cam.viewH);
        ctx.globalAlpha = 1;
      }
    }
    const sx = 0, sy = 0;
    ctx.save();
    ctx.translate(cam.viewW / 2 + sx, cam.viewH / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    // Projection lives for one draw only: in-place reward edits are visible on
    // the next frame, while labels, clipping and badges share this frame's work.
    const g=nodeGeo(game),statuses=new Map(g.nodes.map(n=>[mapKey(n),mapNodeStatus(game,n)]));
    const path=selectedMapPath(game);
    drawLinks(ctx, game, g, statuses, path);
    drawIcons(ctx, game, g, statuses, path);
    drawPlayer(ctx, game, g);
    drawIndexes(ctx, game, g);

    ctx.restore();


    // 暗角：渐变对象按视口尺寸缓存（视觉不变，省每帧渐变构建）
    const vk = cam.viewW + 'x' + cam.viewH;
    if (vignetteKey !== vk || !vignetteGrad) {
      vignetteKey = vk;
      vignetteGrad = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, Math.min(cam.viewW, cam.viewH) * 0.30,
        cam.viewW / 2, cam.viewH / 2, Math.max(cam.viewW, cam.viewH) * 0.78);
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(1, 'rgba(4,20,29,0.18)');
    }
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

  }

  function dispose() {
    rendererDisposed = true;
    clearBackdropResize();
    if (backdropFadeFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(backdropFadeFrame);
    backdropFadeFrame = 0; backdropFadeDriving = false;
    backdropCanvas = null; backdropFade.snap = null;
    geo = null; vignetteGrad = null;
    renderedLabelBounds.clear();labelBoundsGame=null;labelBoundsNodes=null;labelBoundsLayer=null;
    mapAtmosphere.onload = null;
  }

  function warm() {
    return Promise.all([mapImageReady(mapAtmosphere), drawMapCityAtmosphere.ready(), prepareMapNodeArt()]);
  }

  async function prepare(game, isCurrent = () => true) {
    await warm();
    if (rendererDisposed || !isCurrent()) return false;
    // 续局初帧不复用上一局的壁纸/尺寸防抖，也不播旧层交叉溶解。
    clearBackdropResize();
    if (backdropFadeFrame) cancelAnimationFrame(backdropFadeFrame);
    backdropFadeFrame = 0; backdropFadeDriving = false;
    backdropCanvas = null; backdropFade.snap = null;
    const canvas = document.getElementById('game');
    const ctx = canvas?.getContext('2d');
    if (!ctx || !game.cam || !game.nodes?.length) return false;
    draw(ctx, game);
    return true;
  }

  SDT.Renderer = { draw, dispose, warm, prepare, nodeLabelBounds };
  if (import.meta.hot) import.meta.hot.dispose(dispose);
