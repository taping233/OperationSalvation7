/* ============================================================
 * renderer.icons.js —— 结点图标绘制
 *
 * 只被 renderer.js 调用，不触碰 SDT 命名空间。
 * 2026-09-29 死代码清理（knip A 类批，老板批）：移除简笔画回退
 * （drawIcon/drawFlame）与位图圆形结点管线（drawBitmapIcon/
 * bitmapFor/bakedIconFor）——renderer.js 自地图视觉简化后仅走
 * drawTacticalIcon 线性符号路径（renderer.js:318），位图管线全仓
 * 零读者；assets/icons/ 下 battle.png/chest.png 等 NAI 位图随之
 * 成为孤儿资产，处置另议（见 docs/PENDING.md）。
 * ============================================================ */

const TAU = Math.PI * 2;
const NO_DASH = [];   // 还原实线（空点划常量，复用避免逐帧分配）

// 战术地图线性符号：小尺寸下保持清晰，不加载位图也不依赖圆形底板。
function drawTacticalIcon(ctx, type, cx, cy, u, color) {
  const c = color || '#d7e6e8';
  ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = Math.max(1.4, 1.9 * u); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = 8 * u;
  switch (type) {
    case 'battle':
      ctx.beginPath(); ctx.moveTo(cx-s,cy-s); ctx.lineTo(cx+s,cy+s); ctx.moveTo(cx+s,cy-s); ctx.lineTo(cx-s,cy+s); ctx.stroke(); break;
    case 'coin': case 'wood': case 'rations': case 'chest': case 'key':
      ctx.beginPath(); ctx.moveTo(cx,cy-s-2*u); ctx.lineTo(cx+s+2*u,cy); ctx.lineTo(cx,cy+s+2*u); ctx.lineTo(cx-s-2*u,cy); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx-3*u,cy); ctx.lineTo(cx+3*u,cy); ctx.stroke(); break;
    case 'fire': case 'emergencyExit': case 'extraction': case 'entrance':
      ctx.beginPath(); ctx.moveTo(cx,cy-s-2*u); ctx.lineTo(cx+s,cy+s); ctx.lineTo(cx-s,cy+s); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx,cy+s); ctx.lineTo(cx,cy-s/2); ctx.stroke(); break;
    case 'shop':
      ctx.strokeRect(cx-s,cy-2*u,s*2,10*u); ctx.beginPath(); ctx.moveTo(cx-s-2*u,cy-2*u); ctx.lineTo(cx+s+2*u,cy-2*u); ctx.moveTo(cx,cy-2*u); ctx.lineTo(cx,cy+8*u); ctx.stroke(); break;
    case 'altar': case 'event':
      ctx.beginPath(); ctx.arc(cx,cy,7*u,0,TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx,cy-4*u); ctx.lineTo(cx,cy+4*u); ctx.moveTo(cx-3*u,cy+1*u); ctx.lineTo(cx+3*u,cy+1*u); ctx.stroke(); break;
    case 'boss':
      ctx.beginPath(); ctx.moveTo(cx,cy-s); ctx.lineTo(cx+s,cy); ctx.lineTo(cx,cy+s); ctx.lineTo(cx-s,cy); ctx.closePath(); ctx.stroke(); ctx.fillRect(cx-1.3*u,cy-1.3*u,2.6*u,2.6*u); break;
    case 'blank': { // 已消耗的空节点（2026-09-13 老板留言）：虚线空环 + 中心空点，读作「格子还在、内容已取走」
      ctx.save();
      ctx.lineWidth = Math.max(1.2, 1.5 * u);
      ctx.setLineDash([2.4 * u, 2.6 * u]);
      ctx.beginPath(); ctx.arc(cx, cy, s, 0, TAU); ctx.stroke();
      ctx.setLineDash(NO_DASH);
      ctx.beginPath(); ctx.arc(cx, cy, 1.7 * u, 0, TAU); ctx.stroke();
      ctx.restore();
      break;
    }
    default:
      ctx.beginPath(); ctx.arc(cx,cy,6*u,0,TAU); ctx.stroke();
  }
  ctx.restore();
}

export { drawTacticalIcon };
