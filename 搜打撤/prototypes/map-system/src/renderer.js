/* ============================================================
 * 搜打撤 v0.8 —— 渲染器（分布式结点地图 · 手绘连线）
 * 每个逻辑格是一枚散布的圆形结点（几何唯一来源：game.nodes /
 * game.nodePos / game.centerPos，由 mapData.buildNodePositions 生成）；
 * 同环相邻结点、环间门与祭坛引导线用手绘风格线段连接
 * （确定性抖动曲线，结点边缘留白）。
 *
 * 性能策略：
 *   - 静态内容烘焙到离屏画布：星云底光（一次）、结点底盘/双圈描边/
 *     入口底光/祭坛底光/备注标记（换层 / 改备注时重建）。
 *   - 连线为预生成 Path2D，逐帧只描边；粒子数组预计算，
 *     每帧零字符串拼接、零渐变重建、零数组分配。
 * 对外暴露 SDT.FX：float(飘字) / pulse(脉冲) / shake(震屏) / clear()
 * ============================================================ */
(function () {
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

  // 局内壁纸：视频版（Wallpaper Engine 素材）
  const environmentBackdrop = document.createElement('video');
  environmentBackdrop.src = 'assets/wallpaper-改版.mp4';
  environmentBackdrop.muted = true;
  environmentBackdrop.loop = true;
  environmentBackdrop.playsInline = true;
  environmentBackdrop.autoplay = true;
  { const s = environmentBackdrop.style;   // 留在 DOM 里但不可见，保证 Chromium 持续解码
    s.position = 'fixed'; s.left = '-10px'; s.top = '0';
    s.width = '1px'; s.height = '1px'; s.opacity = '0'; s.pointerEvents = 'none'; }
  if (document.body) document.body.appendChild(environmentBackdrop);
  else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(environmentBackdrop));
  environmentBackdrop.play().catch(() => {
    environmentBackdrop.addEventListener('canplay', () => environmentBackdrop.play().catch(() => {}));
  });

  function drawCover(ctx, media, width, height) {
    const isVideo = media.tagName === 'VIDEO';
    const mw = isVideo ? media.videoWidth : media.naturalWidth;
    const mh = isVideo ? media.videoHeight : media.naturalHeight;
    if (isVideo ? media.readyState < 2 : (!media.complete || !mw)) return;
    const scale = Math.max(width / mw, height / mh);
    const w = mw * scale, h = mh * scale;
    ctx.drawImage(media, (width - w) / 2, (height - h) / 2, w, h);
  }

  // ---------- FX：飘字 / 落点脉冲 / 震屏 ----------
  const FX = {
    floats: [], pulses: [], shakes: [],
    // v0.22：飘字加大加久（结算反馈要一眼看清，不能一闪而过）
    float(text, wx, wy, color, big) {
      this.floats.push({ text, x: wx + (Math.random() - 0.5) * 10, y: wy,
        color, big: !!big, t0: -1, dur: big ? 2.1 : 1.7 });
    },
    pulse(wx, wy, color) { this.pulses.push({ x: wx, y: wy, color, t0: -1, dur: 0.55 }); },
    shake(power, dur) { this.shakes.push({ power, dur, t0: -1 }); },
    clear() { this.floats.length = 0; this.pulses.length = 0; this.shakes.length = 0; },
  };
  SDT.FX = FX;

  // ---------- 小工具 ----------
  function hash2(x, y) {
    let n = (x * 374761393 + y * 668265263) >>> 0;
    n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) + 255 * amt)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) + 255 * amt)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) + 255 * amt)));
    return `rgb(${r},${g},${b})`;
  }

  function mixHex(a, b, t) {
    const na = parseInt(a.slice(1), 16), nb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((na >> s) & 255) + (((nb >> s) & 255) - ((na >> s) & 255)) * t);
    return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
  }

  function font(cam, size) {
    return `bold ${size / cam.zoom}px "Segoe UI","Microsoft YaHei",sans-serif`;
  }

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillStroke(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  }

  // 火焰（h/w 可分离抖动，产生摇曳感）
  function drawFlame(ctx, cx, cy, u, scale, t) {
    scale = scale || 1;
    const w = scale, h = scale * (1 + 0.08 * Math.sin((t || 0) * 7 + cx * 0.11));
    ctx.fillStyle = '#f2854a';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11 * u * h);
    ctx.bezierCurveTo(cx + 9 * u * w, cy - 3 * u * h, cx + 8 * u * w, cy + 5 * u * h, cx, cy + 9 * u * h);
    ctx.bezierCurveTo(cx - 8 * u * w, cy + 5 * u * h, cx - 9 * u * w, cy - 3 * u * h, cx, cy - 11 * u * h);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 4 * u * h);
    ctx.bezierCurveTo(cx + 4.5 * u * w, cy + 1 * u * h, cx + 4 * u * w, cy + 5 * u * h, cx, cy + 9 * u * h);
    ctx.bezierCurveTo(cx - 4 * u * w, cy + 5 * u * h, cx - 4.5 * u * w, cy + 1 * u * h, cx, cy - 4 * u * h);
    ctx.fill();
  }

  /* ============ 卡通图标（以结点中心 cx,cy 为原点，u = 缩放） ============ */
  function drawIcon(ctx, def, cx, cy, u, t) {
    const k = def.type;
    switch (k) {
      case 'coin': { // 金币
        circle(ctx, cx, cy, 10 * u); fillStroke(ctx, '#f5c542', '#a8791b', 2 * u);
        circle(ctx, cx, cy, 6 * u); fillStroke(ctx, null, '#ffe28a', 1.6 * u);
        break;
      }
      case 'wood': { // 原木
        rrect(ctx, cx - 13 * u, cy - 5 * u, 22 * u, 10 * u, 4 * u);
        fillStroke(ctx, '#8a5a2b', '#59391a', 1.8 * u);
        circle(ctx, cx + 9 * u, cy, 6 * u); fillStroke(ctx, '#c8956a', '#59391a', 1.8 * u);
        circle(ctx, cx + 9 * u, cy, 2.5 * u); fillStroke(ctx, null, '#8a5a2b', 1.4 * u);
        break;
      }
      case 'battle': { // 交叉双剑
        ctx.strokeStyle = '#d8dde4'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 9 * u, cy - 9 * u); ctx.lineTo(cx + 9 * u, cy + 9 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 9 * u, cy - 9 * u); ctx.lineTo(cx - 9 * u, cy + 9 * u); ctx.stroke();
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 2.2 * u;
        ctx.beginPath(); ctx.moveTo(cx - 6 * u, cy + 3 * u); ctx.lineTo(cx - 2 * u, cy + 7 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 6 * u, cy + 3 * u); ctx.lineTo(cx + 2 * u, cy + 7 * u); ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'event': { // 问号气泡
        circle(ctx, cx, cy, 11 * u); fillStroke(ctx, '#2ba58a', '#17705c', 2 * u);
        ctx.fillStyle = '#eafffa';
        ctx.font = `bold ${15 * u}px "Segoe UI",sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', cx, cy + 1 * u);
        break;
      }
      case 'shop': { // 商店（遮阳篷店面）
        rrect(ctx, cx - 11 * u, cy - 2 * u, 22 * u, 12 * u, 1.5 * u);
        fillStroke(ctx, '#e8d3ae', '#7c5a33', 1.8 * u);
        rrect(ctx, cx - 3.5 * u, cy + 2 * u, 7 * u, 8 * u, 1 * u); // 门
        fillStroke(ctx, '#7c5a33', null, 0);
        for (let i = 0; i < 3; i++) { // 三片红白篷
          ctx.fillStyle = i % 2 === 0 ? '#e0453a' : '#f5efe2';
          ctx.beginPath();
          ctx.arc(cx - 7.5 * u + i * 7.5 * u, cy - 2 * u, 4.4 * u, Math.PI, 0);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = '#7c5a33'; ctx.lineWidth = 1.6 * u;
        ctx.beginPath(); ctx.moveTo(cx - 12 * u, cy - 2 * u); ctx.lineTo(cx + 12 * u, cy - 2 * u); ctx.stroke();
        break;
      }
      case 'chest': { // 宝箱
        rrect(ctx, cx - 11 * u, cy - 3 * u, 22 * u, 12 * u, 2 * u);
        fillStroke(ctx, '#8a5a2b', '#4a2f12', 1.8 * u);
        rrect(ctx, cx - 11 * u, cy - 10 * u, 22 * u, 8 * u, 3 * u);
        fillStroke(ctx, '#a86e38', '#4a2f12', 1.8 * u);
        rrect(ctx, cx - 2.2 * u, cy - 4 * u, 4.4 * u, 5.5 * u, 1 * u);
        fillStroke(ctx, '#f5c542', '#a8791b', 1.2 * u);
        break;
      }
      case 'rations': { // 面包
        ctx.beginPath(); ctx.ellipse(cx, cy + 1 * u, 11 * u, 7 * u, 0, 0, TAU);
        fillStroke(ctx, '#d9a05b', '#8a5a2b', 1.8 * u);
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 1.6 * u;
        ctx.beginPath(); ctx.moveTo(cx - 4 * u, cy - 3 * u); ctx.lineTo(cx - 1 * u, cy - 1 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 1 * u, cy - 3 * u); ctx.lineTo(cx + 4 * u, cy - 1 * u); ctx.stroke();
        break;
      }
      case 'key': { // 钥匙
        ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 2.6 * u; ctx.lineCap = 'round';
        circle(ctx, cx - 6 * u, cy - 3 * u, 4.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - 2 * u, cy - 0.5 * u); ctx.lineTo(cx + 10 * u, cy + 3 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 5 * u, cy + 1.5 * u); ctx.lineTo(cx + 4 * u, cy + 5.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 8.5 * u, cy + 2.7 * u); ctx.lineTo(cx + 7.5 * u, cy + 6.7 * u); ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'emergencyExit': { // 紧急撤离（绿色圆牌 + 出箭头）
        circle(ctx, cx, cy, 11 * u); fillStroke(ctx, '#2f9e44', '#1b6b2c', 2 * u);
        ctx.strokeStyle = '#eaffef'; ctx.lineWidth = 2.4 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy); ctx.lineTo(cx + 5 * u, cy); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + 5.5 * u, cy);
        ctx.lineTo(cx + 1.5 * u, cy - 3.5 * u);
        ctx.moveTo(cx + 5.5 * u, cy);
        ctx.lineTo(cx + 1.5 * u, cy + 3.5 * u);
        ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      case 'door': { // 拱门（出口门为绿色 + 出箭头）
        const col = def.exit ? '#52d273' : '#c9b28a';
        const stk = def.exit ? '#2e7d43' : '#6b5a3a';
        ctx.beginPath();
        ctx.moveTo(cx - 8 * u, cy + 10 * u);
        ctx.lineTo(cx - 8 * u, cy - 1 * u);
        ctx.arc(cx, cy - 1 * u, 8 * u, Math.PI, 0);
        ctx.lineTo(cx + 8 * u, cy + 10 * u);
        ctx.closePath();
        fillStroke(ctx, col, stk, 1.8 * u);
        if (def.exit) { // 白色出箭头
          ctx.strokeStyle = '#eaffef'; ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(cx, cy + 7 * u); ctx.lineTo(cx, cy - 3 * u); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx, cy - 4 * u);
          ctx.lineTo(cx - 3.5 * u, cy - 0.5 * u);
          ctx.moveTo(cx, cy - 4 * u);
          ctx.lineTo(cx + 3.5 * u, cy - 0.5 * u);
          ctx.stroke();
          ctx.lineCap = 'butt';
        } else {
          circle(ctx, cx + 4.5 * u, cy + 4 * u, 1.3 * u); fillStroke(ctx, '#6b5a3a', null, 0);
        }
        break;
      }
      case 'altar': { // 祭坛（水晶 + 底座）
        rrect(ctx, cx - 8 * u, cy + 5 * u, 16 * u, 4.5 * u, 1.5 * u);
        fillStroke(ctx, '#6b4bb0', '#3d2a6e', 1.6 * u);
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10 * u);
        ctx.lineTo(cx + 7 * u, cy);
        ctx.lineTo(cx, cy + 6 * u);
        ctx.lineTo(cx - 7 * u, cy);
        ctx.closePath();
        fillStroke(ctx, '#c79bf7', '#7e4fd0', 1.8 * u);
        circle(ctx, cx - 2 * u, cy - 2 * u, 1.4 * u); fillStroke(ctx, '#f2e8ff', null, 0);
        break;
      }
      case 'boss': { // 骷髅
        circle(ctx, cx, cy - 2 * u, 9 * u); fillStroke(ctx, '#f0e6d2', '#6b5b4a', 1.8 * u);
        rrect(ctx, cx - 5 * u, cy + 5 * u, 10 * u, 5.5 * u, 2 * u);
        fillStroke(ctx, '#f0e6d2', '#6b5b4a', 1.6 * u);
        ctx.fillStyle = '#2b2016';
        circle(ctx, cx - 3.5 * u, cy - 2 * u, 2 * u); ctx.fill();
        circle(ctx, cx + 3.5 * u, cy - 2 * u, 2 * u); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 1 * u); ctx.lineTo(cx - 1.5 * u, cy + 3.5 * u); ctx.lineTo(cx + 1.5 * u, cy + 3.5 * u);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#6b5b4a'; ctx.lineWidth = 1 * u;
        ctx.beginPath(); ctx.moveTo(cx, cy + 6 * u); ctx.lineTo(cx, cy + 9.5 * u); ctx.stroke();
        break;
      }
      case 'entrance': { // 入口旗帜
        ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 2.4 * u;
        ctx.beginPath(); ctx.moveTo(cx - 6 * u, cy - 11 * u); ctx.lineTo(cx - 6 * u, cy + 11 * u); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - 5 * u, cy - 10 * u);
        ctx.lineTo(cx + 10 * u, cy - 5.5 * u);
        ctx.lineTo(cx - 5 * u, cy - 1 * u);
        ctx.closePath();
        fillStroke(ctx, '#52d273', '#2e7d43', 1.6 * u);
        break;
      }
    }
  }

  const isCurLayer = (game, li) => li === game.layerIdx;
  const nodeRadius = (n) => n.li === -1 ? (n.def.type === 'altar' ? ALTAR_R : BOSS_R) : NODE_R;

  /* ============ 结点位图图标（assets/icons，惰性加载；未就绪回退简笔画） ============
   * 物资拾获（币/木材/口粮）合并用随机事件图标；环间门与出口门合并用同一张门。
   * 出生入口没有位图，恒用简笔画旗帜。 */
  const BITMAP_SRC = {
    battle: 'battle', event: 'event', coin: 'event', wood: 'event', rations: 'event',
    shop: 'shop', fire: 'fire', chest: 'chest', key: 'key',
    emergencyExit: 'extract', door: 'door', altar: 'altar', boss: 'boss',
    entrance: 'entrance', player: 'player',
  };
  const bitmapCache = {};
  function bitmapFor(type) {
    const name = BITMAP_SRC[type];
    if (!name) return null;
    let e = bitmapCache[name];
    if (!e) {
      e = bitmapCache[name] = { img: new Image(), ok: false };
      e.img.onload = () => { e.ok = true; };
      e.img.src = 'assets/icons/' + name + '.png';
    }
    return e.ok ? e.img : null;
  }
  // 画圆形位图结点：深色圆底 + 圆形裁剪位图 + 层色描边；无位图返回 false 由调用方回退
  function drawBitmapIcon(ctx, type, cx, cy, R, cur, z) {
    const img = bitmapFor(type);
    if (!img) return false;
    ctx.fillStyle = '#1d1c1a';
    circle(ctx, cx, cy, R);
    ctx.fill();
    ctx.save();
    circle(ctx, cx, cy, R * 0.97);
    ctx.clip();
    ctx.drawImage(img, cx - R * 0.91, cy - R * 0.91, R * 1.82, R * 1.82);
    ctx.restore();
    ctx.strokeStyle = cur ? 'rgba(235,205,140,0.5)' : 'rgba(180,160,120,0.22)';
    ctx.lineWidth = 1.6 / z;
    circle(ctx, cx, cy, R);
    ctx.stroke();
    return true;
  }

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
    // 呼吸光圈（椭圆，贴地）
    const pulse = (Math.sin(game.time * 3.2) + 1) / 2;
    ctx.strokeStyle = `rgba(240,200,110,${(0.34 - pulse * 0.18).toFixed(3)})`;
    ctx.lineWidth = 2 / z;
    ctx.beginPath();
    ctx.ellipse(px, groundY + s * 0.14, s * (0.68 + pulse * 0.1), s * (0.23 + pulse * 0.03), 0, 0, TAU);
    ctx.stroke();
    // —— 当前位置：青色定位针（位图优先，针尖落在脚下；无位图回退木棋子） ——
    const pinSize = T0 * 1.7;
    const hopLift = game.hop * T0 * 0.35;   // 步行跳跃的抬升
    const pinImg = bitmapFor('player');
    if (pinImg) {
      ctx.drawImage(pinImg, px - pinSize / 2, groundY - pinSize * 0.94 - hopLift, pinSize, pinSize);
    } else {
      const ink = 'rgba(43,28,16,0.9)';
      const gy = groundY - hopLift;
      ctx.fillStyle = '#6b4a26';
      ctx.beginPath(); ctx.ellipse(px, gy, s * 0.46, s * 0.17, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 1.4 / z; ctx.stroke();
      const bodyGrad = ctx.createLinearGradient(px - s * 0.34, 0, px + s * 0.34, 0);
      bodyGrad.addColorStop(0, '#7a5426');
      bodyGrad.addColorStop(0.42, '#c99a54');
      bodyGrad.addColorStop(0.68, '#a87838');
      bodyGrad.addColorStop(1, '#63431e');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(px - s * 0.42, gy - s * 0.02);
      ctx.bezierCurveTo(px - s * 0.3, gy - s * 0.5, px - s * 0.22, gy - s * 0.68, px - s * 0.19, gy - s * 0.92);
      ctx.lineTo(px + s * 0.19, gy - s * 0.92);
      ctx.bezierCurveTo(px + s * 0.22, gy - s * 0.68, px + s * 0.3, gy - s * 0.5, px + s * 0.42, gy - s * 0.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(43,28,16,0.85)'; ctx.lineWidth = 1.4 / z; ctx.stroke();
      const headY = gy - s * 1.06;
      const headGrad = ctx.createRadialGradient(px - s * 0.08, headY - s * 0.08, 1, px, headY, s * 0.27);
      headGrad.addColorStop(0, '#eed8a4');
      headGrad.addColorStop(0.6, '#c99a54');
      headGrad.addColorStop(1, '#7a5622');
      ctx.fillStyle = headGrad;
      ctx.beginPath(); ctx.arc(px, headY, s * 0.24, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(43,28,16,0.85)'; ctx.lineWidth = 1.4 / z; ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,225,0.7)';
      ctx.beginPath(); ctx.arc(px - s * 0.08, headY - s * 0.09, s * 0.05, 0, TAU); ctx.fill();
    }
    // 名牌胶囊（钉在定位针上方）
    const label = '你';
    ctx.font = font(cam, 10);
    const tw = ctx.measureText(label).width;
    const lw2 = tw + 12 / z, lh = 15 / z, lx = px, ly = groundY - pinSize * 1.08 - hopLift;
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

  // ---------- FX 渲染（脉冲 / 飘字 / 震屏偏移） ----------
  function shakeOffset(t) {
    let dx = 0, dy = 0;
    for (let i = FX.shakes.length - 1; i >= 0; i--) {
      const s = FX.shakes[i];
      if (s.t0 < 0) s.t0 = t;
      const k = (t - s.t0) / s.dur;
      if (k >= 1) { FX.shakes.splice(i, 1); continue; }
      const d = s.power * (1 - k);
      dx += Math.sin(t * 93) * d;
      dy += Math.cos(t * 81) * d;
    }
    return [dx, dy];
  }

  function drawFX(ctx, game) {
    const z = game.cam.zoom, t = game.time;
    // 落点脉冲
    for (let i = FX.pulses.length - 1; i >= 0; i--) {
      const p = FX.pulses[i];
      if (p.t0 < 0) p.t0 = t;
      const k = (t - p.t0) / p.dur;
      if (k >= 1) { FX.pulses.splice(i, 1); continue; }
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.lineWidth = 2.5 / z * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, T0 * (0.3 + k * 0.75), 0, TAU); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.22;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, T0 * (0.3 + k * 0.75), 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 飘字
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = FX.floats.length - 1; i >= 0; i--) {
      const f = FX.floats[i];
      if (f.t0 < 0) f.t0 = t;
      const k = (t - f.t0) / f.dur;
      if (k >= 1) { FX.floats.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - k, 3);
      ctx.font = `800 ${(f.big ? 26 : 19) / z}px "Segoe UI","Microsoft YaHei",sans-serif`;
      ctx.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
      const y = f.y - T0 * (0.5 + ease * 0.95);
      ctx.lineWidth = 5.5 / z;
      ctx.strokeStyle = 'rgba(5,8,12,0.85)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
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
    // 壁纸视频整层铺底，未就绪时回退纯色；原 bg 渐变降为 50% 遮罩保证结点可读
    ctx.fillStyle = '#0B0E12';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    drawCover(ctx, environmentBackdrop, cam.viewW, cam.viewH);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = grads.bg;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    ctx.restore();

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
})();
