// Reads recorded facts only. The trail counts first visits, never invents a travel order.
export function buildRunMemento(game, savedCards = []) {
  const layers = Array.isArray(game.layerData) ? game.layerData : [];
  const events = Array.isArray(game.eventLog) ? game.eventLog : [];
  const records = Object.values(game.nodeRewards || {});
  if (!layers.length && !events.length && !records.length) return null;
  const counts = new Map();
  for (const key of Object.keys(game.explored || {})) {
    if (!/^\d+,\d+$/.test(key)) continue;
    const [li, index] = key.split(',').map(Number);
    if (!layers[li]?.logical?.[index]) continue;
    counts.set(li, (counts.get(li) || 0) + 1);
  }
  const trail = [...counts].sort(([a], [b]) => a - b)
    .map(([li, count]) => ({ layer:li + 1, name:String(layers[li].name || `第 ${li + 1} 层`), count }));
  const moments = [];
  const commissions = records.map(record => record?.commission).filter(Boolean);
  if (commissions.some(receipt => receipt.status === 'applied')) moments.push('你交付了接应凭据，运输员替你付清了两格商品的价款。');
  else if (commissions.some(receipt => receipt.status === 'pending')) moments.push('你接下了运输员的接应凭据，这次还未兑付。');
  if (game.altarActivated) moments.push('你唤醒了污染祭坛。');
  if (game.bossKilled) moments.push('你突破了首脑的封锁。');
  for (const event of [...events].reverse()) {
    if (moments.length >= 3) break;
    if (typeof event?.name !== 'string' || !event.name.trim()) continue;
    const line = `途中遇见「${event.name.slice(0, 80)}」。`;
    if (!moments.includes(line)) moments.push(line);
  }
  if (!moments.length && trail.length) moments.push(`你在${trail[trail.length - 1].name}留下了探索足迹。`);
  const ranks = ['古朴', '稀有', '史诗', '传说', '棱彩', '职业'];
  const representative = savedCards.filter(stack => stack?.card?.name && stack.count > 0)
    .map((stack, index) => ({ stack, index }))
    .sort((a, b) => ranks.indexOf(b.stack.card.rarity) - ranks.indexOf(a.stack.card.rarity) || a.index - b.index)[0]?.stack;
  return { version:1, trail, moments:moments.slice(0, 3),
    representative:representative ? { name:String(representative.card.name), count:representative.count } : null };
}
