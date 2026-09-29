/* 由 effect-steps.js 拆出（2026-09-22 六文件重构批1）：模块级共享常量与 hitFoe 工厂。
 * 供壳 effect-steps.js 组装 shared 端口后注入各分节；外部 API（POOL_NUM_MAP/parsePoolNoun）
 * 仍由 effect-steps.js 转出，导入方路径不变。 */
/* 「箭」战斗令牌模板（2026-09-13 实装）：卡库中不存在任何名为「箭」的牌，导致
 * 天狼长弓（回合开始获得随机箭矢）与连弩（直接释放手牌中所有「箭」）两张卡自实装以来
 * 从未真正生效。这里给战斗层一块虚拟令牌：只作为临时卡进手牌，不进卡库
 * （id 不入 Cards.all()，不影响卡库与设计者档的对齐断言）、不可掉落/发现/上架。
 * 数值口径随「初始攻击」家族：0 费、造成等同攻击力的伤害；调数值改这一处即可。 */
const ARROW_TOKEN = { id: 'token-arrow', name: '箭', cost: 0, rarity: '衍生', type: '武术',
  desc: '造成等同于攻击力的伤害。', dmg: 0, dmgType: 'attack', unrandom: true };

/* ---------- 限制卡池解析（老板 2026-09-08 定版池子清单） ----------
 * 「发现 / 随机获取 / 获得 N 张 ____卡/牌」句式中的名词短语 → 卡池谓词。
 * 返回 null = 未识别出限定（走通用随机池，isRandomObtainable 过滤）。 */
export const POOL_NUM_MAP = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
const CURSE_DESC_RE = /诅咒|中毒|流血|冰冻|沉默|破甲|禁疗|灼烧/;
const CURSE_CAPABLE = (c) => ['武术', '法术', '装备', '能力卡'].includes(c.type) &&
  CURSE_DESC_RE.test(String(c.desc || ''));

export function parsePoolNoun(raw, myClass) {
  let s = String(raw || '');
  if (!s.endsWith('能力卡')) s = s.replace(/(卡牌|的牌|牌|卡)$/, '');
  s = s.replace(/的$/, '');
  if (!s || s === '随机' || s === '另' || s === '任意' || s === '等量随机') return null;
  const preds = [];
  const cm = s.match(/^([0-5一二三四五])费/);
  if (cm) {
    const n = POOL_NUM_MAP[cm[1]] != null ? POOL_NUM_MAP[cm[1]] : +cm[1];
    s = s.slice(cm[0].length);
    preds.push(c => (+c.cost || 0) === n);
  }
  if (/^能施加诅咒/.test(s)) {
    s = s.replace(/^能施加诅咒的?/, '');
    preds.push(CURSE_CAPABLE);
  }
  if (/^(其它|其他)职业/.test(s)) { s = ''; preds.push(c => !!c.cls && !!myClass && c.cls !== myClass && c.type !== '能力卡'); }   // 江湖救急只发现其它职业的招式与装备（2026-09-16 留言）
  else if (/^本职业/.test(s)) { s = ''; preds.push(c => !!c.cls && c.cls === myClass); }
  if (/^招式/.test(s)) { s = s.replace(/^招式/, ''); preds.push(c => c.type === '武术'); }
  // 复合池「传说或能力」（神秘召唤）：指定稀有度 或 能力卡类型。
  // 「发现一张传说或能力卡」的名词会被上层后缀匹配吃掉「能力卡」只剩「传说或」，
  // 因此结尾的「能力/或」都要兼容（2026-09-16 留言「神秘召唤卡池错误」修复）
  const om = s.match(/^(传说|史诗|稀有|古朴)(?:或能力卡|或能力|或)?$/);
  if (om) { s = ''; preds.push(c => c.rarity === om[1] || c.type === '能力卡'); }
  const typeKey = ['武术', '法术', '装备', '能力卡', '道具'].find(t => s === t);
  if (typeKey) { s = ''; preds.push(c => c.type === typeKey); }
  const rarKey = ['传说', '史诗', '稀有', '古朴'].find(r => s === r);
  if (rarKey) { s = ''; preds.push(c => c.rarity === rarKey); }
  const series = /系列$/.test(s);
  const base = s.replace(/系列$/, '');
  if (['火球', '箭', '箭矢', '药水', '杀', '禁咒', '形态', '射线'].includes(base)) {
    s = '';
    const key = base === '箭矢' ? '箭' : base;
    if (key === '杀') preds.push(c => c.id === 'starter-attack' || c.name === '杀' || c.name === '初始攻击');
    else if (key === '火球') preds.push(series ? (c => String(c.name || '').includes('火球')) : (c => c.name === '火球'));
    else if (key === '箭') preds.push(c => String(c.name || '').includes('箭'));
    else if (key === '药水') preds.push(c => c.type === '道具' && String(c.name || '').includes('药水'));   // 药水池定版（2026-09-09）：所有带「药水」名字的道具——法术「药水魔法」不在池内
    else if (key === '禁咒') preds.push(c => String(c.name || '').startsWith('禁咒'));
    else if (key === '形态') preds.push(c => /形态/.test(String(c.name || '')));
    // 第十二批（2026-09-23）：射线枪「发现一张射线牌」——只取可发现的射线法术
    //（type 过滤排除射线枪自身（装备）；unrandom 排除职业版致命射线，职业卡不进发现池）
    else if (key === '射线') preds.push(c => c.type === '法术' && !c.unrandom && String(c.name || '').includes('射线'));
  }
  if (/^注能/.test(s)) { s = ''; preds.push(c => +(c.infuse || 0) > 0 || /注能/.test(String(c.desc || ''))); }
  if (!preds.length || s) return null;   // 有未识别的残留名词 → 交回通用池，避免误配
  return c => preds.every(p => p(c));
}

const CN_NUM = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5 };
const num = (s) => (CN_NUM[s] != null ? CN_NUM[s] : +s);
const HALT = (result) => ({ halt: true, result });
const FRESH_RESULT = (did) => ({ did, drawn: false, healed: false, armored: false });

/** 对单个目标结算伤害并冒伤害数字（原 effect-steps.js 117-124，逐字搬迁）。 */
export function makeHitFoe(deps) {
  const {combat, pushFloat, foeIndexOf, sweepDead} = deps;
    const hitFoe = (ctx, t, n, type, caster = {}, segmentOrder) => {
      const hpBefore = t.hp;
      const shieldBefore = t.defense?.shield || 0;
      const r = combat.dealDamage(caster, t, n, type);
      const shieldBreak = shieldBefore > 0 && !(t.defense?.shield || 0);
      if (r.dealt > 0 || shieldBreak) pushFloat({ unit: foeIndexOf ? foeIndexOf(t) : 0,
        text: r.dealt > 0 ? '-' + r.dealt : '护盾破碎', cls: r.dealt > 0 ? 'dmg' : 'block', type,
        label: segmentOrder ? `第 ${segmentOrder} 段` : '', sequence: segmentOrder,
        hpBefore, hpAfter: t.hp, maxHp: t.maxHp,
        shieldBreak });   // 文本结算多段也逐段标号
      // 文本步骤路径不经过 battle.core 的 hitFoe，0 血死亡判定补在这里（2026-09-13 实测：快意恩仇打至 0 血敌人不倒）
      if (t && !t.dead && t.hp <= 0 && typeof sweepDead === 'function') sweepDead();
      return r;
    };
  return hitFoe;
}
export { ARROW_TOKEN, CN_NUM, num, HALT, FRESH_RESULT };
