import { TERM_TIPS, TERM_KEYWORDS } from './term-definitions.js';
const WORDS = { ...TERM_KEYWORDS, '冻结':'freeze', '限定':'equipSkill' };
export function collectCardTips(card) {
  const text = String(card?.desc || '');
  const keys = new Set(Object.entries(WORDS).filter(([word]) => text.includes(word)).map(([, key]) => key));
  if (card?.dmgType) keys.add(`${card.dmgType}Damage`);
  return [...keys].filter(key => TERM_TIPS[key]).map(key => ({ id:key, ...TERM_TIPS[key] }));
}
