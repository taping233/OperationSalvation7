
import { circle, drawCover, font, hash2, mixHex, rrect, shade } from './renderer.primitives.js';
import { drawFlame, drawIcon, drawBitmapIcon } from './renderer.icons.js';
import { shakeOffset, drawFX } from './renderer.fx.js';
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

  // 局内壁纸：静态图版（残骸海岸）。静态图无逐帧解码开销，比视频版更省 GPU
  const environmentBackdrop = new Image();
  let backdropCanvas = null;               // 壁纸合成层（尺寸或就绪状态变化时重建）
  const backdropKey = { w: 0, h: 0, ready: false };
  function ensureBackdrop(cam) {
    const ready = environmentBackdrop.complete && environmentBackdrop.naturalWidth > 0;
    if (backdropCanvas && backdropKey.w === cam.viewW && backdropKey.h === cam.viewH && backdropKey.ready === ready) return backdropCanvas;
    backdropKey.w = cam.viewW; backdropKey.h = cam.viewH; backdropKey.ready = ready;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cam.viewW * (window.devicePixelRatio || 1)));
    c.height = Math.max(1, Math.round(cam.viewH * (window.devicePixelRatio || 1)));
    // alpha:false：不透明烘焙层走更省显存带宽的合成路径，也规避透明纹理混合异常
    const b = c.getContext('2d', { alpha: false });
    b.scale(c.width / cam.viewW, c.height / cam.viewH);
    // 壁纸未就绪时回退纯色；就绪后整层铺底，bg 渐变降为 50% 遮罩保证结点可读
    b.fillStyle = '#0B0E12';
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    if (ready) drawCover(b, environmentBackdrop, cam.viewW, cam.viewH);
    b.globalAlpha = 0.5;
    const bg = b.createLinearGradient(0, 0, 0, cam.viewH);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    b.fillStyle = bg;
    b.fillRect(0, 0, cam.viewW, cam.viewH);
    backdropCanvas = c;
    return c;
  }
  environmentBackdrop.addEventListener('load', () => { backdropCanvas = null; SDT.RenderScheduler?.invalidate(); });
  environmentBackdrop.src = new URL('../assets/board-backdrop-wreck.webp', import.meta.url).href;


  const isCurLayer = (game, li) => li === game.layerIdx;
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
    if (geo && geo.src === game.nodes) return geo;
    const nodes = game.nodes.map(n => ({ ...n, r: nodeRadius(n) }));

    // 手绘线：中点垂直偏移（确定性 wobble）的二次曲线
    const hand = (a, b, seed) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = (hash2(seed, 7) - 0.5) * 2 * Math.min(11, len * 0.14);
      const mx = (a.x + b.x) / 2 - dy / len * off;
      const my = (a.y + b.y) / 2 + dx / len * off;
      const p = new Path2D();
      p.moveTo(a.x, a.y);
      p.quadraticCurveTo(mx, my, b.x, b.y);
      return p;
    };
    // 两端各缩进 gap 像素（结点边缘留白）
    const trim = (from, to, gap) => {
      const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      const t = gap / len;
      return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
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

    // 逐帧性能：同层连线合并为一条 Path2D，每层一次描边（实描 + 点划叠加）
    const linksByLayer = game.nodePos.map(() => new Path2D());
    game.nodePos.forEach((arr, li) => {
      arr.forEach((p, i) => {
        const q = arr[(i + 1) % arr.length];
        const p2 = hand(trim(p, q, LINK_GAP), trim(q, p, LINK_GAP), li * 57 + i * 13 + 1);
        linksByLayer[li].addPath(p2);
      });
    });
    const doorLinks = [];   // 环间门连线（金色 / 出口绿色，带箭头；条数少，逐帧逐条描）
    game.layerData.forEach((ld, li) => {
      for (const d of (ld.doors || [])) {
        if (d.reverse) continue;
        const p = game.nodePos[li][d.at], q = game.nodePos[d.toLayer][d.arriveAt];
        const a = trim(p, q, LINK_GAP), b = trim(q, p, LINK_GAP);
        doorLinks.push({ fromLi: li, toLayer: d.toLayer, exit: !!d.exit,
          path: hand(a, b, li * 91 + d.at * 7 + 3), arrow: arrowAt(a, b) });
      }
    });
    // 祭坛引导线（紫，第三环入口 → 中央祭坛）
    const altarNode = nodes.find(n => n.li === -1 && n.def.type === 'altar');
    const altarLinks = [];
    const ld3 = game.layerData[2];
    if (ld3 && altarNode) {
      for (const ae of (ld3.altarEntrances || [])) {
        const p = game.nodePos[2][ae.at];
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
    geo = { src: game.nodes, nodes, linksByLayer, doorLinks, altarLinks, bounds, altarNode };
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
  let gradCache = null;                 // { key, bg, vig } 屏幕空间渐变

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
    for (const m of motes) {
      const a = Math.max(0, 0.05 + 0.05 * Math.sin(t * 1.4 + m.ph));
      ctx.fillStyle = m.gold ? 'rgb(245,205,120)' : 'rgb(214,182,130)';
      ctx.globalAlpha = a;
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
      const layerColor = n.li >= 0 ? (map.layers[n.li].color || '#6e5133')
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
    }

    // 入口底光（第一环入口结点）
    const l1 = game.layerData[0];
    b.save();
    b.globalAlpha = game.layerIdx === 0 ? 1 : 0.30;
    l1.entrances.forEach((idx) => {
      const p = game.nodePos[0][idx];
      const glow = b.createRadialGradient(p.x, p.y, 2, p.x, p.y, T * 0.6);
      glow.addColorStop(0, 'rgba(90,162,134,0.25)');
      glow.addColorStop(1, 'rgba(90,162,134,0)');
      b.fillStyle = glow;
      b.fillRect(p.x - T * 0.65, p.y - T * 0.65, T * 1.3, T * 1.3);
    });
    b.restore();

    // 祭坛底光（深入内环时增强）
    if (g.altarNode) {
      const deep = game.layerIdx === map.layers.length - 1;
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

  // ---------- 图标层（圆形位图结点：呼吸缩放；当前环明亮，其余虚化） ----------
  function drawIcons(ctx, game) {
    const u = T0 / 48, t = game.time, z = game.cam.zoom;
    const g = nodeGeo(game);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of g.nodes) {
      if (n.def.type === 'fire') continue; // 火堆由 drawFires 统一绘制
      const cur = isCurLayer(game, n.li);
      const phase = nodePhase(n);
      // 呼吸缩放（各结点错拍）+ 当前环轻微悬浮
      const R = n.r * (1 + 0.045 * Math.sin(t * 2.1 + phase));
      ctx.save();
      ctx.globalAlpha = cur ? 1 : 0.32;
      if (!drawBitmapIcon(ctx, n.def.type, n.x, n.y + (cur ? Math.sin(t * 2.2 + phase) * 1.6 * u : 0), R, cur, z)) {
        if (cur) {
          ctx.translate(0, Math.sin(t * 2.2 + phase) * 1.6 * u);
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
        ctx.globalAlpha = (cur ? 0.9 : 0.28) * (0.72 + 0.28 * Math.sin(t * 1.7 + phase));
        ctx.strokeStyle = glow;
        ctx.lineWidth = 1.5 / z;
        ctx.setLineDash([4 / z, 7 / z]);
        ctx.lineDashOffset = -(t * 10) / z;
        circle(ctx, n.x, n.y, n.r * 1.26 + Math.sin(t * 1.3 + phase) * 2);
        ctx.stroke();
        ctx.setLineDash([]);
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
      const cur = li === curLi, path = g.linksByLayer[li];
      ctx.globalAlpha = cur ? 1 : 0.28;
      ctx.lineWidth = (cur ? 2.5 : 2.0) / z;
      ctx.stroke(path);
      ctx.globalAlpha = cur ? 0.55 : 0.14;
      ctx.lineWidth = 3.2 / z;
      ctx.setLineDash([1.5 / z, 9 / z]);
      ctx.stroke(path);
      ctx.setLineDash([]);
    }
    // 环间门：金色流光（出口绿色）
    ctx.lineWidth = 1.9 / z;
    ctx.setLineDash([5 / z, 5 / z]);
    ctx.lineDashOffset = -(t * 16) / z;
    for (const s of g.doorLinks) {
      const relevant = s.fromLi === curLi || s.toLayer === curLi;
      ctx.globalAlpha = relevant ? 0.95 : 0.22;
      const col = s.exit ? 'rgba(110,200,160,0.85)' : 'rgba(225,192,120,0.85)';
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.stroke(s.path);
      ctx.fill(s.arrow);
    }
    // 祭坛引导线：紫色流光
    if (g.altarLinks.length) {
      ctx.strokeStyle = 'rgba(154,124,200,0.85)'; ctx.fillStyle = 'rgba(154,124,200,0.85)';
      ctx.globalAlpha = curLi === 2 ? 0.85 : 0.2;
      for (const l of g.altarLinks) { ctx.stroke(l.path); ctx.fill(l.arrow); }
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ---------- 火堆结点（辉光环 + 摇曳火焰） ----------
  function drawFires(ctx, game) {
    const g = nodeGeo(game);
    const u = T0 / 48, cam = game.cam, t = game.time;
    for (const n of g.nodes) {
      if (n.def.type !== 'fire') continue;
      const cur = isCurLayer(game, n.li);
      const phase = nodePhase(n);
      const R = n.r * (1 + 0.045 * Math.sin(t * 2.1 + phase));
      ctx.save();
      ctx.globalAlpha = cur ? 1 : 0.35;
      // 圆形位图火堆（呼吸缩放）+ 橙色微光环绕；无位图回退辉光环 + 简笔火焰
      if (drawBitmapIcon(ctx, 'fire', n.x, n.y, R, cur, cam.zoom)) {
        const p = (Math.sin(t * 2.4 + phase) + 1) / 2;
        ctx.globalAlpha = (cur ? 0.9 : 0.3) * (0.7 + 0.3 * p);
        ctx.strokeStyle = 'rgba(242,133,74,0.85)';
        ctx.lineWidth = 1.5 / cam.zoom;
        ctx.setLineDash([4 / cam.zoom, 7 / cam.zoom]);
        ctx.lineDashOffset = -(t * 10) / cam.zoom;
        circle(ctx, n.x, n.y, n.r * 1.26 + p * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(242,133,74,0.14)';
        circle(ctx, n.x, n.y, n.r + 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(242,133,74,0.75)';
        ctx.lineWidth = 1.8 / cam.zoom;
        circle(ctx, n.x, n.y, n.r + 2);
        ctx.stroke();
        if (cur) { ctx.shadowColor = 'rgba(242,133,74,0.55)'; ctx.shadowBlur = 12; }
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
      ctx.fillText(String(n.idx), n.x, n.y - n.r - 4);
    }
  }

  // ---------- 入口脉冲圈（底光已烘焙，此处只画脉冲环） ----------
  function drawEntrancePulse(ctx, game) {
    const cam = game.cam;
    const l1 = game.layerData[0];
    const pulse = (Math.sin(game.time * 2.6) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = game.layerIdx === 0 ? 1 : 0.30;
    ctx.strokeStyle = 'rgba(90,162,134,0.85)';
    ctx.lineWidth = 2 / cam.zoom;
    for (const idx of l1.entrances) {
      const p = game.nodePos[0][idx];
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
    const deep = game.layerIdx === game.map.layers.length - 1;
    const a = deep ? 0.55 : 0.20, z = game.cam.zoom;
    ctx.save();
    ctx.lineWidth = 1.6 / z;
    ctx.setLineDash([7 / z, 9 / z]);
    ctx.strokeStyle = `rgba(154,124,200,${a})`;
    ctx.lineDashOffset = -(game.time * 14) / z;
    ctx.beginPath(); ctx.arc(cx, cy, T0 * 1.05, 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(186,150,230,${a * 0.8})`;
    ctx.lineDashOffset = (game.time * 10) / z;
    ctx.beginPath(); ctx.arc(cx, cy, T0 * 0.72, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
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

  // 移动目标结点：金色四角括号
  function drawMoveTarget(ctx, game) {
    if (game.moveTarget == null || game.state !== 'moving') return;
    const p = game.nodePos[game.layerIdx][game.moveTarget];
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
    const cam = game.cam, z = cam.zoom;
    const px = game.pos.x;
    const groundY = game.pos.y + T0 * 0.18;
    const s = T0 * 0.40;                       // 棋子尺寸
    ctx.save();
    // 地影（跳起时收窄）
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.beginPath();
    ctx.ellipse(px, groundY + s * 0.14, s * 0.5 * (1 - game.hop * 0.22), s * 0.16, 0, 0, TAU);
    ctx.fill();
    // 呼吸光圈（椭圆，贴地；与浅红标记同色系）
    const pulse = (Math.sin(game.time * 3.2) + 1) / 2;
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
    const tw = ctx.measureText(label).width;
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


  // ---------- 屏幕空间渐变（背景 / 暗角，仅在窗口尺寸变化时重建） ----------
  function screenGrads(ctx, cam) {
    const key = cam.viewW + 'x' + cam.viewH;
    if (gradCache && gradCache.key === key) return gradCache;
    const bg = ctx.createLinearGradient(0, 0, 0, cam.viewH);
    bg.addColorStop(0, COLORS.bgTop);
    bg.addColorStop(1, COLORS.bgBottom);
    const r = Math.hypot(cam.viewW, cam.viewH) / 2;
    const vig = ctx.createRadialGradient(cam.viewW / 2, cam.viewH / 2, r * 0.55, cam.viewW / 2, cam.viewH / 2, r * 1.05);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(12,6,2,0.55)');
    gradCache = { key, bg, vig };
    return gradCache;
  }

  function draw(ctx, game) {
    if (!game.nodes || !game.nodes.length) return;   // 结点布局未构建前不绘制
    const cam = game.cam, map = game.map;
    const T = map.tile, W = map.cols * T, H = map.rows * T;
    const grads = screenGrads(ctx, cam);
    // 静态壁纸 + 50% 渐变遮罩已烘焙成单张合成层，逐帧一次 drawImage（见 ensureBackdrop）
    ctx.drawImage(ensureBackdrop(cam), 0, 0, cam.viewW, cam.viewH);

    const [sx, sy] = shakeOffset(game.time);
    ctx.save();
    ctx.translate(cam.viewW / 2 + sx, cam.viewH / 2 + sy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.cx, -cam.cy);

    ensureSky(map);
    ctx.drawImage(skyCanvas, SKY_SPAN.x0, SKY_SPAN.y0, SKY_SPAN.w, SKY_SPAN.h);
    drawStars(ctx, game);
    drawMotes(ctx, game, H);
    ensureBoard(game);
    ctx.drawImage(boardCanvas, -BOARD_PAD, -BOARD_PAD, W + BOARD_PAD * 2, H + BOARD_PAD * 2);
    drawLinks(ctx, game);
    drawAltarCircle(ctx, game);
    drawFires(ctx, game);
    drawIcons(ctx, game);
    drawIndexes(ctx, game);
    drawEntrancePulse(ctx, game);
    drawMoveTarget(ctx, game);
    drawHover(ctx, game);
    drawPlayer(ctx, game);
    drawFX(ctx, game);

    ctx.restore();

    // 暗角氛围（偏紫的夜幕）
    ctx.fillStyle = grads.vig;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
  }

  SDT.Renderer = { draw };

export { SDT };
