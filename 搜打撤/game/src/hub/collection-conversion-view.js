import { esc } from '../core/shared.js';
import { LEVEL_MAX, xpForNext } from './meta-progression.js';

const progressText = progress => `Lv.${progress.lv} · ${progress.xp} XP${progress.lv >= LEVEL_MAX ? '（满级）' : ` / ${xpForNext(progress.lv)}`}`;
export const conversionSignature = preview => JSON.stringify({ count: preview.count, registered: preview.registered,
  protected: preview.protected, actualXp: preview.actualXp, overflowXp: preview.overflowXp, before: preview.before, after: preview.after });

export function collectionConversionHTML(preview) {
  if (!preview.characterId) return esc(preview.message || '无法转化');
  if (preview.code === 'CHARACTER_MAXED') return `${esc(preview.characterName)}熟练度已满且图鉴已收录，不再消耗卡牌转化经验。`;
  const result = `<b>消耗【${esc(preview.cardName)}】×${preview.count}</b> → ${esc(preview.characterName)}<br>实际经验 +${preview.actualXp}<br>${esc(progressText(preview.before))} → ${esc(progressText(preview.after))}`;
  const note = preview.registrationOnly ? '<br>仅收录图鉴，经验 0，消耗 1 张。'
    : preview.overflowXp ? `<br>末张溢出 ${preview.overflowXp} 经验，不再增加熟练度；其余卡牌保留。` : '';
  return result + note + (preview.protected ? '<br>卡牌受保护，取消保护后才可转化；图鉴收录保留。' : '');
}
