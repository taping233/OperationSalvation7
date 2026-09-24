
import { circle, font, hash2, mixHex, rrect, shade } from './renderer.primitives.js';
import { drawTacticalIcon } from './renderer.icons.js';
import { NODE_INFO } from '../run/expedition.view.js';
const SDT = window.SDT;
  const TAU = Math.PI * 2;
  const T0 = SDT.MAP.tile;   // 缩放基准单位（特效 / 棋子尺寸用）

  const NODE_R = 22;         // 普通战术结点半径（世界像素）
  const BOSS_R = 24;         // BOSS 结点半径
  const ALTAR_R = 24;        // 祭坛结点半径
  const LINK_GAP = 24;       // 连线两端距结点边缘的留白
  // 走过即空的节点（2026-09-13 老板留言：走过的格子一律换空白节点图标）。
  // 通路与地标是例外，永远保留原图标：层间闸门 / 紧急撤离 / 终局撤离 / 入口。
  const PERSISTENT_TYPES = new Set(['door', 'emergencyExit', 'extraction', 'entrance']);

  const COLORS = {
    bgTop: '#17252b',
    bgBottom: '#080c10',
    mixTo: '#0a1014',                     // 非当前环结点压暗的目标色
    ringLink: 'rgba(226,202,150,0.66)',   // 环内相邻结点的羊皮纸连线
  };

  // 逐帧零分配：setLineDash 只拷贝值不持有数组引用，复用同一缓冲即可
  const DASH2 = [0, 0];                  // 两段式点划（虚线流光全用这种）
  const NO_DASH = [];                    // 还原实线（空点划，常量复用）
  function setDash(c, seg1, seg2) { DASH2[0] = seg1; DASH2[1] = seg2; c.setLineDash(DASH2); }

  // 局内壁纸：L1/L2 共用静态图版（塔卫二废墟植物走廊）；L3/L4/L5 用分层专属壁纸
  // （2026-09-09 老板提供，浅色/高饱和图配更深遮罩保证结点可读）。全部首启即预载。
  const LAYER_BACKDROPS = {
    0: { src: new URL('../../assets/scenes/winter-expedition/outskirts.webp', import.meta.url).href, veil: .32 },
    1: { src: new URL('../../assets/scenes/winter-expedition/greenhouse.webp', import.meta.url).href, veil: .42 },
    2: { src: new URL('../../assets/scenes/winter-expedition/sanctuary.webp', import.meta.url).href, veil: .42 },
    3: { src: new URL('../../assets/scenes/winter-expedition/core.webp', import.meta.url).href, veil: .4 },
  };
  const layerBackdrops = {};
  for (const [li, conf] of Object.entries(LAYER_BACKDROPS)) {
    // 首启即预载（老板定向）：进层时图已解码完毕，切换壁纸无空窗
    const img = layerBackdrops[li] = new Image();
    img.decoding = 'async';
    img.onload = () => { backdropCanvas = null; SDT.RenderScheduler?.invalidate(); };
    img.src = conf.src;
  }
  function backdropFor(li) {
    const conf = LAYER_BACKDROPS[li];
    if (!conf) return { img: layerBackdrops[0], veil: .32 };
    return { img: layerBackdrops[li], veil: conf.veil };
  }
  let backdropCanvas = null;               // 壁纸合成层（尺寸/层或就绪状态变化时重建）
  const backdropKey = { w: 0, h: 0, ready: false, li: -1 };
  // 拖拽窗口防抖（迭代评审 09-20 D-P2）：拖拽时视口尺寸逐帧变化，原逻辑每帧全屏重烘焙
  // 底图（5 渐变+3 填充，10ms 级长帧连发）。尺寸连续变化期间直接复用旧底，由绘制端
  // drawImage 按目标尺寸拉伸铺满；停止 ~150ms 后置空强制重烘焙一次。
  // 壁纸 onload 置空 backdropCanvas 的强制重建路径不受影响
  let backdropResizeTimer = null;
  function drawCover(ctx, image, w, h) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale, dh = ih * scale;
    ctx.drawImage(image, (w - dw) * 0.5, (h - dh) * 0.5, dw, dh);
  }

  function ensureBackdrop(cam, li) {
    const { img, veil } = backdropFor(li);
    const ready = img.complete && img.naturalWidth > 0;
    const sizeChanged = backdropCanvas && (backdropKey.w !== cam.viewW || backdropKey.h !== cam.viewH);
    if (sizeChanged && backdropKey.li === li && backdropKey.ready === ready) {
      clearTimeout(backdropResizeTimer);
      backdropResizeTimer = setTimeout(() => { backdropCanvas = null; SDT.RenderScheduler?.invalidate(); }, 150);
      return backdropCanvas;
    }
    if (backdropCanvas && backdropKey.w === cam.viewW && backdropKey.h === cam.viewH &&
        backdropKey.ready === ready && backdropKey.li === li) return backdropCanvas;
    backdropKey.w = cam.viewW; backdropKey.h = cam.viewH; backdropKey.ready = ready; backdropKey.li = li;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cam.viewW * (window.devicePixelRatio || 1)));
    c.height = Math.max(1, Math.round(cam.viewH * (window.devicePixelRatio || 1)));
    // alpha:false：不透明烘焙层走更省显存带宽的合成路径，也规避透明纹理混合异常
    const b = c.getContext('2d', { alpha: false });
    b.scale(c.width / cam.viewW, c.height / cam.viewH);
    // 壁纸未就绪时回退纯色；就绪后整层铺底，bg 渐变按层强度遮罩保证结点可读
    b.fillStyle = '#0B0E12';
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    if (ready) drawCover(b, img, cam.viewW, cam.viewH);
    b.globalAlpha = veil;
    const bg = b.createLinearGradient(0, 0, 0, cam.viewH);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    b.fillStyle = bg;
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    // 以下两层原在 draw() 里每帧重建渐变并全屏填充（2026-09-13 性能巡检）：
    // 它们只随视口尺寸变化，与壁纸层一起烘焙进本缓存画布，视觉逐像素一致。
    b.globalAlpha = 1;
    // 暗色纱层：保留地图、节点和 HUD 的对比度，不遮掉壁纸主体
    const shade = b.createLinearGradient(0, 0, 0, cam.viewH);
    shade.addColorStop(0, 'rgba(5,14,18,0.28)');
    shade.addColorStop(0.55, 'rgba(5,14,18,0.18)');
    shade.addColorStop(1, 'rgba(2,8,11,0.40)');
    b.fillStyle = shade;
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    // 中央光晕：给壁纸中心一点冷色透气感
    const halo = b.createRadialGradient(cam.viewW * 0.5, cam.viewH * 0.46, 0,
      cam.viewW * 0.5, cam.viewH * 0.46, Math.max(cam.viewW, cam.viewH) * 0.72);
    halo.addColorStop(0, 'rgba(83,126,137,0.08)');
    halo.addColorStop(0.62, 'rgba(36,64,74,0.03)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    b.fillStyle = halo;
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    backdropCanvas = c;
    return c;
  }

  // 暗角渐变按视口尺寸缓存（原每帧 createRadialGradient，对象只随尺寸变化）
  let vignetteKey = '';
  let vignetteGrad = null;
  // 节点标签宽度缓存（measureText 结果，字体固定时只取决于文本内容）
  const labelWidthCache = new Map();


  const isCurrentNode = (game, n) => n.li === game.layerIdx && n.idx === game.trackPos;
  const nodeRadius = (n) => n.li === -1 ? (n.def.type === 'altar' ? ALTAR_R : BOSS_R) : NODE_R;



  /* ============================================================
   * 结点几何缓存（连线 Path2D 确定性生成，同输入必得同一条线）
   * ============================================================ */
  let geo = null;
  function nodeGeo(game) {
    const geometryVersion = game.geometryVersion ?? game.layoutVersion ?? game.map?.geometryVersion ?? 0;
    if (geo && geo.src === game.nodes && geo.layerIdx === game.layerIdx && geo.trackPos === game.trackPos &&
        geo.nodePos === game.nodePos && geo.layerData === game.layerData &&
        geo.geometryVersion === geometryVersion) return geo;
    // 当前层始终可见；中央祭坛/BOSS 作为终局锚点保留，便于祭坛引导线落点明确。
    // 战争迷雾（2026-09-09 老板）：只显示走过的节点（game.seen）与相邻可走节点；
    // seen 为空（旧档/基地）时保持全可见兼容。
    const seenMap = game.seen || null;
    const fogOn = !!(seenMap && Object.keys(seenMap).length);
    const seenOnLayer = (li, idx) => !fogOn || (li === game.layerIdx && seenMap[li + ',' + idx] === 1);
    const visible = game.nodes.filter(n => n.li === -1 || (n.li === game.layerIdx && seenOnLayer(n.li, n.idx)));
    const nodes = visible.map(n => ({ ...n, r: nodeRadius(n) }));
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
    const linksByLayer = game.nodePos.map(() => new Path2D());
    const legalLinks = new Path2D();
    const edgeKeys = new Set();
    const current = game.layerData[game.layerIdx]?.logical[game.trackPos];
    const currentKey = `${game.layerIdx},${game.trackPos}`;
    const legalKeys = new Set((current?.next || []).map(([li, idx]) => `${li},${idx}`));
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
      geometryVersion, nodes, legalLinks, legalKeys, linksByLayer, doorLinks, altarLinks, bounds, altarNode };
    return geo;
  }

  // 地图底盘与备注点随可见结点动态绘制，避免为整张迷雾地图创建高分辨率画布。
  // 当前位置底盘单独动态绘制，避免每走一步都重烘焙整张高分辨率棋盘。
  function drawCurrentNodePlate(ctx, game) {
    const g = nodeGeo(game);
    const n = g.nodes.find(node => isCurrentNode(game, node));
    if (!n) return;
    const layerColor = game.layerData[n.li]?.color || '#6e5133';
    const base = mixHex(layerColor, '#07131d', 0.72);
    ctx.save();
    ctx.shadowColor = 'rgba(255,205,108,0.34)';
    ctx.shadowBlur = 14 / game.cam.zoom;
    const rg = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.4, n.r * 0.18, n.x, n.y, n.r);
    rg.addColorStop(0, shade(base, 0.12));
    rg.addColorStop(1, shade(base, -0.05));
    ctx.fillStyle = rg;
    ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-n.r * .8, -n.r * .8, n.r * 1.6, n.r * 1.6);
    ctx.restore();
  }

  // ---------- 图标层（圆形位图结点：呼吸缩放；当前环明亮，可走相邻环高亮，走过的中亮，其余隐藏/虚化） ----------
  // 节点配色表提升到模块级：原来在循环体内每节点每帧重建 14 键对象（纯常数）
  const NODE_TYPE_COLORS = { battle:'#e98278', coin:'#e0c57d', wood:'#e0c57d', rations:'#e0c57d', chest:'#e0c57d', key:'#e0c57d', fire:'#76c6ad', emergencyExit:'#76c6ad', extraction:'#76c6ad', event:'#82b8d0', shop:'#82b8d0', altar:'#a995d4', boss:'#e98278', entrance:'#76c6ad' };
  function drawIcons(ctx, game) {
    const z = game.cam.zoom, g = nodeGeo(game);
    const reduced = typeof document !== 'undefined' && document.body?.classList.contains('reduce-motion');
    for (const n of g.nodes) {
      const current = isCurrentNode(game, n);
      const legal = g.legalKeys.has(`${n.li},${n.idx}`);
      const walked = !!game.visited?.[`${n.li},${n.idx}`];
      const pulse = current && !reduced ? 1 + Math.sin((game.time || 0) * 3.4) * .06 : 1;
      ctx.save();
      ctx.globalAlpha = current || legal ? 1 : .38;
      const color = current ? '#f3dfad' : NODE_TYPE_COLORS[n.def.type] || '#82b8d0';
      // 消耗过的节点（2026-09-13 留言）：踩过一次的格子内容已取走，图标换成空白节点图标
      const spent = walked && !current && !PERSISTENT_TYPES.has(n.def.type);
      ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 4); ctx.scale(pulse, pulse);
      ctx.fillStyle = '#0a1b27'; ctx.fillRect(-n.r * .78, -n.r * .78, n.r * 1.56, n.r * 1.56);
      ctx.strokeStyle = current ? '#f1d99c' : legal ? color : '#55717d'; ctx.lineWidth = (current ? 2.2 : legal ? 1.7 : 1) / z;
      ctx.strokeRect(-n.r * .78, -n.r * .78, n.r * 1.56, n.r * 1.56);
      ctx.rotate(-Math.PI / 4); ctx.scale(1 / pulse, 1 / pulse); ctx.translate(-n.x, -n.y);
      drawTacticalIcon(ctx, spent ? 'blank' : n.def.type, n.x, n.y, Math.max(.8, n.r / 12), spent ? '#7d95a0' : color);
      if (walked && !current) {
        ctx.fillStyle = '#8ec5b4';
        circle(ctx, n.x + n.r * .75, n.y - n.r * .75, 5 / z); ctx.fill();
      }
      const noteKey = game.map?.boardId + '|' + n.li + ',' + n.idx;
      if (game.noteMap?.has(noteKey)) {
        ctx.fillStyle = '#f0a832';
        ctx.shadowColor = 'rgba(240,168,50,0.6)';
        ctx.shadowBlur = 4 / z;
        circle(ctx, n.x + n.r * .78, n.y - n.r * .82, 3.2 / z); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }
  }

  // Labels stay a readable screen size at any zoom. Only known, nearby nodes are named.
  function drawNodeLabels(ctx, game) {
    const g = nodeGeo(game), z = game.cam.zoom;
    const occupied = [];
    const ordered = [...g.nodes].sort((a, b) =>
      Number(isCurrentNode(game, b)) * 2 + Number(g.legalKeys.has(`${b.li},${b.idx}`)) -
      Number(isCurrentNode(game, a)) * 2 - Number(g.legalKeys.has(`${a.li},${a.idx}`)));
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 字体固定 12px：宽度只取决于文本，按标签串缓存测量结果（省每帧 measureText）
    ctx.font = `600 12px "HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans SC Sub",sans-serif`;
    for (const n of ordered) {
      const current = isCurrentNode(game, n), legal = g.legalKeys.has(`${n.li},${n.idx}`);
      if (!current && !legal && z < .65) continue;
      const p = game.cam.worldToScreen(n.x, n.y);
      if (p.x < 20 || p.x > game.cam.viewW - 20 || p.y < 60 || p.y > game.cam.viewH - 55) continue;
      const door = game.layerData[n.li]?.doors?.some(d => d.at === n.idx);
      const name = NODE_INFO[door ? 'door' : n.def.type]?.[0] || '安全节点';
      const label = `${current ? '当前位置 · ' : ''}${name}`;
      let w = labelWidthCache.get(label);
      if (w === undefined) { w = ctx.measureText(label).width + 24; labelWidthCache.set(label, w); }
      const x = p.x - w / 2, y = p.y + n.r * z + 14;
      if (occupied.some(r => x < r.x + r.w && x + w > r.x && y < r.y + 42 && y + 42 > r.y)) continue;
      occupied.push({x,y,w});
      ctx.fillStyle = current ? '#dfc28d' : '#0a1923e8';
      rrect(ctx, x, y, w, 27, 3); ctx.fill();
      ctx.strokeStyle = current ? '#f5e2bc' : legal ? '#a49374' : '#45616e';
      ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = current ? '#122633' : '#e6eef1'; ctx.fillText(label, p.x, y + 13.5);
    }
    ctx.restore();
  }

  // ---------- 手绘连线（环内线按层合并批描：实描+点划叠加；门/祭坛线流光虚线逐帧） ----------
  function drawLinks(ctx, game) {
    const g = nodeGeo(game);
    const z = game.cam.zoom, curLi = game.layerIdx;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = COLORS.ringLink;
    for (let li = 0; li < g.linksByLayer.length; li++) {
      const path = g.linksByLayer[li];
      ctx.globalAlpha = li === curLi ? 0.20 : 0.08;
      ctx.lineWidth = 1.8 / z;
      ctx.stroke(path);
      ctx.globalAlpha = li === curLi ? 0.08 : 0.03;
      ctx.lineWidth = 2.8 / z;
      setDash(ctx, 1.5 / z, 9 / z);
      ctx.stroke(path);
      ctx.setLineDash(NO_DASH);
    }
    // 当前节点可走道路：柔光底、亮色中层、白金芯线，明确下一步可走方向。
    if (g.legalLinks) {
      const pulse = 1;
      ctx.globalAlpha = 0.42 * pulse;
      ctx.strokeStyle = 'rgba(223,194,141,0.4)';
      ctx.lineWidth = 7 / z;
      ctx.shadowColor = 'rgba(223,194,141,0.4)';
      ctx.shadowBlur = 7 / z;
      ctx.stroke(g.legalLinks);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.92 * pulse;
      ctx.strokeStyle = 'rgba(223,194,141,0.85)';
      ctx.lineWidth = 2.4 / z;
      ctx.stroke(g.legalLinks);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(244,230,199,0.7)';
      ctx.lineWidth = .8 / z;
      ctx.stroke(g.legalLinks);
    }
    // 跨层通过 door modal 处理；当前层画面不连接到隐藏层坐标，避免贯穿地图的斜线。
    // 祭坛引导线：紫色流光
    if (g.altarLinks.length) {
      ctx.strokeStyle = 'rgba(154,124,200,0.85)'; ctx.fillStyle = 'rgba(154,124,200,0.85)';
      ctx.globalAlpha = curLi === 2 ? 0.85 : 0.2;
      for (const l of g.altarLinks) { ctx.stroke(l.path); ctx.fill(l.arrow); }
    }
    ctx.setLineDash(NO_DASH);
    ctx.restore();
  }

  // ---------- 火堆结点（辉光环 + 摇曳火焰） ----------
  // ---------- 编号（当前环结点，顶部长小字） ----------
  function drawIndexes(ctx, game) {
    if (!game.toggles.index) return;
    const g = nodeGeo(game);
    ctx.font = font(game.cam, 9);
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const n of g.nodes) {
      if (n.li !== game.layerIdx || n.li < 0) continue;
      ctx.globalAlpha = isCurrentNode(game, n) ? 0.85 : 0.18;
      ctx.fillText(String(n.idx), n.x, n.y - n.r - 4);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 入口脉冲圈（底光已烘焙，此处只画脉冲环） ----------
  function drawEntrancePulse(ctx, game) {
    const cam = game.cam;
    // 只画当前层的入口（2026-09-10 留言 #21：固定取第 1 层会在其他层画出幽灵脉冲环）
    const l1 = game.layerData[game.layerIdx] || game.layerData[0];
    const layerPos = game.nodePos[game.layerIdx] || game.nodePos[0];
    const pulse = 0.5;
    ctx.save();
    ctx.strokeStyle = 'rgba(90,162,134,0.85)';
    ctx.lineWidth = 2 / cam.zoom;
    for (const idx of l1.entrances) {
      ctx.globalAlpha = idx === game.trackPos ? 1 : 0.16;
      const p = layerPos[idx];
      ctx.beginPath();
      ctx.arc(p.x, p.y, NODE_R + 4 + pulse * 5, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }


  // ---------- 当前环名胶囊标签 ----------
  // 已移除：环层名改为 DOM 固定横幅（#layerBanner），始终以固定大小显示在视口顶部居中。

  function drawHover(ctx, game) {
    if (!game.hover) return;
    const n = game.hover;
    const r = nodeRadius(n);
    ctx.save();
    circle(ctx, n.x, n.y, r + 4);
    ctx.fillStyle = 'rgba(240,210,140,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(240,210,140,0.7)';
    ctx.lineWidth = 1.5 / game.cam.zoom;
    ctx.shadowColor = 'rgba(216,180,106,0.5)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.restore();
  }

  // 选中态箭头（2026-09-09 试玩反馈）：悬停/锁定的可达节点上方画一个上下浮动的
// 金色下行箭头——「下一个就走这里」。方向感比亮环更直白（老板定向补指示）。
  function reachableSet(game) {
    const logical = game.layerData[game.layerIdx] && game.layerData[game.layerIdx].logical[game.trackPos];
    return new Set((logical && logical.next || []).map(([li, idx]) => li + ',' + idx));
  }
  function drawNodeArrow(ctx, game, p) {
    const z = game.cam.zoom;
    const bounce = 0;
    const y = p.y - nodeRadius(p) - 14 - bounce;
    ctx.save();
    ctx.translate(p.x, y);
    ctx.scale(1 / z, 1 / z);
    ctx.fillStyle = 'rgba(245,197,66,0.95)';
    ctx.shadowColor = 'rgba(216,180,106,0.7)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-9, -10);
    ctx.lineTo(9, -10);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-2.5, -20, 5, 11);
    ctx.restore();
  }
  function drawTargetArrow(ctx, game) {
    if (game.state !== 'idle') return;
    const key = reachableSet(game);
    const targets = [];
    if (game.hover) {
      const n = game.hover;
      if (key.has(n.li + ',' + n.idx)) targets.push(n);
    }
    if (game.moveTarget && game.nodePos[game.moveTarget.li]) {
      const p = game.nodePos[game.moveTarget.li][game.moveTarget.idx];
      if (p && !targets.some(n => n.li === game.moveTarget.li && n.idx === game.moveTarget.idx)) {
        targets.push({ li: game.moveTarget.li, idx: game.moveTarget.idx, x: p.x, y: p.y });
      }
    }
    for (const t of targets) drawNodeArrow(ctx, game, t);
  }

  // 移动目标结点：金色四角括号
  function drawMoveTarget(ctx, game) {
    if (game.moveTarget == null || game.state !== 'moving') return;
    const p = game.nodePos[game.moveTarget.li][game.moveTarget.idx];
    if (!p) return;
    const s = T0 * 0.38, L = T0 * 0.16, x = p.x, y = p.y;
    ctx.save();
    ctx.strokeStyle = 'rgba(245,197,66,0.9)';
    ctx.lineWidth = 2 / game.cam.zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s + L, y - s); ctx.lineTo(x - s, y - s); ctx.lineTo(x - s, y - s + L);
    ctx.moveTo(x + s - L, y - s); ctx.lineTo(x + s, y - s); ctx.lineTo(x + s, y - s + L);
    ctx.moveTo(x - s + L, y + s); ctx.lineTo(x - s, y + s); ctx.lineTo(x - s, y + s - L);
    ctx.moveTo(x + s - L, y + s); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s, y + s - L);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer(ctx, game) {
    const z = game.cam.zoom;
    const p = game.pos;
    ctx.save();
    ctx.strokeStyle = '#eee0bb'; ctx.lineWidth = 2 / z;
    const r = NODE_R + 12 / z;
    // Four compass marks identify the current position without masking its encounter icon.
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, a - .14, a + .14); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(ctx, game) {
    if (!game.nodes || !game.nodes.length) return;   // 结点布局未构建前不绘制
    const cam = game.cam;
    // 局内按层使用壁纸（L1/L2 废墟 / L3 红骑士 / L4 白机械 / L5 黑机械）；缓存按视口+层重建，
    // 暗色纱层与中央光晕已一并烘焙进该缓存画布（省每帧 2 次渐变构建+全屏填充）。
    ctx.drawImage(ensureBackdrop(cam, game.layerIdx), 0, 0, cam.viewW, cam.viewH);
    const sx = 0, sy = 0;
    ctx.save();
    ctx.translate(cam.viewW / 2 + sx, cam.viewH / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    drawCurrentNodePlate(ctx, game);
    drawLinks(ctx, game);
    drawIcons(ctx, game);
    drawIndexes(ctx, game);
    drawEntrancePulse(ctx, game);
    drawMoveTarget(ctx, game);
    drawHover(ctx, game);
    drawTargetArrow(ctx, game);
    drawPlayer(ctx, game);

    ctx.restore();

    drawNodeLabels(ctx, game);

    // 暗角：渐变对象按视口尺寸缓存（视觉不变，省每帧渐变构建）
    const vk = cam.viewW + 'x' + cam.viewH;
    if (vignetteKey !== vk || !vignetteGrad) {
      vignetteKey = vk;
      vignetteGrad = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, Math.min(cam.viewW, cam.viewH) * 0.30,
        cam.viewW / 2, cam.viewH / 2, Math.max(cam.viewW, cam.viewH) * 0.78);
      vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.36)');
    }
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

  }

  SDT.Renderer = { draw };

export { SDT };
