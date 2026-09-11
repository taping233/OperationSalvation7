
import { circle, font, hash2, mixHex, rrect, shade } from './renderer.primitives.js';
import { drawFlame, drawIcon, drawBitmapIcon } from './renderer.icons.js';
const SDT = window.SDT;
  const TAU = Math.PI * 2;
  const T0 = SDT.MAP.tile;   // 缩放基准单位（特效 / 棋子尺寸用）

  const NODE_R = 26;         // 普通结点半径（世界像素）
  const BOSS_R = 30;         // BOSS 结点半径
  const ALTAR_R = 32;        // 祭坛结点半径
  const LINK_GAP = 34;       // 连线两端距结点边缘的留白

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
  const environmentBackdrop = new Image();
  const LAYER_BACKDROPS = {
    2: { src: new URL('../assets/scenes/layer3-knight.webp', import.meta.url).href, veil: 0.62 },   // 冻土遗迹 · 红骑士
    3: { src: new URL('../assets/scenes/layer4-priestess-light.webp', import.meta.url).href, veil: 0.8 },  // 高危战区 · 白（浅底必须压暗）
    4: { src: new URL('../assets/scenes/layer5-priestess-dark.webp', import.meta.url).href, veil: 0.5 },   // 污染核心 · 黑
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
    if (!conf) return { img: environmentBackdrop, veil: 0.5 };
    return { img: layerBackdrops[li], veil: conf.veil };
  }
  let backdropCanvas = null;               // 壁纸合成层（尺寸/层或就绪状态变化时重建）
  const backdropKey = { w: 0, h: 0, ready: false, li: -1 };
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
    backdropCanvas = c;
    return c;
  }
  environmentBackdrop.src = new URL('../assets/scenes/endfield-ruins.jpg', import.meta.url).href;
  environmentBackdrop.addEventListener('load', () => { backdropCanvas = null; SDT.RenderScheduler?.invalidate(); });


  const isCurLayer = (game, li) => li === game.layerIdx;
  const isCurrentNode = (game, n) => n.li === game.layerIdx && n.idx === game.trackPos;
  const nodeRadius = (n) => n.li === -1 ? (n.def.type === 'altar' ? ALTAR_R : BOSS_R) : NODE_R;


  // 重要结点的微光环绕色
  const GLISTEN = {
    altar: 'rgba(154,124,200,0.9)', boss: 'rgba(255,110,90,0.85)',
    door: 'rgba(225,192,120,0.85)', emergencyExit: 'rgba(82,210,115,0.85)',
    entrance: 'rgba(82,210,115,0.85)',
  };

  // 呼吸相位（确定性，结点各自错拍）
  const nodePhase = (n) => hash2(n.li * 31 + n.idx, 9) * TAU;

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

  /* ============================================================
   * 静态烘焙缓存（模块级，按失效键惰性重建）
   * ============================================================ */
  let skyCanvas = null;                 // 冷色环境层（低分辨率，一次烘焙）
  const SKY_SPAN = { x0: 0, y0: 0, w: 0, h: 0 };
  let stars = null, motes = null;       // 扫描点 / 微尘粒子（预计算）
  let boardCanvas = null;               // 结点静态层
  const BOARD_PAD = T0 * 1.5;           // 画布外扩（容纳投影 / 底光溢出）
  const boardKey = { layerIdx: -1, notes: null, bs: 0 };
  let gradCache = null;                 // { w, h, bg, vig } 屏幕空间渐变

  const bakeScale = () => Math.min(4, Math.max(2, (window.devicePixelRatio || 1) * 2));

  // ---------- 烘焙：冷峻环境信息层（雾化底光） ----------
  function ensureSky(map) {
    if (skyCanvas) return;
    const T = map.tile, W = map.cols * T, H = map.rows * T;
    const SIZE = 512, span = 2.6;
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const b = c.getContext('2d');
    SKY_SPAN.x0 = -0.8 * W; SKY_SPAN.y0 = -0.8 * H;
    SKY_SPAN.w = W * span; SKY_SPAN.h = H * span;
    b.scale(SIZE / SKY_SPAN.w, SIZE / SKY_SPAN.h);
    b.translate(-SKY_SPAN.x0, -SKY_SPAN.y0);
    // 远景尘雾固定在世界坐标，使用冷灰与冷青层次。
    const blobs = [
      [W * 0.18, H * 0.06, Math.max(W, H) * 0.46, '92,185,188', 0.065],
      [W * 0.95, H * 0.45, Math.max(W, H) * 0.40, '81,111,128', 0.08],
      [W * 0.38, H * 1.02, Math.max(W, H) * 0.44, '73,111,139', 0.045],
      [W * 0.85, H * 1.35, Math.max(W, H) * 0.36, '92,185,188', 0.04],
    ];
    for (const [x, y, r, rgb, a] of blobs) {
      const g = b.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      b.fillStyle = g;
      b.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // 中央底光（冷青扫描晕）
    const g = b.createRadialGradient(W / 2, H / 2, T * 2, W / 2, H / 2, W * 0.95);
    g.addColorStop(0, 'rgba(92,185,188,0.10)');
    g.addColorStop(1, 'rgba(92,185,188,0)');
    b.fillStyle = g;
    b.fillRect(SKY_SPAN.x0, SKY_SPAN.y0, SKY_SPAN.w, SKY_SPAN.h);
    skyCanvas = c;
    // 扫描点 / 微尘粒子表（确定性散布，逐帧只做 sin 与填充）
    stars = [];
    for (let i = 0; i < 230; i++) {
      stars.push({
        x: (hash2(i, 101) - 0.5) * W * span,
        y: (hash2(i, 211) - 0.5) * H * span,
        r: 0.7 + hash2(i, 401) * 1.5,
        spd: 0.4 + hash2(i, 307) * 0.9,
        ph: i * 1.3,
        gold: hash2(i, 503) > 0.82,
      });
    }
    motes = [];
    for (let i = 0; i < 34; i++) {
      const hx = hash2(i, 7), hy = hash2(i, 13);
      motes.push({ x: hx * W, y0: hy * H, spd: 4 + hy * 5, r: 1 + hx * 1.2, ph: i * 1.7, gold: i % 5 === 0 });
    }
  }

  function drawStars(ctx, game) {
    const t = game.time;
    ctx.fillStyle = 'rgb(232,212,176)';
    for (const s of stars) {
      if (s.gold) continue;
      ctx.globalAlpha = 0.55 * (0.35 + 0.65 * Math.abs(Math.sin(t * s.spd + s.ph)));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgb(248,214,132)';
    for (const s of stars) {
      if (!s.gold) continue;
      ctx.globalAlpha = 0.7 * (0.35 + 0.65 * Math.abs(Math.sin(t * s.spd + s.ph)));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMotes(ctx, game, H) {
    const t = game.time;
    // 分色两趟批绘（同 drawStars）：fillStyle 只设两次，不再逐粒重设
    ctx.fillStyle = 'rgb(214,182,130)';
    for (const m of motes) {
      if (m.gold) continue;
      ctx.globalAlpha = Math.max(0, 0.05 + 0.05 * Math.sin(t * 1.4 + m.ph));
      ctx.beginPath(); ctx.arc(m.x, (m.y0 + t * m.spd) % H, m.r, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgb(245,205,120)';
    for (const m of motes) {
      if (!m.gold) continue;
      ctx.globalAlpha = Math.max(0, 0.05 + 0.05 * Math.sin(t * 1.4 + m.ph));
      ctx.beginPath(); ctx.arc(m.x, (m.y0 + t * m.spd) % H, m.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 烘焙：结点静态层（纸面落影 / 盘面 / 双圈描边 / 底光 / 备注标记） ----------
  // 失效条件：换层、备注重建、烘焙倍率变化
  function ensureBoard(game) {
    if (!game.nodes || !game.nodes.length) return;
    const bs = bakeScale();
    if (boardCanvas && boardKey.layerIdx === game.layerIdx &&
        boardKey.notes === game.noteMap && boardKey.bs === bs) return;
    boardKey.layerIdx = game.layerIdx;
    boardKey.notes = game.noteMap;
    boardKey.bs = bs;

    const map = game.map, T = map.tile;
    const c = document.createElement('canvas');
    c.width = Math.ceil((map.cols * T + BOARD_PAD * 2) * bs);
    c.height = Math.ceil((map.rows * T + BOARD_PAD * 2) * bs);
    const b = c.getContext('2d');
    b.scale(bs, bs);
    b.translate(BOARD_PAD, BOARD_PAD);
    const g = nodeGeo(game);

    // 结点：落影 + 深色圆底盘面（层色只留极淡的 tint，呼吸缩放时不露亮边；描边/微光在动态层画）
    for (const n of g.nodes) {
      b.save();
      b.globalAlpha = 0.24;
      const layerColor = n.li >= 0 ? (game.layerData[n.li]?.color || '#6e5133')
        : (SDT.MAP.centerColor || '#4a3763');
      // 纸面落影
      b.fillStyle = 'rgba(0,0,0,0.38)';
      b.beginPath();
      b.ellipse(n.x + 2.5, n.y + 4, n.r * 1.02, n.r * 0.62, 0, 0, TAU);
      b.fill();
      // 盘面：层色微 tint 的深色径向渐变
      const base = mixHex(layerColor, '#141210', 0.82);
      const rg = b.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.4, n.r * 0.2, n.x, n.y, n.r);
      rg.addColorStop(0, shade(base, 0.05));
      rg.addColorStop(1, shade(base, -0.08));
      circle(b, n.x, n.y, n.r * 1.02);
      b.fillStyle = rg; b.fill();
      b.restore();
    }

    // 入口底光（当前层入口结点——2026-09-10 留言 #21：此前固定取第 1 层，
    // 各层世界坐标重叠，导致第 2~4 层画面上凭空烘出第 1 层入口的光斑，
    // 看起来像生成了不可抵达的节点图像）
    const l1 = game.layerData[game.layerIdx] || game.layerData[0];
    const layerPos = game.nodePos[game.layerIdx] || game.nodePos[0];
    b.save();
    b.globalAlpha = 0.16;
    l1.entrances.forEach((idx) => {
      const p = layerPos[idx];
      const glow = b.createRadialGradient(p.x, p.y, 2, p.x, p.y, T * 0.6);
      glow.addColorStop(0, 'rgba(90,162,134,0.25)');
      glow.addColorStop(1, 'rgba(90,162,134,0)');
      b.fillStyle = glow;
      b.fillRect(p.x - T * 0.65, p.y - T * 0.65, T * 1.3, T * 1.3);
    });
    b.restore();

    // 祭坛底光（深入内环时增强）
    if (g.altarNode) {
      const deep = game.layerIdx === game.layerData.length - 1;
      const a = deep ? 0.55 : 0.20;
      const glow = b.createRadialGradient(g.altarNode.x, g.altarNode.y, T * 0.2, g.altarNode.x, g.altarNode.y, T * 1.6);
      glow.addColorStop(0, `rgba(154,124,200,${(a * 0.30).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(154,124,200,0)');
      b.fillStyle = glow;
      b.fillRect(g.altarNode.x - T * 1.7, g.altarNode.y - T * 1.7, T * 3.4, T * 3.4);
    }

    // 备注标记：结点右上角琥珀圆点（非当前环淡显）
    if (game.noteMap && game.noteMap.size) {
      b.save();
      for (const key of game.noteMap.keys()) {
        const bar = key.indexOf('|');
        if (key.slice(0, bar) !== map.boardId) continue;
        const coord = key.slice(bar + 1);
        const comma = coord.indexOf(',');
        if (comma < 0) continue;
        const li = +coord.slice(0, comma), idx = +coord.slice(comma + 1);
        const n = g.nodes.find(q => q.li === li && q.idx === idx);
        if (!n) continue;
        b.globalAlpha = !isCurLayer(game, n.li) ? 0.30 : 1;
        b.shadowColor = 'rgba(240,168,50,0.6)';
        b.shadowBlur = 4 * bs;
        b.fillStyle = '#f0a832';
        circle(b, n.x + n.r * 0.78, n.y - n.r * 0.82, 3.2);
        b.fill();
      }
      b.restore();
    }

    boardCanvas = c;
  }

  // 当前位置底盘单独动态绘制，避免每走一步都重烘焙整张高分辨率棋盘。
  function drawCurrentNodePlate(ctx, game) {
    const g = nodeGeo(game);
    const n = g.nodes.find(node => isCurrentNode(game, node));
    if (!n) return;
    const layerColor = game.layerData[n.li]?.color || '#6e5133';
    const base = mixHex(layerColor, '#141210', 0.62);
    ctx.save();
    ctx.shadowColor = 'rgba(255,205,108,0.34)';
    ctx.shadowBlur = 14 / game.cam.zoom;
    const rg = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.4, n.r * 0.18, n.x, n.y, n.r);
    rg.addColorStop(0, shade(base, 0.12));
    rg.addColorStop(1, shade(base, -0.05));
    ctx.fillStyle = rg;
    circle(ctx, n.x, n.y, n.r * 1.03);
    ctx.fill();
    ctx.restore();
  }

  // ---------- 图标层（圆形位图结点：呼吸缩放；当前环明亮，可走相邻环高亮，走过的中亮，其余隐藏/虚化） ----------
  function drawIcons(ctx, game) {
    const u = T0 / 48, t = 0, z = game.cam.zoom;
    const g = nodeGeo(game);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of g.nodes) {
      if (n.def.type === 'fire') continue; // 火堆由 drawFires 统一绘制
      const current = isCurrentNode(game, n);
      // 2026-09-09 老板：当前节点连通（可走）的相邻节点也高亮，与走过节点区分
      const legal = g.legalKeys.has(n.li + ',' + n.idx);
      // 走过的格子标绿（2026-09-09 玩法定版：任何格子只能触发一次）
      const walked = !!(game.visited && game.visited[n.li + ',' + n.idx]);
      const phase = nodePhase(n);
      // 呼吸缩放（各结点错拍）+ 当前环轻微悬浮
      const R = n.r;
      ctx.save();
      ctx.globalAlpha = current ? 1 : legal ? 0.95 : 0.55;
      if (!drawBitmapIcon(ctx, n.def.type, n.x, n.y, R, current, z, legal)) {
        if (current) {
          ctx.translate(0, 0);
          ctx.shadowColor = n.def.type === 'boss' ? 'rgba(255,90,80,0.6)'
            : n.def.type === 'altar' ? 'rgba(154,124,200,0.7)'
            : 'rgba(255,240,200,0.35)';
          ctx.shadowBlur = 6;
        }
        drawIcon(ctx, n.def, n.x, n.y, u, t);
      }
      // 重要结点：微光环绕（旋转虚线光环 + 呼吸明暗）
      const glow = GLISTEN[n.def.type];
      if (glow) {
        ctx.save();
        ctx.globalAlpha = current ? 0.9 : 0.18;
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.5 / z;
        ctx.setLineDash(NO_DASH);
        circle(ctx, n.x, n.y, n.r * 1.26);
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
        ctx.restore();
      }
      // 走过的格子：外圈描绿（火堆在 drawFires 里同样处理）
      if (walked) {
        ctx.save();
        ctx.globalAlpha = current ? 0.95 : 0.6;
        ctx.strokeStyle = '#52d273';
        ctx.lineWidth = 2.2 / z;
        ctx.setLineDash(NO_DASH);
        circle(ctx, n.x, n.y, n.r * 1.16);
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
        ctx.fillStyle = 'rgba(82, 210, 115, 0.16)';
        circle(ctx, n.x, n.y, n.r * 1.16);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
  }

  // ---------- 手绘连线（环内线按层合并批描：实描+点划叠加；门/祭坛线流光虚线逐帧） ----------
  function drawLinks(ctx, game) {
    const g = nodeGeo(game);
    const z = game.cam.zoom, curLi = game.layerIdx, t = game.time;
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
      const pulse = 0.82 + Math.sin((game.time || 0) * 3.2) * 0.12;
      ctx.globalAlpha = 0.42 * pulse;
      ctx.strokeStyle = 'rgba(255,190,74,0.78)';
      ctx.lineWidth = 13 / z;
      ctx.shadowColor = 'rgba(255,181,55,0.95)';
      ctx.shadowBlur = 18 / z;
      ctx.stroke(g.legalLinks);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.92 * pulse;
      ctx.strokeStyle = 'rgba(255,202,91,0.96)';
      ctx.lineWidth = 5.4 / z;
      ctx.stroke(g.legalLinks);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,247,205,0.98)';
      ctx.lineWidth = 1.7 / z;
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
  function drawFires(ctx, game) {
    const g = nodeGeo(game);
    const u = T0 / 48, cam = game.cam, t = 0;
    for (const n of g.nodes) {
      if (n.def.type !== 'fire') continue;
      const current = isCurrentNode(game, n);
      // 走过的火堆 = 熄灭（2026-09-09 老板：重置为空白节点）——只画暗灰烬烬环，不再画火苗；
      // 还站在火堆上时保持燃烧状态（本格休息ing）；外圈描绿与其它走过的格子一致
      if (!current && game.visited && game.visited[n.li + ',' + n.idx]) {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = 'rgba(82, 210, 115, 0.9)';
        ctx.lineWidth = 1.4 / cam.zoom;
        circle(ctx, n.x, n.y, n.r + 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(82, 210, 115, 0.18)';
        circle(ctx, n.x, n.y, n.r * 0.34);
        ctx.fill();
        ctx.restore();
        continue;
      }
      const phase = nodePhase(n);
      const R = n.r;
      ctx.save();
      ctx.globalAlpha = current ? 1 : 0.20;
      // 圆形位图火堆（呼吸缩放）+ 橙色微光环绕；无位图回退辉光环 + 简笔火焰
      if (drawBitmapIcon(ctx, 'fire', n.x, n.y, R, current, cam.zoom)) {
        const p = 0.5;
        ctx.globalAlpha = (current ? 0.9 : 0.18) * (0.7 + 0.3 * p);
        ctx.strokeStyle = 'rgba(242,133,74,0.85)';
        ctx.lineWidth = 1.5 / cam.zoom;
        ctx.setLineDash(NO_DASH);
        circle(ctx, n.x, n.y, n.r * 1.26 + p * 2);
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
      } else {
        ctx.fillStyle = 'rgba(242,133,74,0.14)';
        circle(ctx, n.x, n.y, n.r + 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(242,133,74,0.75)';
        ctx.lineWidth = 1.8 / cam.zoom;
        circle(ctx, n.x, n.y, n.r + 2);
        ctx.stroke();
        if (current) { ctx.shadowColor = 'rgba(242,133,74,0.55)'; ctx.shadowBlur = 12; }
        drawFlame(ctx, n.x, n.y, u, 1.15, t);
      }
      ctx.restore();
    }
  }

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

  // ---------- 祭坛旋转法阵（底光已烘焙，虚线逐帧） ----------
  function drawAltarCircle(ctx, game) {
    const g = nodeGeo(game);
    if (!g.altarNode) return;
    const cx = g.altarNode.x, cy = g.altarNode.y;
    const deep = game.layerIdx === game.layerData.length - 1;
    const a = deep ? 0.55 : 0.20, z = game.cam.zoom;
    ctx.save();
    ctx.lineWidth = 1.6 / z;
    setDash(ctx, 7 / z, 9 / z);
    ctx.strokeStyle = `rgba(154,124,200,${a})`;
    ctx.lineDashOffset = -(game.time * 14) / z;
    ctx.beginPath(); ctx.arc(cx, cy, T0 * 1.05, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(186,150,230,${a * 0.8})`;
    ctx.lineDashOffset = (game.time * 10) / z;
    ctx.beginPath(); ctx.arc(cx, cy, T0 * 0.72, 0, TAU); ctx.stroke();
    ctx.setLineDash(NO_DASH);
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
    const bounce = Math.sin((game.time || 0) * 4.2) * 3;
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

  // 名牌文本宽度缓存（字体串只随 zoom 变；避免逐帧 measureText 分配 TextMetrics）
  const nameplate = { key: '', w: 0 };

  function drawPlayer(ctx, game) {
    const cam = game.cam, z = cam.zoom;
    const px = game.pos.x;
    const groundY = game.pos.y;               // 俯视图：玩家标记与所在结点中心对齐（留言：红圈不居中）
    const s = T0 * 0.40;                       // 棋子尺寸
    ctx.save();
    // 地影（跳起时收窄）
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(px, groundY + s * 0.14, s * 0.5 * (1 - game.hop * 0.22), s * 0.16, 0, 0, TAU);
    ctx.fill();
    // 呼吸光圈（椭圆，贴地；与浅红标记同色系）
    const pulse = 0.5;
    ctx.strokeStyle = `rgba(255,132,115,${(0.34 - pulse * 0.18).toFixed(3)})`;
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.ellipse(px, groundY + s * 0.14, s * (0.68 + pulse * 0.1), s * (0.23 + pulse * 0.03), 0, 0, TAU);
    ctx.stroke();
    // —— 当前位置：浅红色圆圈标记（贴地，呼吸缩放，取消头像图） ——
    const markR = T0 * 0.66 * (1 + pulse * 0.10);
    ctx.fillStyle = 'rgba(255,120,105,0.16)';
    circle(ctx, px, groundY, markR);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,132,115,0.95)';
    ctx.lineWidth = 3.2 / z;
    circle(ctx, px, groundY, markR);
    ctx.stroke();
    // 外扩涟漪：一圈淡出
    ctx.strokeStyle = `rgba(255,132,115,${(0.55 - pulse * 0.4).toFixed(3)})`;
    ctx.lineWidth = 2 / z;
    circle(ctx, px, groundY, markR * (1.15 + pulse * 0.35));
    ctx.stroke();
    // 名牌胶囊（钉在定位针上方）
    const label = '你';
    ctx.font = font(cam, 10);
    if (nameplate.key !== ctx.font) { nameplate.key = ctx.font; nameplate.w = ctx.measureText(label).width; }
    const tw = nameplate.w;
    const lw2 = tw + 12 / z, lh = 15 / z, lx = px, ly = groundY - markR - 16 / z;
    ctx.fillStyle = 'rgba(22,15,6,0.85)';
    rrect(ctx, lx - lw2 / 2, ly - lh / 2, lw2, lh, lh / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(216,180,106,0.55)';
    ctx.lineWidth = 1 / z;
    ctx.stroke();
    ctx.fillStyle = '#f2e2b8';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, lx, ly + 0.5 / z);
    ctx.restore();
  }


  // ---------- 屏幕空间渐变（背景 / 暗角，仅在窗口尺寸变化时重建；数值比较避免逐帧拼 key 字符串） ----------
  function screenGrads(ctx, cam) {
    if (gradCache && gradCache.w === cam.viewW && gradCache.h === cam.viewH) return gradCache;
    const bg = ctx.createLinearGradient(0, 0, 0, cam.viewH);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    const r = Math.hypot(cam.viewW, cam.viewH) / 2;
    const vig = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, r * 0.55, cam.viewW / 2, cam.viewH / 2, r * 1.05);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(12,6,2,0.55)');
    gradCache = { w: cam.viewW, h: cam.viewH, bg, vig };
    return gradCache;
  }

  function draw(ctx, game) {
    if (!game.nodes || !game.nodes.length) return;   // 结点布局未构建前不绘制
    const cam = game.cam, map = game.map;
    const T = map.tile, W = map.cols * T, H = map.rows * T;
    // 局内按层使用壁纸（L1/L2 废墟 / L3 红骑士 / L4 白机械 / L5 黑机械）；缓存按视口+层重建
    ctx.drawImage(ensureBackdrop(cam, game.layerIdx), 0, 0, cam.viewW, cam.viewH);
    // 轻量暗色层保留地图、节点和 HUD 的对比度，不遮掉壁纸主体。
    const bg = ctx.createLinearGradient(0, 0, 0, cam.viewH);
    bg.addColorStop(0, 'rgba(5,14,18,0.28)');
    bg.addColorStop(0.55, 'rgba(5,14,18,0.18)');
    bg.addColorStop(1, 'rgba(2,8,11,0.40)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    const halo = ctx.createRadialGradient(cam.viewW * 0.5, cam.viewH * 0.46, 0,
      cam.viewW * 0.5, cam.viewH * 0.46, Math.max(cam.viewW, cam.viewH) * 0.72);
    halo.addColorStop(0, 'rgba(83,126,137,0.08)');
    halo.addColorStop(0.62, 'rgba(36,64,74,0.03)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    const sx = 0, sy = 0;
    ctx.save();
    ctx.translate(cam.viewW / 2 + sx, cam.viewH / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    ensureBoard(game);
    ctx.drawImage(boardCanvas, -BOARD_PAD, -BOARD_PAD, W + BOARD_PAD * 2, H + BOARD_PAD * 2);
    drawCurrentNodePlate(ctx, game);
    drawLinks(ctx, game);
    drawFires(ctx, game);
    drawIcons(ctx, game);
    drawIndexes(ctx, game);
    drawEntrancePulse(ctx, game);
    drawMoveTarget(ctx, game);
    drawHover(ctx, game);
    drawTargetArrow(ctx, game);
    drawPlayer(ctx, game);

    ctx.restore();

    const vignette = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, Math.min(cam.viewW, cam.viewH) * 0.30,
      cam.viewW / 2, cam.viewH / 2, Math.max(cam.viewW, cam.viewH) * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.36)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);

  }

  SDT.Renderer = { draw };

export { SDT };
