import { HAND_COST_PATTERNS, HAND_COST_CN_NUM } from './hand-cost-patterns.js';
import { ownsBuiltinExecutionDomain } from '../../cards/builtin-card-execution.js';
import { triggerExecutionPlan } from '../../cards/card-execution-plan.js';

const nativePlayOps = card => {
  const ops = triggerExecutionPlan(card, 'onPlay').ops;
  return Array.isArray(ops) ? ops : [];
};

const AOE_PATTERN = /所有敌人|群体|全体/;
const SELF_TARGET_PATTERN = /回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为/;
// 「对敌方施加的效果」词条（2026-09-09 老板 #7）：招式里确实作用于敌方的才需要指向敌人
const ENEMY_EFFECT_PATTERN = new RegExp([
  '造成\\s*\\d+(?:\\s*[-–~至]\\s*\\d+)?\\s*点',
  '\\d+\\s*[′\']',
  '攻\\s*[（(]?\\s*[+＋\\-−]?\\s*\\d',
  '攻击\\s*\\d',
  '所有敌人', '全体敌人', '敌方全体', '目标为敌方全体',
  '附加\\s*(?:\\d+\\s*层?)?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱)',
  '(?:施加|叠加)\\s*\\d*\\s*层?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|诅咒)',
  '消灭', '降低\\s*\\d+\\s*点?攻击力', '偷取[^。]{0,12}攻击力', '夺取[^。]{0,12}攻击力',
  '无法(?:行动|使用|打出)',
  '沉默', '冰冻', '火球', '迫使', '对方',
  '使[^。]{0,12}(?:中毒|流血|冰冻|沉默)层数',
  '触发\\s*\\d*\\s*次?毒伤',
].join('|'));

function isAreaEffect(card) {
  const battle = card && card.rules && card.rules.battle;
  if (battle && battle.target && Object.prototype.hasOwnProperty.call(battle.target, 'area')) {
    return !!battle.target.area;
  }
  if (ownsBuiltinExecutionDomain(card)) return nativePlayOps(card).some(operation => operation.target === 'allEnemies');
  if (card?.id === 'cc-rot-seed') return false;
  return AOE_PATTERN.test(String(card.desc || ''));
}

// 该卡是否对敌方施加效果（结构化伤害字段优先，其次描述词条）
function hasEnemyEffect(card) {
  if (+(card.dmg || 0) > 0) return true;
  if (card.dmgType === 'attack') return true;
  return ENEMY_EFFECT_PATTERN.test(String(card.desc || ''));
}

// ---------- 核心结算目标规则 ----------
// 'enemy' = 对敌方施加效果；全体伤害仍保留此侧以复用目标校验与伤害预览。
// 视图允许全体牌拖到合法战场空地，以首个存活敌人提交，效果结算覆盖全体；也可点敌确认。
// 'self' = 治疗/净化/护甲/护盾/格挡；null = 无指向效果（抽牌/发现/能量/召唤等）。
// 无伤害群体牌沿用无目标入口；是否允许空地拖放由视图的 isAreaEffect 判断。
function isPureAreaEffect(card) {
  return isAreaEffect(card) && !(+(card.dmg || 0) > 0) && card.dmgType !== 'attack';
}

function targetSideFor(card, damageTypes) {
  const desc = String(card.desc || '');
  const battle = card && card.rules && card.rules.battle;
  if (battle && battle.target && Object.prototype.hasOwnProperty.call(battle.target, 'side')) {
    return battle.target.side ?? null;
  }
  if (ownsBuiltinExecutionDomain(card)) {
    if (card.type === '装备') return 'self';
    const ops = nativePlayOps(card);
    if (ops.some(operation => ['damage', 'stealAtk', 'execute', 'foeFight', 'recruitEnemy', 'markEnemy'].includes(operation.op)
      || operation.op === 'curse' && operation.target !== 'self')) return 'enemy';
    if (ops.some(operation => ['heal', 'armor', 'cleanse'].includes(operation.op))) return 'self';
    return null;
  }
  if (card?.id === 'cc-rot-seed') return 'enemy';
  // 需求 #18（2026-09-09）：未声明结构化目标的旧装备仍指向自己。
  if (card.type === '装备') return 'self';
  const isMove = damageTypes.includes(card.type);
  if (!isPureAreaEffect(card) && (isMove ? hasEnemyEffect(card) : (card.dmgType === 'attack' || isAreaEffect(card)))) return 'enemy';
  if (+(card.heal || 0) > 0 || +(card.armor || 0) > 0 || SELF_TARGET_PATTERN.test(desc)) return 'self';
  return null;
}

// 手牌代价句（2026-09-09 老板 #14：条件不满足时整张卡打不出去，而不是打出去再空过）——
// 正则收敛到 hand-cost-patterns.js 单一登记点（迭代评审 09-20）：与 effect-steps.js 的执行
// 正则同一来源，保证「判定」与「结算」永远同一口径，新增措辞只登记一处。
const CN_NUM = HAND_COST_CN_NUM;
function handCostOf(card) {
  const desc = String(card.desc || '');
  for (const re of HAND_COST_PATTERNS) {
    const m = re.exec(desc);
    if (!m) continue;
    return { n: CN_NUM[m[1]] || +m[1] || 1, type: !m[2] || m[2] === '牌' ? null : m[2] };
  }
  return null;
}
function handCardMatches(card, type) {
  if (!type) return true;
  if (type === '杀' || type === '初始攻击') return /^(杀|初始攻击)$/.test(card.name || '');
  return card.type === type;
}

function unplayableReasonFor(card, mode, ctx) {
  if (card.type === '资源') return '资源卡无法在对战中打出（资源在背包中使用或出售）';
  if (card.type === '事件') return '事件卡只能在棋盘的事件格中触发，无法打出';
  if (card.type === '生物') return '生物卡是敌人图鉴，记录敌人信息，无法打出';
  const battle = card && card.rules && card.rules.battle;
  // 原始复制卡仅在手牌内响应新打出的武术；变形后 findCard 返回被复制卡，自动解除此门。
  if (battle?.handTransform || (!ownsBuiltinExecutionDomain(card) && card.id === 'tt7-imitate') || battle?.hosted?.includes('imitate')) {
    return '先打出一张武术牌，使本牌变形';
  }
  // 封印之牌（受缚之残影/封印肢体1-4/化形后的深渊主宰，2026-09-16 定版）：
  // 抽到无效果也无法打出——集齐 5 张封印之牌后由 battle.core 破封化形
  const structuredRequirements = battle && Array.isArray(battle.requirements) ? battle.requirements
    : ownsBuiltinExecutionDomain(card) ? [] : null;
  if (structuredRequirements
    ? structuredRequirements.some(rule => rule.kind === 'unplayable')
    : /无法打出/.test(String(card.desc || ''))) {
    return '封印之牌：抽到时无效果，集齐 5 张封印之牌后破除封印';
  }
  if (mode === 'normal' && card.type === '能力卡') return '能力卡只能在对 BOSS 战时使用（普通战无法使用能力卡）';
  if (mode === 'boss' && card.type === '道具') return '道具卡只能在普通战斗中使用（BOSS 战牌库不含道具）';
  // Both battle modes have a real draw pile; deckOnly is satisfied in either.
  // 手牌代价不足（快意恩仇「消耗 2 张初始攻击」等）：整张卡不可打出，避免白消耗一张牌
  if (ctx && ctx.handCards) {
    const structuredCost = structuredRequirements && structuredRequirements.find(rule => rule.kind === 'handCards');
    const cost = structuredCost
      ? { n: Math.max(0, +(structuredCost.count ?? 1) || 0), type: structuredCost.type || null }
      : structuredRequirements ? null : handCostOf(card);
    if (cost) {
      const avail = ctx.handCards.filter(e => e.card !== ctx.selfCard && handCardMatches(e.card, cost.type)).length;
      if (avail < cost.n) {
        return `手牌中的${cost.type ? `「${cost.type}」` : ''}卡牌不足——需要 ${cost.n} 张，现有 ${avail} 张`;
      }
    }
  }
  return null;
}

// 战斗药水栏：需要拖/点到具体敌人身上的道具（冰冻药水/流血药水）；其余 null = 点击直接生效
function itemTargetSideFor(card) {
  if (!card || card.type !== '道具') return null;
  // M3 收编：结构化 bag.use 感知——单体诅咒/伤害 op 需要点选敌人（规则单源，desc 判定保留给未迁卡）
  const useOps = card.rules?.bag?.use;
  if (Array.isArray(useOps)) {
    if (useOps.some(op => op && (op.op === 'curse' || op.op === 'damage') &&
      op.target !== 'self' && op.target !== 'allEnemies')) return 'enemy';
    return null;   // 结构化道具的目标语义完全由 rules 表达
  }
  const desc = String(card.desc || '');
  if (/附加冰冻/.test(desc)) return 'enemy';
  if (/造成\s*\d+\s*点固定伤害，附加流血/.test(desc)) return 'enemy';
  return null;
}

// 随机敌人牌可在战场空地提交；仍交给原结算器掷目标，不改成全体伤害。
function isRandomEnemyEffect(card) {
  const operations = card?.rules?.triggers?.onPlay;
  if (Array.isArray(operations)) {
    return operations.some(op => op.target === 'randomEnemy')
      && !operations.some(op => op.target === 'chosenEnemy');
  }
  const text = String(card?.desc || '');
  return /随机(?:的)?(?:\s*\d+\s*名)?敌人|随机敌方/.test(text)
    && !/对\s*(?:1|一)\s*名敌人|对目标/.test(text);
}

export { isAreaEffect, isRandomEnemyEffect, targetSideFor, unplayableReasonFor, itemTargetSideFor };
