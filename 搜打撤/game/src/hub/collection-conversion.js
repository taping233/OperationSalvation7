import { characterFor } from '../core/characters.js';
import { addXpToProgress, LEVEL_MAX, xpForNext } from './meta-progression.js';
import { freezeDeep } from './commands.shared.js';
import { isCollectionProtected } from './collection-protection.js';

// 收藏转换的纯预览：与提交共用数量上限、满级及末张溢出口径，不写库存或经验。
/** @returns {{canConvert: boolean, code: string, message: string, maxCount: number, cardId?: string, cardName?: string, characterId?: string, characterName?: string, registered?: boolean, protected?: boolean, registrationOnly?: boolean, count?: number, availableCount?: number, neededCount?: number, perCardXp?: number, remainingXp?: number, baseXp?: number, actualXp?: number, overflowXp?: number, before?: {lv: number, xp: number}, after?: {lv: number, xp: number}}} */
export function previewCollectionConversion({ baseSnapshot, card, availableCount = 0, count = 1 }) {
  const character = characterFor(card?.cls);
  if (!character || !(card.rarity === '职业' || card.type === '能力卡')) {
    return freezeDeep({ canConvert: false, code: 'NOT_COLLECTIBLE', message: '这张卡不能转化为人物经验', maxCount: 0 });
  }
  const saved = baseSnapshot?.characters?.[character.id] || { lv: 1, xp: 0 };
  const before = { lv: Math.min(LEVEL_MAX, Math.max(1, Number(saved.lv) || 1)), xp: Math.max(0, Number(saved.xp) || 0) };
  const registered = !!baseSnapshot?.collection?.[card.id];
  const protectedCard = isCollectionProtected(baseSnapshot, card);
  const maxed = before.lv >= LEVEL_MAX;
  const perCardXp = card.type === '能力卡' ? 50 : 10;
  let remainingXp = maxed ? 0 : -before.xp;
  for (let level = before.lv; level < LEVEL_MAX; level++) remainingXp += xpForNext(level);
  remainingXp = Math.max(0, remainingXp);
  const neededCount = maxed ? registered ? 0 : 1 : Math.ceil(remainingXp / perCardXp);
  const available = Math.max(0, Math.floor(Number(availableCount) || 0));
  const maxCount = Math.min(available, neededCount);
  const registrationOnly = maxed && !registered;
  let code = '', message = '';
  if (!Number.isInteger(count) || count < 1) { code = 'INVALID_ARGUMENT'; message = '转换数量必须是正整数'; }
  else if (count > available) { code = 'INSUFFICIENT_CARDS'; message = '卡牌数量不足，整笔转换未执行'; }
  else if (maxed && registered) { code = 'CHARACTER_MAXED'; message = '人物熟练度已满且卡牌已收录，无需再消耗卡牌'; }
  else if (protectedCard) { code = 'COLLECTION_PROTECTED'; message = '卡牌已受保护，请先取消保护；图鉴收录会保留'; }
  else if (count > maxCount) { code = 'CONVERSION_LIMIT'; message = registrationOnly ? '人物熟练度已满，首次收录只需消耗 1 张' : `达到满级最多需要 ${maxCount} 张，超出部分不会消耗`; }
  const baseXp = Number.isInteger(count) && count > 0 ? count * perCardXp : 0;
  const actualXp = Math.min(baseXp, remainingXp);
  const overflowXp = registrationOnly ? 0 : Math.max(0, baseXp - actualXp);
  const after = addXpToProgress(before, actualXp).after;
  return freezeDeep({
    canConvert: !code, code, message, cardId: card.id, cardName: card.name,
    characterId: character.id, characterName: character.name, registered, protected: protectedCard, registrationOnly,
    count, availableCount: available, maxCount, neededCount, perCardXp, remainingXp,
    baseXp, actualXp, overflowXp, before, after,
  });
}
