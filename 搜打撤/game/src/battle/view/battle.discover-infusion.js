// Presentation only; effectiveInfuse comes from the shared inspection API, including waivers.
// 反馈1021·5：「直接释放/直接施放」词条释放注能卡视为已注能（docs/rules.md:98），
// 面板不再提示「无法施放/留手」的旧拒绝语义，只说明直释按已注能结算；
// 文案以「未注能」开头以沿用发现面板的短徽标裁剪（battle.discover-view.js）。
export function discoverInfusionNote(act, effectiveInfuse) {
  if (!['play', 'potion', 'playKeep', 'pouch'].includes(act)) return '';
  return effectiveInfuse > 0 ? '未注能，直释视为已注能' : '';
}
