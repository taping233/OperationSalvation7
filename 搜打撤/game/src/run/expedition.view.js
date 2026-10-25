import { esc } from '../core/shared.js';
import { expeditionToolArt } from './expedition-tool-art.js';
import '../../css/map-floating-tools.css';
import '../../css/run-experience.css';
import { previousRoutePlan, routeChoicePreview } from './route-choice-preview.js';
import { mapNodeInfo } from '../core/node-info.js';
import { isConsumedMapNode, mapNodeStatus } from '../core/map-node-state.js';
import '../../css/map-node-status.css';
import { mapNodeArtHTML, mapNodeIconDataUrl } from '../core/map-node-art.js';
import { findMapTravelPath, getMapTravelPresentation } from './map-travel-path.js';
export { findMapTravelPath, getMapTravelPresentation, mapTravelCurve, mapTravelPoint } from './map-travel-path.js';

// Preview belongs to the current map position, not the saved route or movement state.
const expeditionPreviews = new WeakMap();
export function setExpeditionPreview(game, node) {
  if (!node) { expeditionPreviews.delete(game); return; }
  expeditionPreviews.set(game, { li: node.li, idx: node.idx, layerIdx: game.layerIdx, trackPos: game.trackPos });
}
export function getExpeditionPreview(game) {
  const preview = expeditionPreviews.get(game);
  return preview?.layerIdx === game.layerIdx && preview?.trackPos === game.trackPos ? preview : null;
}

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
    const cleared = isConsumedMapNode(game, { li, idx, def: cell.def });
    const content = mapNodeStatus(game, { li, idx, def:cell.def });
    const [name, hint, icon, tone] = mapNodeInfo(game, { li, idx, def:cell.def }, content);
    const previous=previousRoutePlan(game);
    const plan=previous?.status==='applied' && previous.layerIndex===li && current.id===previous.startNodeId ? previous : null;
    const choice=routeChoicePreview(game,{li,idx},content.id);
    const role=!cleared && plan && cell.id===plan.supplyNodeId?'supply':!cleared && plan && cell.id===plan.riskNodeId?'risk':null;
    const routeName=choice?.name || (role==='supply'?'补给支路 · 物资点':role==='risk'?'交战支路 · 遭遇战':name);
    const routeHint=role==='supply'?'已知物资节点 · 具体收获进入后决定':role==='risk'?'已知战斗风险 · 胜利后按现有规则结算':hint;
    return [{ li, idx, baseName: routeName, name:routeName, choiceHint:choice?.hint || null, icon, tone: cleared ? 'quiet' : tone,
      door: !!(door && !door.reverse),   // W1-10：前进层间闸门卡给专属高亮钩子
      hint: content.id === 'pending' ? hint : cleared ? hint : door?.reverse ? '返回上一片区域' : routeHint,
      direction: door ? (door.reverse ? 'return' : 'deeper') : cleared ? 'return' : 'explore',
      contentState:content.id, contentLabel:content.label, cleared, selected: (getExpeditionPreview(game) || game.moveTarget)?.li === li &&
        (getExpeditionPreview(game) || game.moveTarget)?.idx === idx }];
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
    return { ...route, name: label, ariaLabel: `${label}（节点 ${route.idx + 1}）${route.contentLabel ? ` · ${route.contentLabel}` : ''}` };
  });
}

export function expeditionObjective(game) {
  if (game.layerIdx >= 3 && game.bossKilled) return { tone: 'gold', text: '首脑已击破 · 前往终局撤离点，完成通关' };
  if (game.hp > 0 && game.hp / game.maxHp <= .25) return { tone: 'danger', text: '生命危急 · 留意火堆与治疗补给' };
  if (game.layerIdx === 2) return { tone: 'safe', text: '献祭 3 张卡牌可紧急撤离 · 或经闸门深入第四层，挑战首脑' };
  if (game.layerIdx >= 3) {
    if (!game.altarActivated) return { tone: 'gold', text: '最终区域 · 前往祭坛，弃 3 张卡牌解锁首脑' };
    if (game.altarRewardPending) return { tone: 'gold', text: '祭坛已激活 · 返回祭坛领取奖励，再挑战首脑' };
    return { tone: 'gold', text: '祭坛已激活 · 前往首脑巢穴，编组牌库迎战' };
  }
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
      const steps = Math.max(1, Math.round(best.dist / 180));   // 180 = game.session.map MAP_NODE_SPACING 同值
      return { tone: 'gold', text: `下一层闸门在${dir}方向 · 直线约 ${steps} 格 · 沿路搜集补给` };
    }
  }
  return { tone: 'quiet', text: '搜集补给，寻找通往下一层的闸门' };
}

export function clearExpeditionPanel(doc = document) {
  const sidebar = doc.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.querySelector('.expedition-nav-summary')?.remove();
  sidebar.querySelector('.expedition-map-preview')?.remove();
  if (sidebar.dataset.expeditionLayout !== 'map') sidebar.dataset.expeditionLayout = 'map';
  if (!sidebar.hidden) sidebar.hidden = true;
}

export function renderExpeditionPanel(panel, game, iconHTML) {
  const doc = panel?.ownerDocument || document;
  const overlay = doc.getElementById('overlay');
  const mapVisible = game.runActive && !game.battleActive && ['idle','moving'].includes(game.state)
    && (!overlay || overlay.hidden) && !doc.body?.classList.contains('lobby');
  if (!mapVisible) { clearExpeditionPanel(doc); return; }
  const sidebar = panel?.closest('#sidebar') || doc.getElementById('sidebar');
  if (sidebar) {
    if (sidebar.hidden) sidebar.hidden = false;
    sidebar.dataset.expeditionLayout = 'map';
    const log = doc.getElementById('logPanel');
    if (log && log.parentElement !== sidebar) sidebar.append(log);
    let summary = sidebar.querySelector('.expedition-nav-summary');
    if (!summary) {
      summary = doc.createElement('section');
      summary.className = 'expedition-nav-summary';
      sidebar.append(summary);
    }
    const used = game.usedSlots?.() ?? game.inventory?.length ?? 0;
    const cap = game.bagCap?.() ?? game.map?.rules?.bagSize ?? 0;
    const safe = game.safeUsed?.() ?? 0;
    const safeCap = game.safeCap?.() ?? 0;
    const pocket = (game.usedPocket || []).reduce((n, item) => n + (item.count || 0), 0);
    const disabled = game.state !== 'idle';
    const keyLabel = (action, fallback) => window.SDT?.Input?.bindingLabel?.(action) ?? fallback;
    const bagKey=keyLabel('backpack','B'), focusKey=keyLabel('camFocus','F'), overviewKey=keyLabel('camOverview','G');
    const toolbarKey = `${used}:${cap}:${safe}:${safeCap}:${pocket}:${disabled}:${bagKey}:${focusKey}:${overviewKey}`;
    const capacityState = used >= cap ? 'full' : used / Math.max(1, cap) >= .75 ? 'tight' : used ? 'ready' : 'empty';
    const capacityFill = Math.max(0, Math.min(100, used / Math.max(1, cap) * 100));
    if (summary.dataset.toolbarKey !== toolbarKey) {
      summary.dataset.toolbarKey = toolbarKey;
      summary.innerHTML = `<nav class="expedition-toolbar" aria-label="远征工具">
        <div class="expedition-tool-group" role="group" aria-label="携行物资">
          <button type="button" data-expedition-tool="bag" data-capacity-state="${capacityState}" aria-label="背包：占格 ${used}/${cap}，${capacityState === 'full' ? '已满' : `余 ${Math.max(0, cap - used)} 格`}" ${disabled ? 'disabled' : ''}>${expeditionToolArt('bag')}<span class="expedition-tool-copy"><span>背包</span><strong>${used}<small>/${cap}</small></strong><span class="expedition-bag-capacity" aria-hidden="true"><i style="width:${capacityFill}%"></i></span></span><kbd>${esc(bagKey)}</kbd></button>
          <button type="button" data-expedition-tool="safe" aria-label="安全格：保护物资 ${safe}/${safeCap}" ${disabled ? 'disabled' : ''}>${expeditionToolArt('safe')}<span class="expedition-tool-copy"><span>安全格</span><strong>${safe}<small>/${safeCap}</small></strong></span></button>
          <button type="button" data-expedition-tool="pocket" aria-label="消耗区：已消耗卡牌 ${pocket}" ${disabled ? 'disabled' : ''}>${expeditionToolArt('pocket')}<span class="expedition-tool-copy"><span>消耗区</span><strong>${pocket}</strong></span></button>
        </div>
        <div class="expedition-tool-group expedition-view-tools" role="group" aria-label="地图视野">
          <button type="button" class="map-view-tool" data-expedition-tool="focus" title="回到当前位置与相邻路线 · ${esc(focusKey)}" aria-label="定位：当前位置与相邻路线" ${disabled ? 'disabled' : ''}>${expeditionToolArt('focus')}<span class="expedition-tool-copy">定位</span><kbd>${esc(focusKey)}</kbd></button>
          <button type="button" class="map-view-tool" data-expedition-tool="overview" title="查看整层路线，未探明地点仅显示剪影 · ${esc(overviewKey)}" aria-label="全景：整层路线，未知地点保留迷雾" ${disabled ? 'disabled' : ''}>${expeditionToolArt('overview')}<span class="expedition-tool-copy">全景</span><kbd>${esc(overviewKey)}</kbd></button>
        </div>
      </nav>`;
    }

  }
  const chapter = doc.getElementById('expeditionChapter');
  const chapterKey = `${game.layerIdx}:${game.trackPos}:${Object.keys(game.seen || {}).length}`;
  if (chapter && chapter.dataset.viewKey !== chapterKey) {
    chapter.dataset.viewKey = chapterKey;
    const names = (game.layerData || []).map((layer, i) => layer.name || `第 ${i + 1} 层`);
    const currentName = names[game.layerIdx] || `第 ${game.layerIdx + 1} 层`;
    chapter.innerHTML = `<b class="chapter-name">${esc(currentName.replace(/^第\s*\d+\s*层\s*[·・/—-]?\s*/, ''))}</b><small class="chapter-phase">第 ${game.layerIdx + 1} 层 <span>/ ${names.length}</span></small>`;
  }
  if (!sidebar) return;
  let strip = sidebar.querySelector('.expedition-map-preview');
  if (!strip) {
    strip = doc.createElement('section');
    strip.className = 'expedition-map-preview';
    strip.setAttribute('aria-live', 'polite');
    sidebar.append(strip);
  }
  const travel = getMapTravelPresentation(game);
  const moving = travel?.phase === 'moving';
  const preview = travel?.path?.at(-1) || getExpeditionPreview(game) || (game.moveTarget && !game.moveTarget.moving ? game.moveTarget : null);
  const selectedNode = preview && game.nodes?.find(n => n.li === preview.li && n.idx === preview.idx);
  const route = preview && expeditionRoutes(game).find(r => r.li === preview.li && r.idx === preview.idx);
  const travelPath = preview && findMapTravelPath(game, preview);
  const reachable = travelPath !== null && !!preview;
  const isCurrent = preview?.li === game.layerIdx && preview?.idx === game.trackPos;
  const selectedDoor = selectedNode && game.layerData?.[selectedNode.li]?.doors?.some(d => d.at === selectedNode.idx);
  const selectedSpent = isConsumedMapNode(game, selectedNode);
  const content = mapNodeStatus(game, selectedNode);
  const pending = content.id === 'pending';
  const completedLocal = isCurrent && !selectedDoor && ['completed','shop-closed'].includes(content.id);
  const supply = game.entrySupply;
  const selectedSupply = selectedNode && supply?.layerIdx === selectedNode.li && supply.trackPos === selectedNode.idx &&
    (supply.taken?.length || 0) < (supply.cardIds?.length || 0);
  const [nodeName, nodeHint, nodeIcon] = selectedNode
    ? mapNodeInfo(game, selectedNode, content)
    : [];
  const name = selectedSupply ? '入城补给' : route?.name || nodeName;
  const hint = route?.choiceHint || (content.label ? content.detail : route?.hint || nodeHint);
  const status = moving && preview ? `前往中 · ${Math.min(travel.segmentIndex, travel.path.length - 1)}/${travel.path.length - 1} 段` : travel?.phase === 'arrived' && isCurrent ? '已抵达' : isCurrent ? '当前位置' : reachable ? '可以前往' : '暂不可前往';
  const danger = !pending && !selectedSpent && !selectedDoor && ['battle','boss','elite','battleElite'].includes(selectedNode?.def?.type);
  const lowLife = danger && game.hp > 0 && game.hp / game.maxHp <= .25;
  const cam = game.cam;
  // Preview reserves space for future explicit framing, without moving or
  // zooming the displayed map. Travel retains ownership of its camera inset.
  if (cam?.frameMode !== 'travel') {
    cam?.setDetailInset?.(name ? cam.viewW * (570 / 1920) : 0, { deferFrame:true });
  }
  const actionLabel = completedLocal ? content.id === 'shop-closed' ? '本店交易已结束' : '本地内容已完成'
    : pending ? isCurrent ? '继续领奖' : '前往领奖'
      : isCurrent && selectedDoor ? '查看闸门'
        : content.id === 'shop-open' ? isCurrent ? '进入商店' : '前往商店'
          : isCurrent ? '查看本地内容' : '进入该地点';
  const key = JSON.stringify([game.state, preview?.li, preview?.idx, route?.name, name, hint, status, content.id, content.detail, actionLabel, danger, lowLife, completedLocal]);
  if (strip.dataset.viewKey === key) return;
  strip.dataset.viewKey = key;
  strip.dataset.nodeState = moving && preview ? 'moving' : isCurrent ? 'current' : reachable ? 'reachable' : 'unreachable';
  strip.dataset.contentState = content.id;
  strip.hidden = !name;
  strip.dataset.nodeTone = danger ? 'danger' : 'neutral';
  strip.setAttribute('aria-label', selectedSupply ? `${name}（节点 ${selectedNode.idx + 1}） · ${content.label}` : route?.ariaLabel || `${name || '地点预览'}${content.label ? ` · ${content.label}` : ''}`);
  const displayType = selectedSupply ? 'event' : selectedDoor ? 'door' : selectedNode?.def?.type;
  const paintedIcon = name && mapNodeArtHTML(displayType);
  const glyph = name && !paintedIcon && mapNodeIconDataUrl(displayType);
  strip.innerHTML = name ? `
    <header class="expedition-preview-heading">
      <span class="expedition-preview-icon" aria-hidden="true">${paintedIcon || (glyph ? `<img class="ic" src="${glyph}" alt="" draggable="false">` : iconHTML(route?.icon || nodeIcon))}</span>
      <span class="expedition-preview-copy"><small class="expedition-preview-status">地点预览</small><b>${esc(name)}</b></span>
      <span class="expedition-preview-badge">${esc(status)}</span>
    </header>
    <div class="expedition-preview-content">
      ${content.label ? `<span class="expedition-node-status" data-content-state="${esc(content.id)}"><span aria-hidden="true" class="expedition-node-status-dot"></span>${esc(content.label)}</span>` : ''}
      <p class="expedition-preview-hint">${esc(hint || '')}</p>
      ${!reachable && !isCurrent ? '<p class="expedition-preview-condition">需要先到达与此处相连的地点。</p>' : ''}
      ${lowLife ? '<p class="expedition-preview-risk">生命偏低，建议先恢复再迎战。</p>' : ''}
    </div>
    <div class="expedition-preview-action"><button type="button" class="expedition-preview-enter" data-route-enter="1" ${game.state !== 'idle' || (!reachable && !isCurrent) || completedLocal ? 'disabled' : ''}><span>${esc(actionLabel)}</span><span aria-hidden="true">→</span></button></div>` : '';
}
