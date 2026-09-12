/* ============================================================
 * cards.view.js —— 卡牌视觉渲染（卡面 / 卡背 HTML）
 *
 * 从 cards.js 外迁（2026-09-11 架构批次 1：视图与数据分离）。
 * 只读消费 SDT.Cards 的数据 API 与 SDT.Icons / SDT.Art 资产映射；
 * cards.js 在 SDT.Cards 上保留同名转发属性，既有调用方不受影响。
 * ============================================================ */
import SDT from './sdt-facade.js';
import { characterName } from './characters.js';

// 卡背渲染：backId 缺省 = 当前存档装备的卡背（未选档时回退默认）。
// 样式类 hb-* 定义在 index.html；cls 控制尺寸场景（如缩略图）。
export function cardBackHTML(backId, cls) {
  const backs = SDT.Cards.CARD_BACKS;
  let id = backId;
  if (!id) {
    try { id = window.SDT.Base ? window.SDT.Base.backSel() : 'classic'; }
    catch (e) { id = 'classic'; }
  }
  const bd = backs.find(b => b.id === id) || backs[0];
  return `<div class="hs-back hb-${bd.id}${cls ? ' ' + cls : ''}">` +
    `<i class="hsb-frame"></i><span class="hsb-emblem">${SDT.Icons.img(bd.icon || 'cards')}</span><i class="hsb-shine"></i></div>`;
}

// 卡面渲染（em 布局，cls 控制尺寸 sm/lg/xl；game.js / battle.js 共用）
// opts.hideCost：隐去左上角费用角标——仅对 NO_COST_TYPES 生效（背包/宝箱等界面传 true，卡牌库不传）
// opts.costOverride：{ v } 战斗内实际费用（2026-09-09 需求 #16）——降低 = 绿字，提高 = 红字
export function cardHTML(c, cls, opts) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
  const hideCost = !!(opts && opts.hideCost) && SDT.Cards.NO_COST_TYPES.includes(c.type);
  const costBase = (opts && opts.costOverride && opts.costOverride.base != null) ? +opts.costOverride.base : (c.cost || 0);
  const costMod = (opts && opts.costOverride && +opts.costOverride.v !== costBase)
    ? { v: +opts.costOverride.v, base: costBase, down: +opts.costOverride.v < costBase } : null;
  const dmg = +(c.dmg || 0);
  const isDmgType = SDT.Cards.DMG_TYPES.includes(c.type);
  // 稀有度展示（2026-09-04 定版）：有效稀有度一律经 rarityOf 推导——
  // 能力卡与其衍生牌 = 棱彩（rv-prism 渐变流转，传说英雄走金光变体 rv-gold）；
  // 衍生物继承创造者稀有度；攻击词条允许负数字。
  // （性能：rarityOf 对衍生牌会全量解析卡库 JSON——只调一次，别重复调）
  const ro = SDT.Cards.rarityOf(c);
  const isPrism = ro === '棱彩';
  const rvCls = isPrism
    ? ('rv-prism' + ((c.rarity === '传说' ||
        (c.tokenOf && (SDT.Cards.all().find(x => x.id === c.tokenOf) || {}).rarity === '传说')) ? ' rv-gold' : ''))
    : 'rv' + Math.max(0, SDT.Cards.RARITIES.indexOf(ro));
  const ti = Math.max(0, SDT.Cards.TYPES.indexOf(c.type));
  const showDmg = isDmgType && (dmg > 0 || (dmg < 0 && c.dmgType === 'attack'));
  let mark = showDmg ? SDT.Cards.dmgMark(c.dmgType, dmg) : null;
  // 战斗内法伤加成同步（2026-09-09 需求）：卡面描述的数值随加成实时增加，
  // 数字略微放大以示区别——由 battle.view 传入 dmgOverride = { bonus }
  const dmgOverride = opts && opts.dmgOverride;
  const dmgUp = !!(showDmg && dmgOverride && +(dmgOverride.bonus || 0) > 0);
  if (dmgUp) mark = { ...mark, text: SDT.Cards.DMG_TYPE_META[c.dmgType].fmt(dmg + dmgOverride.bonus) };
  const ghostDmg = !showDmg && isDmgType && c._preview;
  // 桌游道具卡的币值角标（右下角金色硬币）
  const val = +(c.value || 0);
  const showVal = val > 0;
// 框色=职业（2026-09-12 v3 卡面定调）：战士赤铁/侠客青锋/法师秘法/牧师圣辉/降临者虚空，
// 无职业卡不带 cf-* 落到默认青灰；颜色变量见 winter.css 末尾 v3 卡框块。
const CF_SLUGS = { '战士': 'cf0', '侠客': 'cf1', '法师': 'cf2', '牧师': 'cf3', '降临者': 'cf4' };
// 描述富文本（v3 定调）：数字 Georgia 加大·金、术语冰蓝、句首「XX：」式关键字金。
// 顺序固定：先转义 → 关键字 → 术语 → 数字（正则均不含数字，不会互相污染标签）。
const DESC_TERMS = ['冰冻', '冻结', '中毒', '燃烧', '灼烧', '流血', '护甲', '法伤', '生命', '伤害', '诅咒', '净化', '沉默', '充能', '注能', '发现', '限定', '消耗', '装备', '牌库', '回合', '弃牌', '抽牌', '能量'];
function descRich(desc) {
  let s = esc(desc);
  s = s.replace(/^([^<>：\n]{1,10})：/, '<b class="d-kw">$1：</b>');
  s = s.replace(new RegExp('(' + DESC_TERMS.join('|') + ')', 'g'), '<i class="d-term">$1</i>');
  s = s.replace(/([⁺⁻+\-]?[0-9]+(?:\.[0-9]+)?)/g, '<b class="d-num">$1</b>');
  return s;
}
// 效果词条角标（类型行下方的小药丸；数据字段见文件头 draw / infuse / heal / armor）
const drawN = +(c.draw || 0), infN = +(c.infuse || 0);
  const healN = +(c.heal || 0), armN = +(c.armor || 0);
  const kwArr = [];
  if (drawN > 0) kwArr.push(`<span class="kw-draw" title="抽卡 ${drawN}：BOSS 战从牌库抽 ${drawN} 张 · 普通战斗改为获得 ${drawN} 张初始攻击">${SDT.Icons.img('cards')}抽 ${drawN}</span>`);
  if (infN > 0) {
    const alt = SDT.Cards.infuseAlt(c);
    kwArr.push(`<span class="kw-infuse${alt ? ' alt' : ''}" title="${escAttr(alt
      ? `注能(${infN})：打出时需先选择 ${infN} 张手牌消耗。该卡注能前后效果不同——${alt}`
      : `注能(${infN})：打出时需先选择 ${infN} 张手牌消耗才能发动`)}">${SDT.Icons.img('crystal')}注能 ${infN}</span>`);
  }
  if (healN > 0) kwArr.push(`<span class="kw-heal" title="回复 ${healN} 点生命（禁疗时无效）">${SDT.Icons.img('heart')}回 ${healN}</span>`);
  if (armN > 0) kwArr.push(`<span class="kw-armor" title="获得 ${armN} 点护甲">${SDT.Icons.img('plate')}甲 ${armN}</span>`);
  const kwHTML = kwArr.length ? `<div class="hsc-kw">${kwArr.join('')}</div>` : '';
  // 卡面插画按卡牌语义映射到统一位图家族。
  const artHTML = (window.SDT.Art && window.SDT.Art.cardIcon && window.SDT.Art.cardIcon(c)) ||
    SDT.Icons.img(SDT.Icons.TYPE_ART[c.type] || 'question');
  return `<div class="hs-card tp${ti} ${rvCls}${CF_SLUGS[c.cls] ? ' ' + CF_SLUGS[c.cls] : ''}${cls ? ' ' + cls : ''}">
    ${isPrism ? '<i class="rv-beam" aria-hidden="true"></i>' : ''}
    ${hideCost ? '' : costMod
      ? `<div class="hsc-cost cost-mod ${costMod.down ? 'mod-down' : 'mod-up'}" title="费用变化：按 ${costMod.v} 费打出（原 ${costMod.base} 费）">${costMod.v}</div>`
      : `<div class="hsc-cost">${c.cost}</div>`}
    <div class="hsc-art">${artHTML}</div>
    <div class="hsc-name"><span>${esc(c.name || '未命名卡牌')}</span></div>
    <div class="hsc-type">${esc(c.type || '?')} · ${esc(ro === '职业' ? ((c.cls ? characterName(c.cls) : '人物') + '专属') : ro)}</div>
    ${kwHTML}
    <i class="hsc-gem"></i>
    <div class="hsc-desc">${c.desc ? `<span>${descRich(c.desc)}</span>` : ''}</div>
    ${showDmg ? `<div class="hsc-dmg${dmgUp ? ' dmg-up' : ''}" title="${escAttr(dmgUp
      ? `${mark.tip}（含法伤加成 +${dmgOverride.bonus}）`
      : mark.tip)}">${mark.icon}<b>${mark.text}</b></div>` : ''}
    ${ghostDmg ? `<div class="hsc-dmg ghost">${SDT.Icons.img('swords')}<b>0</b></div>` : ''}
    ${showVal ? `<div class="hsc-val" title="币值 ${val}${SDT.Cards.isSellable(c) ? ' · 可出售' : ' · 不可出售'}"><i>[[icon:coin]]</i><b>${val}</b></div>` : ''}
  </div>`;
}
