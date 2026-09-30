import { esc } from '../core/shared.js';
import { NODE_INFO } from '../core/node-info.js';

// Exploration presentation only. Legal edges and outcomes remain owned by the run flow.
export function expeditionRoutes(game) {
  const li = game.layerIdx;
  const layer = game.layerData?.[li];
  const current = layer?.logical?.[game.trackPos];
  const unique = new Set();
  const routes = (current?.next || []).flatMap(([nl, idx]) => {
    const cell = layer?.logical?.[idx];
    if (nl !== li || !cell || unique.has(idx)) return [];
    unique.add(idx);
    const door = layer.doors?.find(d => d.at === idx);
    const type = door ? 'door' : cell.def?.type;
    const [name, hint, icon, tone] = NODE_INFO[type] || ['安全节点', '继续探明周围的路线', 'map', 'quiet'];
    const plan=game.routePlan?.status==='applied' && game.routePlan.layerIndex===li && current.id===game.routePlan.startNodeId ? game.routePlan : null;
    const role=plan && cell.id===plan.supplyNodeId?'supply':plan && cell.id===plan.riskNodeId?'risk':null;
    const routeName=role==='supply'?'补给支路 · 物资点':role==='risk'?'交战支路 · 遭遇战':name;
    const routeHint=role==='supply'?'已知物资节点 · 具体收获进入后决定':role==='risk'?'已知战斗风险 · 胜利后按现有规则结算':hint;
    const cleared = !!game.visited?.[`${li},${idx}`] &&
      !door && !['entrance', 'emergencyExit', 'extraction', 'altar', 'boss'].includes(type);
    return [{ li, idx, baseName: routeName, name:routeName, icon, tone: cleared ? 'quiet' : tone,
      door: !!(door && !door.reverse),   // W1-10：前进层间闸门卡给专属高亮钩子
      hint: cleared ? '已探索 · 可通行，物资不再刷新' : door?.reverse ? '返回上一片区域' : routeHint,
      cleared, selected: game.moveTarget?.li === li && game.moveTarget?.idx === idx }];
  });
  // 同一屏可能有多条同类型路线（例如两个相邻遭遇战）。只显示“遭遇战”会让
  // 视觉和读屏用户无法确认自己选的是哪个节点；为重复名称补稳定的路线序号，
  // 同时保留 idx 作为唯一动作键，确保展示名称与实际节点一一对应。
  const sameNameCount = new Map();
  routes.forEach(route => sameNameCount.set(route.baseName, (sameNameCount.get(route.baseName) || 0) + 1));
  const sameNameSeen = new Map();
  return routes.map(route => {
    const count = sameNameCount.get(route.baseName) || 0;
    const ordinal = (sameNameSeen.set(route.baseName, (sameNameSeen.get(route.baseName) || 0) + 1).get(route.baseName));
    const label = count > 1 ? `${route.baseName} · 路线${ordinal}` : route.baseName;
    return { ...route, name: label, ariaLabel: `${label}（节点 ${route.idx + 1}）` };
  });
}

export function expeditionObjective(game) {
  if (game.hp > 0 && game.hp / game.maxHp <= .25) return { tone: 'danger', text: '生命危急 · 留意火堆与治疗补给' };
  if (game.layerIdx === 2) return { tone: 'safe', text: '撤离已开放 · 找到信标，献祭 3 张卡牌' };
  if (game.layerIdx >= 3) return { tone: 'gold', text: game.bossKilled ? '首脑已击破 · 前往终局撤离点' : '最终区域 · 经祭坛挑战首脑' };
  // W1-10（2026-09-27 R2）：闸门方向信号。此前目标文案零导航信息（评审三轮走查
  // 「只见相邻类型」）。读层门派生数据算最近前进闸门的方位角+直线步数——纯信息
  // 呈现：门节点本就随地图持久渲染（renderer PERSISTENT_TYPES），不给自动寻路、不揭迷雾。
  const layer = game.layerData?.[game.layerIdx];
  const gates = (layer?.doors || []).filter(d => !d.exit);
  const pos = game.nodePos?.[game.layerIdx]?.[game.trackPos];
  if (gates.length && pos) {
    let best = null;
    for (const d of gates) {
      const p = game.nodePos[game.layerIdx][d.at];
      if (!p) continue;
      const dist = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (!best || dist < best.dist) best = { dist, dx: p.x - pos.x, dy: p.y - pos.y };
    }
    if (best) {
      // 屏幕坐标 y 向下：atan2(dy, dx) 0=东、π/4=东南（顺时针），八方位取整。
      // 实测对账修正过一次参数序反转（门在东南被报成北）——以 raw dx/dy 对拍为准。
      const DIRS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'];
      const dir = DIRS[((Math.round(Math.atan2(best.dy, best.dx) / (Math.PI / 4)) % 8) + 8) % 8];
      const steps = Math.max(1, Math.round(best.dist / 120));   // 120 = game.session.map MAP_NODE_SPACING 同值
      return { tone: 'gold', text: `下一层闸门在${dir}方向 · 直线约 ${steps} 格 · 沿路搜集补给` };
    }
  }
  return { tone: 'quiet', text: '搜集补给，寻找通往下一层的闸门' };
}

export function renderExpeditionPanel(panel, game, iconHTML) {
  if (!panel || !game.runActive) return;
  const routes = expeditionRoutes(game);
  const objective = expeditionObjective(game);
  const disabled = game.state !== 'idle';
  const chapter = panel.ownerDocument.getElementById('expeditionChapter');
  const chapterKey = `${game.layerIdx}:${game.trackPos}:${Object.keys(game.seen || {}).length}`;
  if (chapter && chapter.dataset.viewKey !== chapterKey) {
    chapter.dataset.viewKey = chapterKey;
    const names = (game.layerData || []).map((layer, i) => layer.name || `第 ${i + 1} 层`);
    chapter.innerHTML = `<div class="chapter-kicker">EXPEDITION / ${String(game.layerIdx + 1).padStart(2, '0')}</div><ol>${names.map((name, i) => `<li class="${i === game.layerIdx ? 'current' : i < game.layerIdx ? 'passed' : ''}" ${i === game.layerIdx ? 'aria-current="step"' : ''}><span>0${i + 1}</span>${esc(name)}</li>`).join('')}</ol>`;
  }
  // Stable markup while state is unchanged preserves keyboard focus and avoids DOM churn.
  // 差分键用原始值拼接（09-30 性能审计 F8）：本函数挂在 UI.refresh，战斗中每次渲染都会跑，
  // 此前每次对路线数组做一遍 JSON.stringify——面板被战斗盖住时纯粹白烧
  const key = `${disabled ? 1 : 0}|${objective.tone}|${objective.text}|${routes.map(r => r.idx).join(',')}`;
  if (panel.dataset.viewKey === key) return;
  panel.dataset.viewKey = key;
  const active = panel.ownerDocument.activeElement?.dataset.routeIndex;
  const title = panel.querySelector('.route-title');
  const note = panel.querySelector('.route-objective');
  const options = panel.querySelector('.route-options');
  if (!title || !note || !options) return;
  title.textContent = disabled ? '行动进行中' : `下一步 · ${routes.length} 条路线`;
  note.textContent = objective.text;
  note.dataset.tone = objective.tone;
  options.innerHTML = routes.map(r => `<button type="button" class="route-option${r.selected ? ' selected' : ''}" data-route-index="${r.idx}" data-route-layer="${r.li}" data-tone="${r.tone}"${r.door ? ' data-door="1"' : ''} aria-label="${esc(r.ariaLabel || `${r.name}（节点 ${r.idx + 1}）`)}" ${disabled ? 'disabled' : ''}>
    <span class="route-icon" aria-hidden="true">${iconHTML(r.icon)}</span>
    <span class="route-copy"><b>${esc(r.name)}</b><small>${esc(r.hint)}</small></span>
    <span class="route-arrow" aria-hidden="true">↗</span>
  </button>`).join('');
  if (!routes.length) options.innerHTML = '<span class="route-empty">当前没有相邻路线，请检查本节点的事件。</span>';
  if (active != null) options.querySelector(`[data-route-index="${active}"]`)?.focus({ preventScroll: true });
}
