import { STATUS_ICONS } from './status-icons.js';
// Shared current rule explanations, used by word tips and card inspection.
export const TERM_TIPS = {
  // —— 伤害类型（combat.js dealDamage）——
  attackDamage: { name: '攻击伤害', text: '按卡牌数值加你的攻击力结算；目标每有 1 层流血，额外增加 1 点伤害。可被闪避、格挡、减伤、护盾和护甲抵挡。' },
  spellDamage:  { name: '法术伤害', text: '按卡牌数值加你的法伤加成结算，不受攻击力或流血加成。可被闪避、格挡、减伤、护盾和护甲抵挡。' },
  fixedDamage:  { name: '固定伤害', text: '按标注数值结算，不受攻击力、法伤或流血加成，也会被闪避。卡牌造成的固定伤害仍会被格挡、减伤、护盾和护甲抵挡；中毒的状态伤害直接扣除生命。' },
  trueDamage:   { name: '真实伤害', text: '按标注数值结算，不受攻击力、法伤或流血加成。无视格挡、减伤、护盾和护甲，仍可被闪避；免疫伤害仍能阻挡。' },
  spellPower:   { name: '法伤', text: '法术伤害的额外加成：每增加 1 点法伤，法术伤害增加 1 点。不影响攻击、固定或真实伤害；卡牌另有倍率说明时按该牌效果计算。' },
  // —— 诅咒（combat.js CURSE_META，key 对齐状态字段）——
  bleed:   { name: '流血', icon: STATUS_ICONS.bleed,   text: '每层使受到的攻击伤害 +1。层数无上限、不会自然衰减。' },
  poison:  { name: '中毒', icon: STATUS_ICONS.poison,   text: '每层在回合结束时受到 1 点固定伤害。层数无上限、不会自然衰减。' },
  freeze:  { name: '冰冻', icon: STATUS_ICONS.freeze, text: '1 回合无法行动。' },
  silence: { name: '沉默', icon: STATUS_ICONS.silence,   text: '1 回合技能无法生效（攻击除外）。' },
  abreak:  { name: '破甲', icon: STATUS_ICONS.abreak,   text: '2 回合内无法减免伤害。' },
  healban: { name: '禁疗', icon: STATUS_ICONS.healban,   text: '2 回合内无法回复生命。' },
  atkDown: { name: '攻击降低', icon: STATUS_ICONS.atkDown, text: '持续期间攻击力降低，到期归还实际扣减的攻击力。' },
  // —— 祝福（combat.js BUFF_META；形态为 flag 型，本局对战常驻不递减）——
  atkUp:      { name: '攻击强化', icon: STATUS_ICONS.atkUp,   text: '攻击伤害 +N，持续到本场战斗结束。' },
  spellUp:    { name: '法术强化', icon: STATUS_ICONS.spellUp,  text: '法术伤害 +N，持续到本场战斗结束。' },
  stealth:    { name: '潜行',     icon: STATUS_ICONS.stealth,   text: '无法成为被攻击对象；造成伤害会破除潜行。' },
  immune:     { name: '免疫伤害', icon: STATUS_ICONS.immune, text: '不受到任何伤害。' },
  reduce:     { name: '减伤',     icon: STATUS_ICONS.reduce,    text: '每次受到的伤害 -N（真实伤害除外）。' },
  dodge:      { name: '闪避',     icon: STATUS_ICONS.dodge,   text: '避开下一段伤害，包括攻击、法术、固定和真实伤害；每段消耗 1 层。未标明持续时间的层数保留至本场战斗结束，限时来源按各自回合数到期。' },
  swordForm:  { name: '剑仙形态', icon: STATUS_ICONS.swordForm,    text: '回合开始时额外抽 1 张。形态是开关型祝福，本局对战常驻。' },
  natureForm: { name: '满月形态', icon: STATUS_ICONS.natureForm,     text: '回合开始时额外获得 1 点能量。形态是开关型祝福，本局对战常驻。' },
  cosmosForm: { name: '宇宙形态', icon: STATUS_ICONS.cosmosForm, text: '本局对战所有卡牌变为 1 费。形态是开关型祝福，本局对战常驻。' },
  // —— 机制词（卡面描述高亮词）——
  curse:      { name: '诅咒',     text: '负面状态的统称：流血、中毒、冰冻、沉默、破甲、禁疗、攻击降低。部分卡牌与「诅咒状态」联动（对被诅咒者增伤、按诅咒种类抽牌等）。' },
  purify:     { name: '净化',     text: '清除身上所有诅咒，层数与剩余回合全部归零。' },
  infuse:     { name: '注能',     text: '打出前消耗指定数量的手牌，启用本牌的注能效果；材料不计入「打出」。有基础效果时可不注能；必须注能的牌需先注能才能打出。' },
  charge:     { name: '充能',     text: '卡面写明「回合开始时，本牌伤害 +N」时，该牌每回合开始累计增加伤害，本场有效。其他充能卡的成长条件以卡面为准。' },
  discover:   { name: '发现',     text: '从三张随机卡牌（可限定卡池）中选择一张并获取。' },
  moves:      { name: '招式',     text: '武术与法术的统称：「所有招式」类效果对两种牌同时生效。' },
  exhaust:    { name: '消耗',     text: '被消耗的牌进入消耗牌堆，不自动洗回牌库，只能由卡牌效果取回。消耗本牌还是其他牌，以卡面说明为准。' },
  equipSkill: { name: '主动技能', text: '装备打出即穿戴；技能在角色信息区以按钮发动，每场战斗限一次。' },
  ability:    { name: '能力卡',   text: '只能收藏，普通战不会进入手牌；仅可编入 BOSS 战牌库使用。' },
  // —— 敌方词缀（battle.core AFFIX）——
  grow:       { name: '军威',     icon: 'arrow',   text: '该敌人每个回合结束时攻击力 +2。' },
  frenzy:     { name: '狂乱',     icon: 'tools',   text: '该敌人每回合攻击两次，每次附加 1 层流血或中毒。' },
  aegis:      { name: '元素庇幕', icon: 'crystal', text: '该敌人偶数回合减免所有伤害；「破甲」可克制。' },
};

export const TERM_KEYWORDS = Object.fromEntries(Object.entries(TERM_TIPS).map(([key, meta]) => [meta.name, key]));
