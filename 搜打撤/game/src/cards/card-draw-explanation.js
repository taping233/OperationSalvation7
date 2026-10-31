export const DRAW_EXPLANATION = '普通战斗中，抽牌效果从本场牌库取牌，牌库抽空时停止；开局和每回合开始不自动抽牌。';

// Include conditional draws without treating “抽到时施放” as a draw effect.
export function hasDrawExplanation(card, derivedDraw = 0) {
  return Number(card?.draw) > 0 || Number(derivedDraw) > 0
    || /抽(?:牌|卡|取[^。；]*[牌张]|\s*[0-9一二三四五六七八九十两]+\s*张)/u.test(String(card?.desc || ''));
}
