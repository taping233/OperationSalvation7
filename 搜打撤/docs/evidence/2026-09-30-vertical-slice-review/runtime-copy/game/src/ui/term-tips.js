/* 词条讲解浮框（2026-09-20 老板：特殊词条触摸时要有我们自己绘制的文字框描述讲解，如形态/中毒等诅咒）
 * 全局单例 + 事件委托：卡面描述高亮词（descRich 输出的 data-term）与战斗状态角标（bt-curse/bt-buff、
 * 诅咒之刃 chips、敌方狂乱角标）统一由 document 级委托接管，渲染点零改动自动生效。
 * 交互口径与药水自绘提示栏一致（09-20 定版）：桌面悬停即显、移开即收；触屏按下即显、松手收起。
 * 点在词条上只讲解——捕获层拦掉 click，防止顺手触发卡面特写/出牌。
 * 讲解文案以机制代码为底稿：诅咒/祝福 = combat.js CURSE_META/BUFF_META；注能 = 出牌结算 fuel 链；
 * 发现 = 三选一置入手牌；消耗 = 墓地不洗回；主动技能 = 装备穿戴后角色信息区按钮发动（每场一次）；
 * 狂乱 = battle.core AFFIX 表。 */
import SDT from '../core/sdt-facade.js';
import { scale } from './ui-scale.js';

const TERM_TIPS = {
  // —— 诅咒（combat.js CURSE_META，key 对齐状态字段）——
  bleed:   { name: '流血', icon: 'blood',   text: '每层使受到的攻击伤害 +1。层数无上限、不会自然衰减。' },
  poison:  { name: '中毒', icon: 'skull',   text: '每层在回合结束时受到 1 点固定伤害。层数无上限、不会自然衰减。' },
  freeze:  { name: '冰冻', icon: 'crystal', text: '1 回合无法行动。' },
  silence: { name: '沉默', icon: 'cross',   text: '1 回合技能无法生效（攻击除外）。' },
  abreak:  { name: '破甲', icon: 'tools',   text: '2 回合内无法减免伤害。' },
  healban: { name: '禁疗', icon: 'heart',   text: '2 回合内无法回复生命。' },
  burn:    { name: '灼烧', icon: 'fire',    text: '每回合结束时受到 1 点固定伤害；不叠加，重复施加刷新持续时间。' },
  // —— 祝福（combat.js BUFF_META；形态为 flag 型，本局对战常驻不递减）——
  atkUp:      { name: '攻击强化', icon: 'swords',   text: '攻击伤害 +N，持续到本场战斗结束。' },
  spellUp:    { name: '法术强化', icon: 'crystal',  text: '法术伤害 +N，持续到本场战斗结束。' },
  stealth:    { name: '潜行',     icon: 'runner',   text: '无法成为被攻击对象；造成伤害会破除潜行。' },
  immune:     { name: '免疫伤害', icon: 'sparkles', text: '不受到任何伤害。' },
  reduce:     { name: '减伤',     icon: 'plate',    text: '每次受到的伤害 -N（真实伤害除外）。' },
  dodge:      { name: '闪避',     icon: 'runner',   text: '免疫下一次攻击——完全避开该次攻击的全部伤害，每层避开 1 次；法术与真实伤害不可闪避，回合结束未用完的层数失效。' },
  swordForm:  { name: '剑仙形态', icon: 'sword',    text: '回合开始时额外抽 1 张。形态是开关型祝福，本局对战常驻。' },
  natureForm: { name: '自然形态', icon: 'wood',     text: '回合开始时额外获得 1 点能量。形态是开关型祝福，本局对战常驻。' },
  cosmosForm: { name: '宇宙形态', icon: 'sparkles', text: '本局对战所有卡牌变为 1 费。形态是开关型祝福，本局对战常驻。' },
  // —— 机制词（卡面描述高亮词）——
  curse:      { name: '诅咒',     text: '负面状态的统称：流血、中毒、冰冻、沉默、破甲、禁疗、灼烧。部分卡牌与「诅咒状态」联动（对被诅咒者增伤、按诅咒种类抽牌等）。' },
  purify:     { name: '净化',     text: '清除身上所有诅咒，层数与剩余回合全部归零。' },
  infuse:     { name: '注能',     text: '打出前可点卡面「注能」角标，牺牲若干张手牌强化本牌效果；牺牲品进入墓地、不计入「打出」。不注能则按弱效果直接打出。' },
  charge:     { name: '充能',     text: '「回合开始时，本牌伤害 +N」——该牌每回合开始永久成长，整场对战按牌累计（如充能火山）。' },
  discover:   { name: '发现',     text: '展示若干张随机牌（可限定卡池），选择其中一张置入手牌。' },
  exhaust:    { name: '消耗',     text: '此牌打出后进入墓地，不再参与洗回；部分卡牌需要「消耗」其他手牌作为发动代价。' },
  equipSkill: { name: '主动技能', text: '装备打出即穿戴；技能在角色信息区以按钮发动，每场战斗限一次。' },
  ability:    { name: '能力卡',   text: '只能收藏，普通战不会进入手牌；仅可编入 BOSS 战牌库使用。' },
  // —— 敌方词缀（battle.core AFFIX）——
  grow:       { name: '军威',     icon: 'arrow',   text: '该敌人每个回合结束时攻击力 +2。' },
  frenzy:     { name: '狂乱',     icon: 'tools',   text: '该敌人每回合攻击两次，每次附加 1 层流血或中毒。' },
  aegis:      { name: '元素庇幕', icon: 'crystal', text: '该敌人偶数回合减免所有伤害；「破甲」可克制。' },
};

// 卡面描述文本词 → 词条 key（仅收有讲解内容的词；伤害/生命/回合等常识词保持纯高亮不弹框）
const TERM_ALIAS = {
  '冰冻': 'freeze', '冻结': 'freeze', '中毒': 'poison', '燃烧': 'burn', '灼烧': 'burn',
  '流血': 'bleed', '沉默': 'silence', '诅咒': 'curse', '净化': 'purify', '充能': 'charge',
  '注能': 'infuse', '发现': 'discover', '消耗': 'exhaust', '限定': 'equipSkill', '主动技能': 'equipSkill',
};

export function termKeyFor(word) { return TERM_ALIAS[word] || null; }
export function termMeta(key) { return TERM_TIPS[key] || null; }

let tipEl = null;
let curEl = null;

function ensureTip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.className = 'term-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
  return tipEl;
}

function show(el) {
  const meta = termMeta(el.getAttribute('data-term'));
  if (!meta) return;
  if (curEl === el && tipEl && !tipEl.hidden) return;   // 同一词条重复 over 不重算
  curEl = el;
  const tip = ensureTip();
  const icon = meta.icon && SDT.Icons && SDT.Icons.img ? SDT.Icons.img(meta.icon) : '';
  tip.innerHTML = `${icon}<b>${meta.name}</b><span class="term-tip-sep">——</span>${meta.text}`;
  tip.hidden = false;
  // 定位：ui-scale zoom 挂 html，视觉 px ÷ scale = CSS 布局 px（fixed 定位走布局坐标）
  const sc = scale() || 1;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth / sc, vh = window.innerHeight / sc;
  const x = r.left / sc, y = r.top / sc, w = r.width / sc, h = r.height / sc;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  const left = Math.min(Math.max(x + w / 2 - tw / 2, 8), Math.max(8, vw - tw - 8));
  let top = y - th - 8;
  if (top < 8) top = Math.min(y + h + 8, vh - th - 8);
  tip.style.left = `${Math.round(left)}px`;
  tip.style.top = `${Math.round(top)}px`;
}

function hide() { curEl = null; if (tipEl) tipEl.hidden = true; }

function closestTerm(t) { return t && t.closest ? t.closest('[data-term]') : null; }

function initTermTips() {
  // 桌面：悬停即显，移到非词条处即收（pointerover else 分支 = mouseleave 语义的委托版）
  document.addEventListener('pointerover', (e) => {
    const t = closestTerm(e.target);
    if (t) show(t); else hide();
  });
  // 触屏：按下即显，松手收起（药水提示栏同口径，once 防残留）
  document.addEventListener('pointerdown', (e) => {
    const t = closestTerm(e.target);
    if (!t) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    show(t);
    const end = () => hide();
    document.addEventListener('pointerup', end, { once: true });
    document.addEventListener('pointercancel', end, { once: true });
  });
  // 点在词条上只讲解：捕获层拦掉 click，不触发卡面特写/出牌/按钮
  document.addEventListener('click', (e) => {
    if (!closestTerm(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // 滚动即收（capture 覆盖内部滚动容器）
  window.addEventListener('scroll', hide, true);
}

// main.js 为 ESM defer 链，模块执行时 DOM 已解析，直接挂
initTermTips();
