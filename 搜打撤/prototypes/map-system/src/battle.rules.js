const AOE_PATTERN = /所有敌人|群体|全体/;
const SELF_TARGET_PATTERN = /回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为/;
const DECK_ONLY_PATTERN = /洗入|置入牌库|放入牌库|牌库底|牌库上限/;

function isAreaEffect(card) {
  return AOE_PATTERN.test(String(card.desc || ''));
}

function targetSideFor(card, damageTypes) {
  if (isAreaEffect(card)) return null;
  const desc = String(card.desc || '');
  if (damageTypes.includes(card.type) || card.dmgType === 'attack') return 'enemy';
  if (+(card.heal || 0) > 0 || +(card.armor || 0) > 0 || SELF_TARGET_PATTERN.test(desc)) return 'self';
  return null;
}

function unplayableReasonFor(card, mode) {
  if (card.type === '资源') return '资源卡无法在对战中打出（资源在背包中使用或出售）';
  if (card.type === '事件') return '事件卡只能在棋盘的事件格中触发，无法打出';
  if (card.type === '生物') return '生物卡是敌人图鉴，记录敌人信息，无法打出';
  if (mode === 'boss' && card.type === '道具') return '道具卡只能在普通战斗中使用（BOSS 战牌库不含道具）';
  if (mode === 'normal' && DECK_ONLY_PATTERN.test(String(card.desc || ''))) {
    return '「牌库」词条只有对战 BOSS 时生效——普通战斗没有牌库与墓地，无法打出';
  }
  return null;
}

export { isAreaEffect, targetSideFor, unplayableReasonFor };
