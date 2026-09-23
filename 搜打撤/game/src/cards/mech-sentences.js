// ======== 机制词条（制作坊一键写入规范句式，battle.core.applyTextEffects 按文本结算） ========
  // sen：匹配描述中整条机制句（含句尾标点）；cnt：读当前次数（第一个捕获组）
  // tpl(n)：生成规范句式；max：可叠加的最大次数（1 = 只能开/关）
const MECH_GROUPS = [
  { name: '诅咒 · 拖到敌人身上', items: [
    { k: 'bleed',   label: '流血', icon: 'blood',   tpl: n => `附加 ${n} 层流血。`, sen: /附加\s*\d*\s*层?\s*流血[^。；;]*。?/, cnt: /附加\s*(\d+)\s*层?\s*流血/, max: 5 },
    { k: 'poison',  label: '中毒', icon: 'skull',   tpl: n => `附加 ${n} 层中毒。`, sen: /附加\s*(?:\d+\s*层)?\s*中毒[^。；;]*。?/, cnt: /附加\s*(?:(\d+)\s*层)?\s*中毒/, max: 5 },
    { k: 'freeze',  label: '冰冻', icon: 'crystal', tpl: n => `附加冰冻，持续 ${n} 回合。`, sen: /附加冰冻[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
    { k: 'silence', label: '沉默', icon: 'cross',   tpl: n => `附加沉默，持续 ${n} 回合。`, sen: /附加沉默[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
    { k: 'abreak',  label: '破甲', icon: 'tools',   tpl: () => `附加破甲。`, sen: /附加破甲[^。；;]*。?/, max: 1 },
    { k: 'healban', label: '禁疗', icon: 'heart',   tpl: () => `附加禁疗。`, sen: /附加禁疗[^。；;]*。?/, max: 1 },
  ] },
  { name: '祝福 · 作用于自己', items: [
    { k: 'stealth', label: '潜行', icon: 'runner',  tpl: n => `获得潜行，持续 ${n} 回合。`, sen: /获得潜行[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
    { k: 'immune',  label: '免疫伤害', icon: 'sparkles', tpl: n => `免疫伤害，持续 ${n} 回合。`, sen: /免疫伤害[^。；;]*。?/, cnt: /持续\s*(\d+)\s*回合/, max: 3 },
    { k: 'atkUp',   label: '攻击力+', icon: 'swords', tpl: n => `获得 ${n} 点攻击力。`, sen: /获得\s*\d+\s*点\s*攻击力[^。；;]*。?/, cnt: /获得\s*(\d+)\s*点\s*攻击力/, max: 5 },
    { k: 'spellUp', label: '法伤+', icon: 'crystal',  tpl: n => `法伤 +${n}。`, sen: /法伤\s*\+\s*\d+[^。；;]*。?/, cnt: /法伤\s*\+\s*(\d+)/, max: 5 },
    { k: 'reduce',  label: '减伤', icon: 'plate',    tpl: n => `减伤 ${n}。`, sen: /减伤\s*\d*[^。；;]*。?/, cnt: /减伤\s*(\d+)/, max: 5 },
    { k: 'shield',  label: '护盾', icon: 'shield',   tpl: n => `获得 ${n} 点护盾。`, sen: /获得\s*\d+\s*点?\s*护盾[^。；;]*。?/, cnt: /获得\s*(\d+)\s*点?\s*护盾/, max: 9 },
    { k: 'guard',   label: '格挡', icon: 'shield',   tpl: () => `本回合所受伤害降为 1。`, sen: /本回合所受伤害降为[^。；;]*。?/, max: 1 },
    { k: 'purify',  label: '净化', icon: 'sparkles', tpl: () => `净化。`, sen: /净化[^。；;]*。?/, max: 1 },
  ] },
  { name: '资源 · 抽牌 / 能量', items: [
    { k: 'drawTxt', label: '抽牌', icon: 'cards',  tpl: n => `抽 ${n} 张牌。`, sen: /抽\s*\d+\s*张牌[^。；;]*。?/, cnt: /抽\s*(\d+)\s*张牌/, max: 5 },
    { k: 'discover', label: '发现', icon: 'lantern', tpl: n => `发现 ${n} 张卡牌。`, sen: /发现\s*\d*\s*张?\s*(?:传说)?(?:卡牌|牌|卡)[^。；;]*。?/, cnt: /发现\s*(\d+)\s*张?\s*(?:传说)?(?:卡牌|牌|卡)/, max: 3 },
    { k: 'random', label: '随机卡牌', icon: 'question', tpl: n => `获得 ${n} 张随机卡牌。`, sen: /(?:获得|获取)?\s*\d+\s*张随机卡牌[^。；;]*。?/, cnt: /获得\s*(\d+)\s*张随机卡牌/, max: 3 },
    { k: 'energy', label: '获得能量', icon: 'bolt', tpl: n => `获得 ${n} 点能量。`, sen: /获得\s*\d+\s*点?能量(?!上限)[^。；;]*。?/, cnt: /获得\s*(\d+)\s*点?能量/, max: 3 },
    { k: 'maxEner', label: '能量上限+', icon: 'bolt', tpl: () => `能量上限 +1。`, sen: /能量上限\s*\+\s*\d+[^。；;]*。?/, max: 1 },
  ] },
  ];
const MECH_ALL = MECH_GROUPS.flatMap(g => g.items);

export { MECH_GROUPS, MECH_ALL };
