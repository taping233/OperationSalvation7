/* ============================================================
 * renderer.icons.js —— 结点图标绘制
 *
 * 从 renderer.js 拆出：简笔画卡通图标（drawIcon / drawFlame，位图
 * 未就绪时的回退）与 SVG 位图圆形结点（drawBitmapIcon，惰性加载）。
 * 只被 renderer.js 调用，不触碰 SDT 命名空间。
 * ============================================================ */
import { assetUrl } from './asset-url.js';
import { circle, fillStroke, rrect } from './renderer.primitives.js';

const TAU = Math.PI * 2;

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
        ctx.font = `bold ${15 * u}px "Cascadia Code","Noto Sans SC Sub",sans-serif`;
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

  /* ============ 结点 SVG 图标（assets/icons，惰性加载；未就绪回退简笔画） ============
   * 物资拾获（币/木材/口粮）合并用随机事件图标；环间门与出口门合并用同一张门。 */
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
      e.img.src = assetUrl('assets/icons/' + name + '.svg');
    }
    return e.ok ? e.img : null;
  }
  // 画圆形 SVG 结点：深色圆底 + 圆形裁剪图标 + 层色描边；未就绪时返回 false 由调用方回退
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

export { drawFlame, drawIcon, drawBitmapIcon };
