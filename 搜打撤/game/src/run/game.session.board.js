/* game.session.board.js —— 战争迷雾与底栏迷你地图（自 game.session.js 拆出，2026-09-25）。
 * markSeen 揭开当前节点与相邻节点；renderMiniMap 事件驱动重绘（markSeen/换层/窗口变化），
 * 不逐帧渲染。只依赖内核（game），被开局/读档流程与 game.boot 消费。 */
import { game } from './game.session.kernel.js';

// 战争迷雾可见集：到达节点 = 该节点 + 其相邻节点变为可见（走过的路径天然保留在 seen 里）
export function markSeen(li, idx) {
  if (!game.seen) game.seen = {};
  const ld = game.layerData?.[li];
  const cur = ld?.logical?.[idx];
  if (!cur) return;
  game.seen[li + ',' + idx] = 1;
  for (const [nl, ni] of (cur.next || [])) {
    if (nl === li) game.seen[nl + ',' + ni] = 1;
  }
  renderMiniMap();   // 底栏简图只在解锁新区域时重绘，平时保持原样（2026-09-09 老板定向）
}

// 底栏迷你地图：只画迷雾内（走过的 + 相邻可走）的节点与连线，当前节点金圈、
// 可走相邻亮环。事件驱动重绘（markSeen / 换层时调用），不逐帧重绘。
const MINI_TYPE_COLOR = {
  battle: '#ff6b5e', fire: '#f2854a', chest: '#f5c542', event: '#41d0a8',
  shop: '#52d273', key: '#f5c542', coin: '#f5c542', wood: '#c8956a',
  rations: '#7fdd9c', door: '#c9b28a', entrance: '#52d273',
  extraction: '#52d273', emergencyExit: '#52d273', altar: '#b77ad8', boss: '#ff5a50',
};
export function renderMiniMap() {
  const cv = document.getElementById('miniMap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  // 内部分辨率跟随 CSS 显示尺寸（dpr 缩放），内部/显示比例一致才不会拉伸变形
  const rect = cv.getBoundingClientRect();
  // A 1px backing canvas created while the sidebar is hidden becomes a stretched gold block.
  if (rect.width < 2 || rect.height < 2) return;
  const dpr = window.devicePixelRatio || 1;
  const W = Math.max(1, Math.round(rect.width * dpr));
  const H = Math.max(1, Math.round(rect.height * dpr));
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  ctx.clearRect(0, 0, W, H);
  const li = game.layerIdx;
  const ld = game.layerData?.[li];
  const pts = game.nodePos?.[li];
  if (!ld || !pts?.length) return;
  const seen = game.seen || {};
  const seenAt = (i) => seen[li + ',' + i] === 1;
  // 只框定已揭开的地图，未知远端不应把当前路线挤成角落里的几个像素。
  const revealed = pts.filter((_, i) => seenAt(i) || i === game.trackPos);
  if (!revealed.length) return;
  const minX = Math.min(...revealed.map(p => p.x)), maxX = Math.max(...revealed.map(p => p.x));
  const minY = Math.min(...revealed.map(p => p.y)), maxY = Math.max(...revealed.map(p => p.y));
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const pad = Math.min(W, H) * 0.16;
  const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * s) / 2, oy = (H - spanY * s) / 2;
  const px = (i) => ox + (pts[i].x - minX) * s;
  const py = (i) => oy + (pts[i].y - minY) * s;
  const nodeR = Math.max(5, Math.min(W, H) * 0.055);   // 圆点尺寸随画布自适应
  // 当前节点的相邻（可走）集合
  const curCell = ld.logical[game.trackPos];
  const legal = new Set((curCell?.next || []).filter(([nl]) => nl === li).map(([, ni]) => ni));
  // 连线：两端都已解锁的边
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(214,181,110,0.4)';
  ld.logical.forEach((cell, i) => {
    if (!seenAt(i)) return;
    for (const [nl, ni] of (cell.next || [])) {
      if (nl !== li || ni <= i || !seenAt(ni)) continue;
      ctx.beginPath();
      ctx.moveTo(px(i), py(i));
      ctx.lineTo(px(ni), py(ni));
      ctx.stroke();
    }
  });
  // 当前节点 → 可走相邻的亮边
  ctx.strokeStyle = 'rgba(255,202,91,0.95)';
  ctx.lineWidth = nodeR * 0.42;
  for (const ni of legal) {
    if (!seenAt(ni)) continue;
    ctx.beginPath();
    ctx.moveTo(px(game.trackPos), py(game.trackPos));
    ctx.lineTo(px(ni), py(ni));
    ctx.stroke();
  }
  // 节点圆点：当前金圈最大、可走次之、走过的半透明
  ld.logical.forEach((cell, i) => {
    if (!seenAt(i)) return;
    const col = MINI_TYPE_COLOR[cell.def?.type] || '#d8b46a';
    const isCur = i === game.trackPos;
    const isLegal = legal.has(i);
    ctx.globalAlpha = isCur || isLegal ? 1 : 0.62;
    ctx.beginPath();
    ctx.arc(px(i), py(i), isCur ? nodeR : nodeR * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    if (isLegal && !isCur) { ctx.strokeStyle = 'rgba(255,214,110,0.95)'; ctx.lineWidth = nodeR * 0.3; ctx.stroke(); }
    if (isCur) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = nodeR * 0.36; ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
}
// 窗口尺寸变化后按新容器尺寸重绘一次（仍是事件驱动，不逐帧）
window.addEventListener('resize', () => { if (game.runActive) renderMiniMap(); });
