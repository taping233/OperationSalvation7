// 收录记录永久保留；旧档缺少 protected 字段时沿用原有保护。
export function isCollectionProtected(snapshot, card) {
  const record = card?.id ? snapshot?.collection?.[card.id] : null;
  return !!record && record.protected !== false;
}
