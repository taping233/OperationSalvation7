/* ============================================================
 * agent.weights.js —— 地图打分卡的多维权重向量（09-26 架构升级①）
 *
 * 把 agent.policy.js decideMap 里散落的标量阈值抽成显式向量 W：
 *   base   节点类型分档（血线高低双档）——路线选择的主信号
 *   gate   血线门阈值（0.75/0.5/0.45/0.7 等）
 *   geo    几何/反振荡权重（前进/回退/强推/已访保底）
 *
 * 设计约束：
 *   1) DEFAULT 与原字面量逐值相等 → 默认行为与向量化前 bit 级等价（T集配对40/40平验证）
 *   2) 本文件纯数据+纯函数、零游戏依赖 → 可被 game/tools/agent-evolve.mjs 独立 import
 *   3) 只覆盖 strategic 分支；v1 greedy 对照组继续用字面量（保持冻结语义，
 *      否则 ES 调 W 会连带改掉对照组，配对基线就废了）
 *   4) 结构性规则（stallSteps>10、backToPrevStreak>=2、flee 判据、决死一次逃）
 *      是修根因产物，不进向量、不可被进化扰动
 * ============================================================ */

export const DEFAULT_WEIGHTS = {
  // 节点类型 base 分（strategic 分支；hp 高档/低档成对）
  base: {
    def: 15,
    fireHi: 95, fireLo: 45,            // hp >= gate.fire ? Hi : Lo
    chestFull: 12, chestOk: 60,        // 背包满 / 未满
    event: 50,
    shopHi: 85, shopLo: 45,
    battleHi: 40, battleMid: 15, battleLo: 5, battleFled: 6,
    bossHi: 55, bossLo: 5,
    extractHi: 95, extractLo: 20, extractLocked: -100,
    doorHi: 30, doorStall: 26, doorMid: -40, doorLow: -150,
  },
  gate: {
    fire: 0.75,        // 火堆/商店高分档、门高分档、战斗高分档共用 0.75 血线
    battleMid: 0.45,   // 战斗中档 & 门中档
    boss: 0.75,        // boss 挑战血线
    extract: 0.5,      // 撤离点高分血线
    fled: 0.7,         // fleeing 格解锁血线（滞环时）
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
