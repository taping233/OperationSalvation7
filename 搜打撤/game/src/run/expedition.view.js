const esc = value => String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// Exploration presentation only. Legal edges and outcomes remain owned by the run flow.
export const NODE_INFO = {
  battle: ['遭遇战', '准备迎敌 · 胜利后搜刮', 'swords', 'danger'],
  boss: ['首脑', '终局挑战 · 检查随身卡牌', 'skull', 'danger'],
  chest: ['物资点', '搜寻卡牌与补给', 'gem', 'gold'],
  resource: ['物资格', '按爆率刷新 2 张随机资源卡 · 选 1 带走', 'gem', 'gold'],
  fire: ['火堆', '恢复生命 · 复原消耗卡牌', 'fire', 'warm'],
  shop: ['商店', '用金币补充装备与卡牌', 'coin', 'safe'],
  event: ['未知事件', '新的机遇，也可能有代价', 'question', 'mystery'],
  door: ['层间闸门', '前往下一片区域', 'door', 'gold'],
  emergencyExit: ['紧急撤离', '第三层 · 献祭 3 张卡牌离开', 'exit', 'safe'],
  extraction: ['终局撤离', '击败首脑后带回战利品', 'exit', 'safe'],
  altar: ['祭坛', '选择能力 · 准备决战', 'sparkles', 'mystery'],
  coin: ['金币', '拾取金币', 'coin', 'gold'],
  key: ['钥匙', '搜集开门物资', 'key', 'gold'],
  wood: ['木材', '收集基地升级物资', 'wood', 'warm'],
  rations: ['口粮', '收集远征补给', 'bread', 'safe'],
  entrance: ['入口', '已建立的行进路线', 'flag', 'safe'],
};

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
  const key = JSON.stringify([routes, objective, disabled]);
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
  options.innerHTML = routes.map(r => `<button type="button" class="route-option${r.selected ? ' selected' : ''}" data-route-index="${r.idx}" data-route-layer="${r.li}" data-tone="${r.tone}" aria-label="${esc(r.ariaLabel || `${r.name}（节点 ${r.idx + 1}）`)}" ${disabled ? 'disabled' : ''}>
    <span class="route-icon" aria-hidden="true">${iconHTML(r.icon)}</span>
    <span class="route-copy"><b>${esc(r.name)}${r.cleared ? ' · 已探索' : ''}</b><small>${esc(r.hint)}</small></span>
    <span class="route-arrow" aria-hidden="true">↗</span>
  </button>`).join('');
  if (!routes.length) options.innerHTML = '<span class="route-empty">当前没有相邻路线，请检查本节点的事件。</span>';
  if (active != null) options.querySelector(`[data-route-index="${active}"]`)?.focus({ preventScroll: true });
}
