/* 敌方意图视图模型：把“下一步要做什么”与单位 HTML 解耦。 */

function intentViewModel(intent) {
  if (!intent) return null;
  const intents = Array.isArray(intent) ? intent : [intent];
  return intents.filter(Boolean).map((item) => {
    const damage = Number.isFinite(Number(item.damage)) && Number(item.damage) > 0 ? Number(item.damage) : null;
    const hits = Number.isFinite(Number(item.hits)) && Number(item.hits) > 1 ? Math.floor(Number(item.hits)) : 1;
    return {
      icon: String(item.icon || ''),
      label: String(item.label || ''),
      damage,
      hits,
      totalDamage: damage == null ? null : damage * hits,
      kind: String(item.kind || 'unknown'),
      // 意图实算口径（迭代评审 09-20）：预告已含目标流血层数，角标供玩家核对
      bleedBonus: Number.isFinite(Number(item.bleedBonus)) && Number(item.bleedBonus) > 0 ? Math.floor(Number(item.bleedBonus)) : 0,
    };
  });
}

function intentSummary(intent) {
  return intentViewModel(intent).map(item => {
    if (item.damage == null) return item.label;
    return `${item.label} · ${item.damage}${item.hits > 1 ? ` ×${item.hits}（共${item.totalDamage}）` : ''}`;
  }).join(' / ');
}

export { intentSummary, intentViewModel };
