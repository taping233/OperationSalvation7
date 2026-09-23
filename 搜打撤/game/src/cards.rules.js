/* 由 cards.js 拆出（2026-09-22 六文件重构批2）：元数据/词条推导/经济掉落规则。
 * 逐字搬迁，属性顺序=原文件顺序；在壳 cards.js 中展开装配为 SDT.Cards，键面与数据字节不变。 */
const SDT = window.SDT;   // ESM 垫片（与 cards.js 同源，main.js 加载顺序保证已存在）
import { CLASSES } from './cards.consts.js';
import { Random } from './random.js';
import { cardHTML } from './cards.view.js';
import { DATA } from './data-loader.js';

let fixedCardIdSet;
function fixedCardIds() {
  if (!fixedCardIdSet) {
    const batches = Object.entries(SDT.Cards)
      .filter(([key]) => /^TABLETOP\d*$/.test(key))
      .flatMap(([, cards]) => cards || []);
    fixedCardIdSet = new Set([...batches, ...DATA.cardsSync.cards]
      .map(entry => typeof entry === 'string' ? entry : entry?.id).filter(Boolean));
  }
  return fixedCardIdSet;
}
export const rulesSlice = {
    // 2026-09-04 定版增补：稀有度新增「棱彩」（能力卡及其衍生牌专属，rv7/渐变棱彩）；
    // 稀有稀有度宝石改为蓝色（原黑色，见 base.css rv2）。
    RARITIES: ['初始', '古朴', '稀有', '史诗', '传说', '衍生', '职业', '棱彩'],
    // 类型新增「生物」（2026-09-04 定版：敌人图鉴卡，与武术/法术等并列；无法打出）
    // 类型新增「生物」（2026-09-04 定版：敌人图鉴卡，与武术/法术等并列；无法打出）
    TYPES: ['武术', '法术', '生物', '道具', '装备', '事件', '能力卡', '资源'],
    TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '能力卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
    // 类型到位图图标名（卡面插画与页签用；TYPE_ICON 保留给纯文本场景）
    // 类型到位图图标名（卡面插画与页签用；TYPE_ICON 保留给纯文本场景）
    TYPE_ART: { '武术': 'swords', '法术': 'sparkles', '生物': 'paw', '道具': 'flask', '装备': 'shield', '事件': 'dice', '能力卡': 'helmet', '资源': 'wood' },
    // 拥有伤害词条（红色伤害宝石）的类型
    DMG_TYPES: ['武术', '法术'],

    // 无能量消耗的类型（2026-09-08 老板定版）：道具/生物/资源/装备/事件不耗能量，
    // 在背包与宝箱等界面展示时隐去左上角费用角标（卡牌库中仍显示，见 cardHTML 第 3 参 opts.hideCost）

    // 无能量消耗的类型（2026-09-08 老板定版）：道具/生物/资源/装备/事件不耗能量，
    // 在背包与宝箱等界面展示时隐去左上角费用角标（卡牌库中仍显示，见 cardHTML 第 3 参 opts.hideCost）
    NO_COST_TYPES: ['道具', '生物', '资源', '装备', '事件'],

    // 四类伤害体系元数据（设计者 2026-09-01 定版，docs/design.md §3；
    // 2026-09-04 修订：攻击数字允许为负（在攻击力基础上减去 |n|），总伤害最低 0）

    // 四类伤害体系元数据（设计者 2026-09-01 定版，docs/design.md §3；
    // 2026-09-04 修订：攻击数字允许为负（在攻击力基础上减去 |n|），总伤害最低 0）
    DMG_TYPE_META: {
      // 四类伤害体系的角标图标统一走位图资源。
      attack: { name: '攻击', icon: SDT.Icons.img('swords'), fmt: (n) => n < 0 ? `${n}` : `+${n}`, tip: '攻（±n）＝ 攻击力 + n（可为负修正，总伤害最低 0），可触发流血' },
      spell:  { name: '法术', icon: SDT.Icons.img('sparkles'), fmt: (n) => `${n}'`, tip: "n' ＝ n + 法伤加成" },
      fixed:  { name: '固定', icon: '[[icon:crystal]]', fmt: (n) => `${n}`,  tip: 'n ＝ 固定伤害，不受任何加成' },
      true:   { name: '真实', icon: SDT.Icons.img('bolt'), fmt: (n) => `${n}''`, tip: "n'' ＝ 真实伤害，无视一切防御手段" },
    },
    DMG_TYPE_ORDER: ['attack', 'spell', 'fixed', 'true'],

    // 卡面左下角伤害宝石按类型显示（icon + 数字节标 + 悬浮说明）

    // 卡面左下角伤害宝石按类型显示（icon + 数字节标 + 悬浮说明）
    dmgMark(dmgType, dmg) {
      const m = SDT.Cards.DMG_TYPE_META[dmgType] || SDT.Cards.DMG_TYPE_META.fixed;
      return { icon: m.icon, text: m.fmt(dmg), tip: m.tip };
    },

    // 推导伤害类型词条（ensureDmgTypes 回填用，只读不写）：
    //   1. 已标注 dmgType → 原样
    //   2. 描述「攻 N 点」（如血箭/流光斩）→ attack（写成攻（+n）的才是攻击伤害）
    //   3. 描述带 n′/n' 记号（如火球 4′、冰刺 1′）→ spell
    //   4. 其余带「N 点伤害」描述 → 法术卡 = spell；武术/道具等纯数字 = fixed
    //      （设计者规则：「射击」2 点为固定伤害，流血不自动掉血、层数无上限不衰减）

    // 推导伤害类型词条（ensureDmgTypes 回填用，只读不写）：
    //   1. 已标注 dmgType → 原样
    //   2. 描述「攻 N 点」（如血箭/流光斩）→ attack（写成攻（+n）的才是攻击伤害）
    //   3. 描述带 n′/n' 记号（如火球 4′、冰刺 1′）→ spell
    //   4. 其余带「N 点伤害」描述 → 法术卡 = spell；武术/道具等纯数字 = fixed
    //      （设计者规则：「射击」2 点为固定伤害，流血不自动掉血、层数无上限不衰减）
    deriveDmgType(card) {
      if (SDT.Cards.DMG_TYPE_META[card.dmgType]) return card.dmgType;
      const desc = String(card.desc || '');
      // 「攻 N 点」（旧转写）或「攻（+n）／攻⁺n」（新记号）才算攻击伤害，
      // 避免「攻击 +1」这类装备强化描述误判
      if (/攻\s*[0-9]+\s*点/.test(desc) || /攻\s*（?\s*[+＋⁺]\s*[0-9]+/.test(desc)) return 'attack';
      if (/[0-9]\s*[′']/.test(desc)) return 'spell';
      // 「无视护甲 / 真实伤害」= 真实伤害（穿刺/斩杀，2026-09-04 定版补正）
      if (/无视护甲|真实伤害/.test(desc)) return 'true';
      // 「造成 N 点伤害」句式：法术卡 = 法术伤害；武术/道具等纯数字 = 固定伤害
      // （设计者规则：「射击」2 点为固定伤害；「格挡：所受伤害降为 1」不是伤害卡）
      if (/造成[^。；]*[0-9]+\s*点伤害/.test(desc)) {
        return card.type === '法术' ? 'spell' : 'fixed';
      }
      // 有伤害数值但描述无句式线索：按卡牌类型兜底
      if (+(card.dmg || 0) > 0) return card.type === '法术' ? 'spell' : 'fixed';
      return undefined;
    },

    // 伤害数值推导（ensureDmgValues 回填用，只读不写）：
    // 描述以「N′」开头给出伤害但 dmg 字段缺失的法术（如 银刺 5′、冰刺 1′）→ N。
    // 描述以「注能(」开头的卡（如 诅咒光波，全部效果在注能后）不推导，避免虚增基础伤害。

    // 伤害数值推导（ensureDmgValues 回填用，只读不写）：
    // 描述以「N′」开头给出伤害但 dmg 字段缺失的法术（如 银刺 5′、冰刺 1′）→ N。
    // 描述以「注能(」开头的卡（如 诅咒光波，全部效果在注能后）不推导，避免虚增基础伤害。
    deriveDmgValue(card) {
      if (+(card.dmg || 0) > 0) return +card.dmg;
      if (!SDT.Cards.DMG_TYPES.includes(card.type)) return 0;
      const desc = String(card.desc || '').trim();
      if (/^注能\s*[（(]/.test(desc)) return 0;
      const m = desc.match(/(?:^|[：:，,]\s*)?(\d+)\s*′/);
      return m ? +m[1] : 0;
    },

    // 伤害类型词条回填：只补缺失值，绝不覆盖玩家已标注的 dmgType（每次启动运行）

    // 抽卡词条推导（ensureEffectFields 回填用，只读不写）：
    // 已标注 draw → 原样；描述「抽 N 张牌」→ N（与 battle.js 的描述结算同一线）。
    // 2026-09-08 词条统一（老板指示）：「抽 N 张」（省略「牌」字）与「抽 N-M 张」区间
    // （取下限）同样视为抽卡词条；「从牌库中抽取」（检索牌库）与「额外抽」（形态
    // 每回合效果）不是一次性抽牌，不计入，避免卡面出现误导角标。
    deriveDraw(card) {
      if (+(card.draw || 0) > 0) return +card.draw;
      const desc = String(card.desc || '')
        .replace(/从\s*牌库[^。；;]*?抽[取]?\s*\d+\s*张[^。，；;]*/g, ' ')
        .replace(/额外\s*抽\s*\d+\s*张[^。，；;]*/g, ' ');
      const m = desc.match(/抽\s*(\d+)\s*[-—~～至]\s*(\d+)\s*张/) || desc.match(/抽(?:取)?\s*(\d+)\s*张/);
      return m ? +m[1] : 0;
    },

    // 注能词条推导：「注能(N)」→ N；「注能(小)」→ 1（设计者记号：小 = 1 张）

    // 注能词条推导：「注能(N)」→ N；「注能(小)」→ 1（设计者记号：小 = 1 张）
    deriveInfuse(card) {
      if (+(card.infuse || 0) > 0) return +card.infuse;
      const m = String(card.desc || '').match(/注能\s*[（(]\s*(\d+|小)\s*[)）]/);
      return m ? (m[1] === '小' ? 1 : +m[1]) : 0;
    },

    // 注能变体词条（2026-09-04 定版提醒）：描述里带「注能(N)：…」子句的卡，
    // 注能前后效果不同——卡面角标与战斗内注能提示条都会展示该子句提醒玩家。

    // 注能变体词条（2026-09-04 定版提醒）：描述里带「注能(N)：…」子句的卡，
    // 注能前后效果不同——卡面角标与战斗内注能提示条都会展示该子句提醒玩家。
    infuseAlt(card) {
      if (!(+(card.infuse || 0) > 0)) return null;
      const m = String(card.desc || '').match(/注能\s*[（(]\s*(?:\d+|小)\s*[)）]\s*[：:]?\s*[^。；;]*/);
      return m ? m[0].trim() : null;
    },

    // 回复词条推导（v0.25 正式词条化）：「回复 N 点生命/血」「+N 血」→ N

    // 回复词条推导（v0.25 正式词条化）：「回复 N 点生命/血」「+N 血」→ N
    deriveHeal(card) {
      if (+(card.heal || 0) > 0) return +card.heal;
      const m = String(card.desc || '').match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) ||
                String(card.desc || '').match(/\+\s*(\d+)\s*血/);
      return m ? +m[1] : 0;
    },

    // 护甲词条推导：「获得 N 点护甲」「+N 甲」→ N

    // 护甲词条推导：「获得 N 点护甲」「+N 甲」→ N
    deriveArmor(card) {
      if (+(card.armor || 0) > 0) return +card.armor;
      const m = String(card.desc || '').match(/获得\s*(\d+)\s*点?\s*护甲/) ||
                String(card.desc || '').match(/\+\s*(\d+)\s*甲/);
      return m ? +m[1] : 0;
    },

    // 效果词条回填（draw/infuse/heal/armor）：只补缺失值，
    // 绝不覆盖玩家已在制作坊标注的值（每次启动运行）
    // 商店按稀有度定价（币；设计者 2026-09-04 定版：武术/法术/装备/道具
    // 同稀有度同价：古朴 2 / 稀有 3 / 史诗 4 / 传说 5 / 棱彩（能力卡）8）
    PRICE: { '初始': 1, '古朴': 2, '稀有': 3, '史诗': 4, '传说': 5, '棱彩': 8 },
    // 商店随机槽位的稀有度权重（2026-09-08 定版：与宝箱爆率同源，百分比即权重）
    // 商店随机槽位的稀有度权重（2026-09-08 定版：与宝箱爆率同源，百分比即权重）
    SHOP_WEIGHTS: { '古朴': 60, '稀有': 28, '史诗': 9, '传说': 3 },

    // 卡牌爆率（设计者 2026-09-08 定版，商店与宝箱掉落同源）：
    //   先按稀有度掷档：古朴 60% / 稀有 28% / 史诗 9% / 传说 3%；
    //   精英突袭玩法下 稀有/史诗/传说 权重 ×1.2（高稀有度爆率 +20%，2026-09-06 保留）；
    //   同稀有度内均分到每张卡牌，道具类比其他类型低 30%（×0.7，2026-09-08 定版）；
    //   职业 / 初始 / 衍生 / 棱彩卡与生物图鉴不会直接生成（isRandomObtainable 排除）；
    //   宝箱/商店只会开出 武术 / 法术 / 装备 / 道具 / 资源 五类。

    // 卡牌爆率（设计者 2026-09-08 定版，商店与宝箱掉落同源）：
    //   先按稀有度掷档：古朴 60% / 稀有 28% / 史诗 9% / 传说 3%；
    //   精英突袭玩法下 稀有/史诗/传说 权重 ×1.2（高稀有度爆率 +20%，2026-09-06 保留）；
    //   同稀有度内均分到每张卡牌，道具类比其他类型低 30%（×0.7，2026-09-08 定版）；
    //   职业 / 初始 / 衍生 / 棱彩卡与生物图鉴不会直接生成（isRandomObtainable 排除）；
    //   宝箱/商店只会开出 武术 / 法术 / 装备 / 道具 / 资源 五类。
    DROP_WEIGHTS: { '古朴': 60, '稀有': 28, '史诗': 9, '传说': 3 },
    DROP_DISCOUNT_TYPES: ['道具'],
    DROP_ITEM_DISCOUNT: 0.7,
    DROP_EQUIP_DISCOUNT: 0.8,   // 装备爆率下调 20%（2026-09-09 需求 #12）
    DROP_TYPES: ['武术', '法术', '装备', '道具', '资源'],
    // 同稀有度内挑 1 张可随机获取的卡：类型均分，道具 ×0.7、装备 ×0.8（taken = Set<id> 去重，可选）
    // 同稀有度内挑 1 张可随机获取的卡：类型均分，道具 ×0.7、装备 ×0.8（taken = Set<id> 去重，可选）
    pickOfRarity(rarity, taken, typeFilter) {
      const hasTaken = !!(taken && taken.size);
      const pool = SDT.Cards.all().filter(c =>
        c.rarity === rarity && SDT.Cards.DROP_TYPES.includes(c.type) &&
        (!typeFilter || c.type === typeFilter) &&
        SDT.Cards.isRandomObtainable(c) && !(hasTaken && taken.has(c.id)) &&
        c.id !== 'tt-token-color');   // 员工通行证A是碎片合成材料：不进任何随机掉落/商店/发现池（2026-09-16 留言口径，源头收口）
      if (!pool.length) return null;
      let tw = 0;
      const weighted = pool.map(c => {
        const w = SDT.Cards.DROP_DISCOUNT_TYPES.includes(c.type) ? SDT.Cards.DROP_ITEM_DISCOUNT
          : c.type === '装备' ? (SDT.Cards.DROP_EQUIP_DISCOUNT || 0.8) : 1;
        tw += w; return [c, w];
      });
      let roll = Random.random('loot') * tw;
      for (const [c, w] of weighted) { roll -= w; if (roll <= 0) return c; }
      return weighted[weighted.length - 1][0];
    },
    // 按爆率随机抽 1 张掉落卡（先稀有度掷档，再调 pickOfRarity 档内挑卡）
    // 按爆率随机抽 1 张掉落卡（先稀有度掷档，再调 pickOfRarity 档内挑卡）
    randomDropCard(taken, mode, typeFilter) {
      // 精英突袭：稀有/史诗/传说 权重 ×1.2（高稀有度爆率 +20%，2026-09-06）
      // mode 由调用方传入（数据模块不反向读全局会话，2026-09-11 架构批次 1）
      const elite = mode === 'elite';
      const entries = Object.entries(SDT.Cards.DROP_WEIGHTS)
        .map(([r, w]) => [r, elite && r !== '古朴' ? w * 1.2 : w]);
      const totalW = entries.reduce((a, b) => a + b[1], 0);
      for (let tries = 0; tries < 50; tries++) {
        // ① 稀有度先掷档（60:28:9:3，不受卡库各稀有度卡牌数量影响）
        let roll = Random.random('loot') * totalW, rarity = entries[0][0];
        for (const [r, w] of entries) { roll -= w; if (roll <= 0) { rarity = r; break; } }
        // ② 档内按类型权重挑卡（道具 ×0.7）；该档无可用卡则重掷
        const c = SDT.Cards.pickOfRarity(rarity, taken, typeFilter);
        if (c) return c;
      }
      return null;
    },

    // 固定卡缺省不可出售；历史备注可售卡按稳定 id 保留资格。
    // 旧自定义卡继续兼容描述备注，显式 sellable 始终优先。
    SELLABLE_LEGACY_IDS: new Set(['tt-copper', 'tt-gold', 'tt-silver', 'tt3-diamond', 'tt3-garnet-marble']),
    isSellable(card) {
      if (!card) return false;
      if (card.sellable === true) return true;
      if (card.sellable === false) return false;
      if (card.id && fixedCardIds().has(card.id)) return SDT.Cards.SELLABLE_LEGACY_IDS.has(card.id);
      const desc = String(card.desc || '');
      if (desc.includes('不可出售')) return false;
      return desc.includes('可出售');
    },
    // 有效稀有度（展示/经济用，设计者 2026-09-04 定版）：
    //   能力卡与其衍生牌（tokenOf 指向能力卡）为「棱彩」（渐变棱彩，见 cardHTML 的 rv-prism 类）；
    //   其余衍生物（tokenOf 指向创造者）与其创造者稀有度相同。
    // 有效稀有度（展示/经济用，设计者 2026-09-04 定版）：
    //   能力卡与其衍生牌（tokenOf 指向能力卡）为「棱彩」（渐变棱彩，见 cardHTML 的 rv-prism 类）；
    //   其余衍生物（tokenOf 指向创造者）与其创造者稀有度相同。
    rarityOf(card) {
      if (SDT.Cards.isHeroLine(card)) return '棱彩';
      if (card.rarity === '衍生' && card.tokenOf) {
        const src = SDT.Cards.all().find(c => c.id === card.tokenOf);
        if (src) return SDT.Cards.rarityOf(src);
      }
      return card.rarity;
    },

    // 能力卡系判定：能力卡本体（hero: true）或其衍生牌（tokenOf 指向能力卡）。
    // 棱彩稀有度随英雄身份推导——衍生牌无需手改稀有度即可继承棱彩展示。

    // 能力卡系判定：能力卡本体（hero: true）或其衍生牌（tokenOf 指向能力卡）。
    // 棱彩稀有度随英雄身份推导——衍生牌无需手改稀有度即可继承棱彩展示。
    isHeroLine(card) {
      if (!card) return false;
      if (card.hero) return true;
      if (card.tokenOf) {
        const src = SDT.Cards.all().find(c => c.id === card.tokenOf);
        if (src && src.hero) return true;
      }
      return false;
    },

    // 商店收购价：币值 [[icon:coin]] 优先；无币值的可出售卡按稀有度半价（至少 1 币）

    // 商店收购价：币值 [[icon:coin]] 优先；无币值的可出售卡按稀有度半价（至少 1 币）
    sellPrice(card) {
      const v = +(card.value || 0);
      if (v > 0) return v;
      return Math.max(1, Math.floor((SDT.Cards.PRICE[SDT.Cards.rarityOf(card)] || 2) / 2));
    },

    // 「无法被随机或发现」判定（设计者 2026-09-01 定版：传说特例卡非常强力，
    // 不进商店随机槽位，也不进「发现 / 随机获取卡牌」效果的卡池；
    // 2026-09-04 增补：职业稀有度卡同此排除——职业卡牌不能被发现或随机获取到，
    // 除非明确表示是从职业卡池中获取（classPool / randomClassCard 直发，不经本判定）；
    // 2026-09-05 增补：能力卡 / 生物图鉴 / 棱彩稀有度（含元素之门等英雄衍生物）同样排除；
    // 2026-09-08 增补（老板定版）：初始 / 职业 / 衍生 / 棱彩稀有度与生物类别的卡牌
    // 一律不进一般发现或随机池（除非效果特意说明，如「发现 1 张其它职业的卡牌」
    // ——那类指定池走 parsePoolNoun / classPool，不经本判定）

    // 「无法被随机或发现」判定（设计者 2026-09-01 定版：传说特例卡非常强力，
    // 不进商店随机槽位，也不进「发现 / 随机获取卡牌」效果的卡池；
    // 2026-09-04 增补：职业稀有度卡同此排除——职业卡牌不能被发现或随机获取到，
    // 除非明确表示是从职业卡池中获取（classPool / randomClassCard 直发，不经本判定）；
    // 2026-09-05 增补：能力卡 / 生物图鉴 / 棱彩稀有度（含元素之门等英雄衍生物）同样排除；
    // 2026-09-08 增补（老板定版）：初始 / 职业 / 衍生 / 棱彩稀有度与生物类别的卡牌
    // 一律不进一般发现或随机池（除非效果特意说明，如「发现 1 张其它职业的卡牌」
    // ——那类指定池走 parsePoolNoun / classPool，不经本判定）
    isRandomObtainable(card) {
      if (['初始', '职业', '衍生', '棱彩'].includes(card.rarity)) return false;
      if (card.type === '能力卡' || card.type === '生物') return false;
      return !card.unrandom;
    },

    // 职业表（第七批职业卡，cls 字段标职业归属）：
    // 每个职业有独属的 4 张职业卡牌（rarity 职业，黑棱形）；开局从两个随机职业
    // 选 1 并获得 1 张该职业随机卡、火堆 30% 额外送职业卡——这些是「明确从
    // 职业卡池中获取」的途径，直接走 classPool / randomClassCard；
    // 除此之外职业卡一律不进发现 / 随机池（isRandomObtainable 双保险排除）。
    // 获取方式与卡牌内容设计者待定，后续版本可能整批替换。

    // 职业表（第七批职业卡，cls 字段标职业归属）：
    // 每个职业有独属的 4 张职业卡牌（rarity 职业，黑棱形）；开局从两个随机职业
    // 选 1 并获得 1 张该职业随机卡、火堆 30% 额外送职业卡——这些是「明确从
    // 职业卡池中获取」的途径，直接走 classPool / randomClassCard；
    // 除此之外职业卡一律不进发现 / 随机池（isRandomObtainable 双保险排除）。
    // 获取方式与卡牌内容设计者待定，后续版本可能整批替换。
    CLASSES,
    classPool(cls) {
      return SDT.Cards.all().filter(c => c.cls === cls);
    },
    // 随机发放职业卡（开局选职业 / 火堆 / 事件）：只从「职业」稀有度卡中取，
    // 不含能力卡与衍生牌——能力卡只能走 事件拼凑/祭坛弃牌/员工通行证A 三种途径
    // 随机发放职业卡（开局选职业 / 火堆 / 事件）：只从「职业」稀有度卡中取，
    // 不含能力卡与衍生牌——能力卡只能走 事件拼凑/祭坛弃牌/员工通行证A 三种途径
    randomClassCard(cls) {
      const base = cls ? this.classPool(cls) : SDT.Cards.all().filter(c => c.cls);
      const pool = base.filter(c => c.rarity === '职业' && !c.hero);
      return pool.length ? pool[Math.floor(Random.random('card') * pool.length)] : null;
    },

    // 内置初始牌「初始攻击」：每局开始固定携带 5 张（同名堆叠只占 1 格背包）。
    // 1 费 · 攻（+0）＝ 伤害等同于攻击力（combat.js：攻击伤害 = 卡面值 + 攻击力）

    // 内置初始牌「初始攻击」：每局开始固定携带 5 张（同名堆叠只占 1 格背包）。
    // 1 费 · 攻（+0）＝ 伤害等同于攻击力（combat.js：攻击伤害 = 卡面值 + 攻击力）
    SHA: {
      id: 'starter-attack', name: '初始攻击', cost: 1,
      rarity: '初始', type: '武术', dmg: 0, dmgType: 'attack',
      desc: '攻（+0）：造成等同于攻击力的伤害。',
    },

    // 稀有度初始缺失时自动补入的新手卡（可在卡牌库里编辑/删除）

    // 稀有度初始缺失时自动补入的新手卡（可在卡牌库里编辑/删除）
    STARTERS: [
      { id: 'starter-emergency-bandage', name: '应急绷带', cost: 0, rarity: '初始', type: '道具', dmg: 0, desc: '回复 2 点生命。' },
    ],

    // 桌游手绘道具卡（2026-09-01 照片提取，17 张 → 15 种：
    // 银币 ×2、铜币 ×2 为重复/同卡备注，各保留一种设计）。
    // 资源标注重拍照片后：钥匙/口粮/木材系/经济卡包按卡面「资源·N币」标注
    // 改为资源类型（设计者规则：未标注类型的卡牌均为资源）；
    // 急救合剂/金疮药/能源结晶/金银铜币/员工通行证仍为道具（药水与通行证可在背包直接使用）。
};
