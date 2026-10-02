/* ============================================================
 * agent.weights.js —— 策略的多维权重向量（09-26 架构升级①，同日扩展）
 *
 * 把 agent.policy.js 散落的标量阈值抽成显式向量 W：
 *   base   节点类型分档（血线高低双档）——路线选择的主信号
 *   gate   血线门阈值（0.75/0.5/0.45/0.7 等）
 *   geo    几何/反振荡权重（前进/回退/强推/已访保底）
 *   battle 战斗微操（喝药双线/护甲双门/AOE 加权/背包技能能量门）
 *   shop   商店与资源（经济留币三参/买药血线/货架加权/整备预算）
 *   event  事件选项词权重（获得/失去/升级/放弃 + 低血档）
 *   deck   编组选牌（稀有度主权重 + 克制维度，默认 0 行为保持）
 *
 * 设计约束：
 *   1) DEFAULT 与原字面量逐值相等 → 默认行为与向量化前 bit 级等价（配对全平验证）
 *   2) 本文件纯数据+纯函数、零游戏依赖 → 可被 game/tools/agent-evolve.mjs 独立 import
 *   3) 只覆盖 strategic 分支；v1 greedy 对照组继续用字面量（保持冻结语义，
 *      否则 ES 调 W 会连带改掉对照组，配对基线就废了）
 *   4) 结构性规则（stallSteps>10、backToPrevStreak>=2、flee 判据、决死一次逃、
 *      斩杀/性价比优先级）是修根因产物，不进向量、不可被进化扰动
 * ============================================================ */

export const DEFAULT_WEIGHTS = {
  // 节点类型 base 分（strategic 分支；hp 高档/低档成对）
  base: {
    def: 15,
    fireHi: 95, fireLo: 45,            // hp >= gate.fire ? Hi : Lo
    chestFull: 12, chestOk: 60,        // 背包满 / 未满
    chestLowCards: 90,                 // 09-27 R18：卡<3 张时宝箱分（攒卡保撤离赎卡能力）
    event: 50,
    shopHi: 85, shopLo: 45,
    battleHi: 40, battleMid: 15, battleLo: 5, battleFled: 6,
    battleCritical: 0, // 09-27 R16：极低血（hpRatio≤gate.battleCritical）战斗格分——
                       // 埋点解剖：败场 55% 战后 hp≤5、round 中位 1（残血进场被秒），
                       // 0 分让位给任何替代路径；无替代时 ranked[0] 仍保留被迫作战
    bossHi: 55, bossLo: 5,
    extractHi: 95, extractLo: 20, extractLocked: -100,
    doorHi: 30, doorStall: 26, doorMid: -40, doorLow: -150,
  },
  gate: {
    fire: 0.75,        // 火堆/商店高分档、门高分档、战斗高分档共用 0.75 血线
    battleMid: 0.45,   // 战斗中档 & 门中档
    battleCritical: 0.15, // 09-27 R16：极低血战斗规避线（hp ≤ 此值战斗格 0 分让位）
    boss: 0.75,        // boss 挑战血线
    extract: 0.5,      // 撤离点高分血线
    fled: 0.7,         // fleeing 格解锁血线（滞环时）
    retreatHp: 0.5,    // 09-27 R24 残血导航线（hp ≤ 此值时向本层火堆/紧急撤离做梯度导航）
    doorUnexplored: 15,// 本层有未收内容时门的折价
  },
  geo: {
    fwdIdx: 8, fwdLayer: 8,   // 同层高格位 / 跨层向深处
    backtrack: 25,            // 刚离开的格子惩罚（反 A↔B 拉锯）
    crossBack: 40,            // 非滞环回浅层惩罚
    forceProgress: 45,        // 滞环时未访非回退格强推
    seen: 2, seenFwd: 3,      // 已访格保底 + 已访前进小奖
    ban: -1000,               // banPrev 禁选分
    lookahead: 0.5,           // 2步前瞻折扣 γ：value = score(自身) + γ·max score(邻居)
    doorNoLookHp: 0.35,       // 09-27 R18：低血门断 γ 线（hp ≤ 此值时门不吃前瞻——
                              // doorLow -150 会被门对面未访格的 γ 拉分抵消，残血深进
                              // L4 全灭 22/22 的真机制）
  },
  // —— 09-26 扩展：战斗簇（7 标量，原硬编码字面量抽入，DEFAULT 逐值相等）——
  battle: {
    potionHpLine: 0.5,        // 残血喝药血线（hp/maxHp < 此值先喝药）
    potionThreatRatio: 0.6,   // 威胁喝药线（预估受击 - 护甲 >= hp × 此值）
    armorGate1: 2,            // 1 费甲需挡过此溢出伤才值得买（<= 则跳过）
    armorGate2: 6,            // 2 费甲同上（cost>=2 档）
    aoeMultiplier: 1.7,       // 多敌时 AOE 卡性价比加权
    aoeMinFoes: 1,            // AOE 加权的最少存活敌数（living > 此值）
    slamMinEnergy: 2,         // 背包技能能量门上限（2026-10-02 五职业分化：按职业 1-2 费取 min，2=最保守）
  },
  // —— 09-26 扩展：商店/资源簇（8 标量）——
  shop: {
    reserveLayer: 3,          // 经济留币的起始层数（>= 此层）
    reserveHpRatio: 0.6,      // 经济留币的血线条件（< 此值）
    reserveCoins: 10,         // 留币数（紧急撤离保证金）
    healHpRatio: 0.7,         // 低血买药血线
    healScoreHi: 5,           // 货架回复类加权（低血档）
    healScoreLo: 1,           // 货架回复类加权（血健康档）
    attackScore: 2,           // 货架攻击类加权
    deployReserve: 2,         // 整备留空位（bagCap - 此值 = 带卡预算）
  },
  // —— 09-26 扩展：事件簇（5 标量）——
  event: {
    gainScore: 15,            // 「获得/金币/抽牌」词权重
    lossScore: -18,           // 「失去/随机/赌」词权重
    upgradeScore: 12,         // 「升级/强化/上限」词权重
    quitScore: -25,           // 「离开/放弃」词权重
    lowHpRatio: 0.6,          // 事件低血档（回复/扣血数值加权的血线）
  },
  // —— 09-26 扩展：编组选牌簇（2 标量）——
  deck: {
    rarityWeight: 1,          // 稀有度主权重（现状排序）
    counterWeight: 0,         // 克制维度权重（默认 0=行为与纯稀有度完全一致，ES 可搜）
                              // 克制特征：多敌 AOE 加分、高血编组大伤卡加分（counterScore）
  },
};

// 深合并覆盖：only 数值叶子参与覆盖（进化个体只带需要改的键）
function merge(base, over) {
  if (!over || typeof over !== 'object') return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object')
      ? merge(base[k], v)
      : (typeof v === 'number' ? v : base[k]);
  }
  return out;
}

// 解析权重：DEFAULT ⊕ 进化个体覆盖（agent-evolve 经 globalThis 注入）
export function resolveWeights() {
  const over = typeof globalThis !== 'undefined' ? globalThis.__SDT_AGENT_WEIGHTS : null;
  return over ? merge(DEFAULT_WEIGHTS, over) : DEFAULT_WEIGHTS;
}
