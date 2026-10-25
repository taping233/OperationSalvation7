import { nodeHitRadius } from './camera.js';
import { mapNodeStatus } from './map-node-state.js';
import { findMapTravelPath } from '../run/map-travel-path.js';

/** Map selection owns reachability/hit-testing and preview commands, not listeners. */
export function createGameMapSelection({ readState, readServices, UI, MAP,
  TYPE_NAME, renderScheduler, getExpeditionPreview, setExpeditionPreview, moveTo,
  reenterCell, entrySupplyGate }) {

  // 结点命中：以屏幕像素为稳定目标尺寸，可达优先包括完整的多段路线。
  const MIN_NODE_HIT_PX = 28;
  function reachableNodes() {
    const { game } = readState();
    if (entrySupplyGate(game)) return [];
    const current = game.layerData[game.layerIdx]?.logical[game.trackPos];
    const next = current?.next || [];
    // Keyboard cycling reads the current edge contents, including in-place edits.
    const byKey = new Map();
    for (const node of game.nodes) {
      const key = `${node.li},${node.idx}`;
      if (!byKey.has(key)) byKey.set(key,node);
    }
    const result = [], seen = new Set();
    for (const [li, idx] of next) {
      const key = `${li},${idx}`, node = byKey.get(key);
      if (node && li === game.layerIdx && !seen.has(key)) { result.push(node); seen.add(key); }
    }
    return result;
  }

  function isReachable(n) {
    return !!findMapTravelPath(readState().game, n)?.length;
  }

  function pickNode(wx, wy, preferReachable = false) {
    const { game, cam } = readState();
    const fogOn = game.seen && Object.keys(game.seen).length > 0;
    const radius = nodeHitRadius(cam.zoom, MIN_NODE_HIT_PX);
    const renderer = readServices().renderer;
    const candidates = [];
    for (const n of game.nodes) {
      if (n.li !== game.layerIdx) continue;
      // 迷雾外的节点不可选中：不可点击、无 tooltip（2026-09-09 老板：只见走过的和相邻的）
      if (fogOn && !game.seen[n.li + ',' + n.idx]) continue;
      const d = Math.hypot(n.x - wx, n.y - wy);
      const label = renderer?.nodeLabelBounds?.(game, n);
      const labelHit = label && wx >= label.left && wx <= label.right && wy >= label.top && wy <= label.bottom;
      if (d <= radius || labelHit) candidates.push({ node:n, distance:d });
    }
    candidates.sort((a,b) => a.distance - b.distance);
    // Check nearest hits first and stop at the first usable route. Reachability
    // includes multi-step travel; do not prefer every adjacent hit over it.
    if (preferReachable) for (const { node } of candidates) {
      if (node.li === game.layerIdx && node.idx === game.trackPos || isReachable(node)) return node;
    }
    return candidates[0]?.node || null;
  }

  function clearTarget({ refresh = true } = {}) {
    if (readState().game.state === 'moving') return;
    readState().game.moveTarget = null;
    setExpeditionPreview(readState().game, null);
    if (readState().game.hover && !isReachable(readState().game.hover)) readState().game.hover = null;
    UI.hideTooltip();
    if (refresh) {
      UI.refresh(readState().game);
      renderScheduler.invalidate();
    }
  }

  function showTarget(n) {
    if (!n) return;
    setExpeditionPreview(readState().game, n);
    readState().game.moveTarget = isReachable(n) ? { li: n.li, idx: n.idx } : null;
    readState().game.hover = n;
    UI.refresh(readState().game);
    UI.hideTooltip();
    renderScheduler.invalidate();
  }

  function chooseNextTarget(step = 1) {
    if (readState().game.state !== 'idle') return false;
    const options = reachableNodes();
    if (!options.length) { UI.log('当前节点没有可前往的相邻节点', 'warn'); return false; }
    if (options.length === 1) { showTarget(options[0]); return true; }
    const key = readState().game.moveTarget && `${readState().game.moveTarget.li},${readState().game.moveTarget.idx}`;
    const at = options.findIndex(n => `${n.li},${n.idx}` === key);
    showTarget(options[at < 0 ? (step > 0 ? 0 : options.length - 1) : (at + step + options.length) % options.length]);
    return true;
  }

  function confirmTarget() {
    if (readState().game.state !== 'idle') return false;
    const preview = getExpeditionPreview(readState().game);
    if (preview?.li === readState().game.layerIdx && preview?.idx === readState().game.trackPos) {
      clearTarget({ refresh:false });
      return reenterCell();
    }
    // Rewards or fog may have changed since preview. Confirm the displayed
    // destination against live reachability instead of its old moveTarget flag.
    const target = preview || readState().game.moveTarget;
    if (!target) return chooseNextTarget(1);
    if (!isReachable(target)) { readState().game.moveTarget = null; return false; }
    clearTarget({ refresh:false });
    return moveTo(target.li, target.idx);
  }

  function showInvalidNode(e, n) {
    setExpeditionPreview(readState().game, n);
    readState().game.moveTarget = null;
    UI.refresh(readState().game);
    renderScheduler.invalidate();
    const r = readState().canvas.getBoundingClientRect();
    if (entrySupplyGate(readState().game)) {
      UI.showTooltip(e.clientX - r.left, e.clientY - r.top, '入城节点 · 须领完补给', ['点击脚下的入城节点，领取全部随行补给后再出发']);
      UI.log('[[icon:door]] 领完入城补给后才能前往其他地点', 'warn');
      return;
    }
    UI.showTooltip(e.clientX - r.left, e.clientY - r.top, `${hoverInfo(n)[0]} · 暂不可达`, ['路线中间须为已知的空白、已领完补给的入口或已完成节点']);
    UI.log('该节点没有可连续通行的已知路线', 'warn');
  }

  function updateHover(e) {
    const r = readState().canvas.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      if (readState().game.hover) renderScheduler.invalidate();
      readState().game.hover = null;
      UI.hideTooltip();
      return;
    }
    const w = readState().cam.screenToWorld(e.clientX - r.left, e.clientY - r.top);
    const n = pickNode(w.x, w.y, true);
    const legal = !!n && readState().game.state === 'idle' && isReachable(n);
    readState().canvas.style.cursor = legal ? 'pointer' : n ? (readState().game.devMode ? 'cell' : 'not-allowed') : 'grab';
    if (n !== readState().game.hover) {
      readServices().sound.sfx('hover');   // 悬停结点变化时轻提示一声
      renderScheduler.invalidate();
    }
    readState().game.hover = n;
    if (!n) { UI.hideTooltip(); return; }
    UI.showTooltip(e.clientX - r.left, e.clientY - r.top, ...hoverInfo(n));
  }

  /** @returns {[string, string[]]} */
  function hoverInfo(node) {
    const lines = [];
    let title;
    if (node.li >= 0) {
      const loc = { layer: readState().game.layerData[node.li], idx: node.idx };
      title = `${loc.layer.name} · #${loc.idx}`;
      const def = node.def;
      const door = (loc.layer.doors || []).find(d => d.at === loc.idx);
      const altarE = (loc.layer.altarEntrances || []).find(a => a['at'] === loc.idx);
      const eIdx = (loc.layer.entrances || []).indexOf(loc.idx);
      if (eIdx >= 0) lines.push(`[[icon:door]] 出生入口：${loc.layer.entranceNames[eIdx]}`);
      if (door) lines.push(`[[icon:door]] 环间门${door.reverse ? '（返回）' : ''}${door.exit ? ' / 撤离出口' : ''} ⇄ ${readState().game.layerData[door.toLayer]?.name || '下一层'}`);
      if (altarE) lines.push('[[icon:crystal]] 污染核心入口');
      const content = mapNodeStatus(readState().game, node);
      if (def && def.type !== 'entrance') lines.push(`地点：${TYPE_NAME[def.type] || def.type}${def.type === 'coin' && def.n ? `（+${def.n}币）` : ''}`);
      else if (eIdx < 0 && !door && !altarE) lines.push('普通格');
      if (content.label) lines.push(`${content.label} · ${content.detail}`);
    } else {
      title = node.def.name || '中央区';
      if (node.def.type === 'boss') lines.push('经由污染核心挑战（M1 实装战斗）');
      if (node.def.type === 'altar') lines.push('BOSS 巢穴入口');
    }
    const note = readServices().notes.get(MAP.boardId, node.li, node.idx);
    if (note) lines.push(`[[icon:notes]] ${note}`);
    lines.push('点击查看地点');
    return [title, lines];
  }

  return { reachableNodes, isReachable, pickNode, clearTarget, showTarget,
    chooseNextTarget, confirmTarget, showInvalidNode, updateHover, hoverInfo };
}
