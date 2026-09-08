/* 敌方意图视图模型：把“下一步要做什么”与单位 HTML 解耦。 */

function intentViewModel(intent) {
  if (!intent) return null;
  const intents = Array.isArray(intent) ? intent : [intent];
  return intents.filter(Boolean).map((item) => ({
    icon: String(item.icon || ''),
    label: String(item.label || ''),
    damage: Number.isFinite(Number(item.damage)) && Number(item.damage) > 0 ? Number(item.damage) : null,
    kind: String(item.kind || 'unknown'),
  }));
}

function intentSummary(intent) {
  return intentViewModel(intent).map(item => `${item.label}${item.damage == null ? '' : ` · ${item.damage}`}`).join(' / ');
}

export { intentSummary, intentViewModel };
