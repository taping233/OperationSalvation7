/* 手牌代价句式单一登记点（迭代评审 09-20 A-P3/P2）：
 * 「打不出去预检」（battle.rules handCostOf）与「结算执行」（effect-steps consume/play）
 * 历史上各持一份相同正则——新代价措辞只登记一处，就会出现「打出去才空过」或「预检误拦」。
 * 现在两处正则全部引自本模块；全卡审计（tests/battle-all-cards.test.js）也用它把
 * 手牌代价卡归为「条件卡」（审计空手牌环境下代价必不满足，零效果只警告不硬失败）。
 * 新增代价措辞时：在这里加正则 + effect-steps 加执行分支 + 本注释提醒三方同源。 */

// 「消耗 N 张 X，效果」：effect-steps consume 执行
export const HAND_COST_CONSUME_RE = /消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$/;

// 「选择 N 张手牌中的 X 施放/打出」：effect-steps play 执行
export const HAND_COST_SELECT_RE = /选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)/;

export const HAND_COST_PATTERNS = [HAND_COST_CONSUME_RE, HAND_COST_SELECT_RE];

export const HAND_COST_CN_NUM = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
