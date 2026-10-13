export const DRAW_EXPLANATION = '抽牌在普通战斗中会转化为获取同等数量的初始攻击。';

// Include conditional draws without treating “抽到时施放” as a draw effect.
export function hasDrawExplanation(card, derivedDraw = 0) {
  return Number(card?.draw) > 0 || Number(derivedDraw) > 0
    || /抽(?:牌|卡|取[^。；]*[牌张]|\s*[0-9一二三四五六七八九十两]+\s*张)/u.test(String(card?.desc || ''));
}
