const AOE_PATTERN = /所有敌人|群体|全体/;
const SELF_TARGET_PATTERN = /回复\s*\d+\s*(?:点\s*生命|点?血)|净化|获得\s*\d+\s*点?\s*护甲|\+\s*\d+\s*甲|获得\s*\d+\s*点?\s*护盾|所受伤害降为/;
const DECK_ONLY_PATTERN = /洗入|置入牌库|放入牌库|牌库底|牌库上限/;
// 「对敌方施加的效果」词条（2026-09-09 老板 #7）：招式里确实作用于敌方的才需要指向敌人
const ENEMY_EFFECT_PATTERN = new RegExp([
  '造成\\s*\\d+\\s*点',
  '\\d+\\s*[′\']',
  '攻\\s*[（(]?\\s*[+＋\\-−]?\\s*\\d',
  '攻击\\s*\\d',
  '所有敌人', '全体敌人', '敌方全体', '目标为敌方全体',
  '附加\\s*(?:\\d+\\s*层?)?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|灼烧)',
  '(?:施加|叠加)\\s*\\d*\\s*层?(?:流血|中毒|冰冻|沉默|破甲|禁疗|陷阱|诅咒)',
  '消灭', '降低\\s*\\d+\\s*点?攻击力', '偷取[^。]{0,12}攻击力', '夺取[^。]{0,12}攻击力',
  '无法(?:行动|使用|打出)',
  '沉默', '冰冻', '火球', '迫使', '对方',
  '使[^。]{0,12}(?:中毒|流血|冰冻|沉默)层数',
  '触发\\s*\\d*\\s*次?毒伤',
].join('|'));

function isAreaEffect(card) {
  return AOE_PATTERN.test(String(card.desc || ''));
}

// 该卡是否对敌方施加效果（结构化伤害字段优先，其次描述词条）
function hasEnemyEffect(card) {
  if (+(card.dmg || 0) > 0) return true;
  if (card.dmgType === 'attack') return true;
  return ENEMY_EFFECT_PATTERN.test(String(card.desc || ''));
}

// ---------- 目标规则（2026-09-09 老板定向：群体卡也拖到敌人身上打出，对任意敌人都生效） ----------
// 'enemy' = 对敌方施加效果的卡 → 拖到任意敌人身上打出（群体效果结算时自动覆盖全体）
// 'self'  = 治疗/净化/护甲/护盾/格挡类 → 拖到自己（立绘）身上
// null    = 无指向效果（抽牌/发现/能量/召唤…）→ 直接点击打出，也可拖到战场空地
// 2026-09-09 老板 #7：武术/法术不再一律要求指向敌人——只有 hasEnemyEffect 的招式才指向敌人，
// 其余招式（纯增益、召唤、摸牌、资源类）拖到敌我中间即可打出
// 2026-09-15 老板定向：群体指向牌（无单体伤害）没有目标可言——拖到战场空白处即可打出，
// 点卡也直接打出；带伤害的群体牌（箭雨/旋风斩）仍指向敌人，保留伤害预览
function isPureAreaEffect(card) {
  return isAreaEffect(card) && !(+(card.dmg || 0) > 0) && card.dmgType !== 'attack';
}

function targetSideFor(card, damageTypes) {
  const desc = String(card.desc || '');
  // 需求 #18（2026-09-09）：装备装配要指向自己——拖到左侧「你」的立绘上穿戴
  if (card.type === '装备') return 'self';
  const isMove = damageTypes.includes(card.type);
  if (!isPureAreaEffect(card) && (isMove ? hasEnemyEffect(card) : (card.dmgType === 'attack' || isAreaEffect(card)))) return 'enemy';
  if (+(card.heal || 0) > 0 || +(card.armor || 0) > 0 || SELF_TARGET_PATTERN.test(desc)) return 'self';
  return null;
}

// 手牌代价句（2026-09-09 老板 #14：条件不满足时整张卡打不出去，而不是打出去再空过）——
// 正则与 battle.effects.js 的执行正则一一对应，保证「判定」与「结算」永远同一口径。
const HAND_COST_PATTERNS = [
  // 「消耗 N 张 X，效果」：battle.effects consM
  /消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$/,
  // 「选择 N 张手牌中的 X 施放/打出」：battle.effects selPlay
  /选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)/,
];
const CN_NUM = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
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
  // 封印之牌（受缚之残影/封印肢体1-4/化形后的深渊主宰，2026-09-16 定版）：
  // 抽到无效果也无法打出——集齐 5 张封印之牌后由 battle.core 破封化形
  if (/无法打出/.test(String(card.desc || ''))) return '封印之牌：抽到时无效果，集齐 5 张封印之牌后破除封印';
  if (mode === 'normal' && card.type === '能力卡') return '能力卡只能在对 BOSS 战时使用（普通战无法使用能力卡）';
  if (mode === 'boss' && card.type === '道具') return '道具卡只能在普通战斗中使用（BOSS 战牌库不含道具）';
  if (mode === 'normal' && DECK_ONLY_PATTERN.test(String(card.desc || ''))) {
    return '「牌库」词条只有对战 BOSS 时生效——普通战斗没有牌库与墓地，无法打出';
  }
  // 手牌代价不足（快意恩仇「消耗 2 张初始攻击」等）：整张卡不可打出，避免白消耗一张牌
  if (ctx && ctx.handCards) {
    const cost = handCostOf(card);
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
  const desc = String(card.desc || '');
  if (/附加冰冻/.test(desc)) return 'enemy';
  if (/造成\s*\d+\s*点固定伤害，附加流血/.test(desc)) return 'enemy';
  return null;
}

export { isAreaEffect, targetSideFor, unplayableReasonFor, itemTargetSideFor };
