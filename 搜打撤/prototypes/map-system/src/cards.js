/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { Random } from './random.js';

/* ============================================================
 * 搜打撤 v0.8 —— 卡牌系统数据（localStorage 持久化）
 *
 * 卡牌要素（开发者可在"卡牌制作坊"里自行设计）：
 *   id      自动生成
 *   name    名称
 *   cost    费用：0 ~ 5 费（桌游手绘卡最高 5 费，如「狙击」）
 *   rarity  稀有度：初始 / 古朴 / 稀有 / 史诗 / 传说 / 衍生 / 职业 / 棱彩
 *           （2026-09-04 定版：衍生（tokenOf）展示与计价继承创造者稀有度；
 *            英雄卡（hero）及其衍生牌按「棱彩」展示——渐变棱彩流转边框，传说英雄金光变体；
 *            宝石配色：古朴白 / 稀有蓝 / 史诗紫 / 传说金，见 base.css rv*） / 职业
 *           （职业稀有度，设计者 2026-09-04 定版：卡面棱形宝石为黑色；
 *           职业卡牌不能被发现或随机获取到，除非明确表示是从职业卡池中获取
 *           —— 即只经 classPool / randomClassCard 发放；2026-09-05 职业整合定版：
 *           5 职业（侠客/战士/牧师/法师/降临者），每职业 10-12 张职业卡，
 *           不同职业不互通，归属总表见 docs/class-consolidation.md）
 *   type    类型：武术 / 法术 / 生物 / 道具 / 装备 / 事件 / 英雄卡 / 资源
 *           （「生物」2026-09-04 定版新增：敌人图鉴卡，与武术/法术等并列；
 *             无法打出、不进商店/发现/随机池，全量敌人信息见 BESTIARY）
 *   dmg     伤害词条：仅武术/法术卡有效，战斗中对目标造成 N 点伤害
 *   dmgType 伤害类型词条（四类伤害体系，design.md §3，dmg>0 时有效）：
 *           'attack' 攻（+n）= n + 攻击力，可触发流血 ｜ 'spell' n' = n + 法伤加成
 *           'fixed' n 固定伤害，不受任何加成（如「射击」2 点固定）
 *           'true'  n'' 真实伤害，无视一切防御手段
 *           缺失时由 ensureDmgTypes() 按描述/类型自动回填（规则见 deriveDmgType）
 *   draw    抽卡词条 N：对战 BOSS 时从牌库抽 N 张；对战普通敌人时改为获得 N 张初始攻击
 *           （设计者 2026-09-02 定版；缺失时由 ensureEffectFields() 按描述「抽 N 张牌」回填）
 *   infuse  注能词条 N：打出这张卡时需先选择并消耗 N 张手牌才能发动
 *           （被消耗的牌进消耗口袋，可在火堆复原；「注能(小)」按 1 层计；
 *           缺失时由 ensureEffectFields() 按描述「注能(N)/注能(小)」回填）
 *   heal    回复词条 N：回复 N 点生命（禁疗时无效；可由「回复 N 点生命/+N 血」回填）
 *   armor   护甲词条 N：获得 N 点护甲（可由「获得 N 点护甲/+N 甲」回填）
 *   desc    效果描述（可选）
 *   value   币值 [[icon:coin]]：桌游道具卡的标注价值（右下角金色角标，商店收购参考价）
 *   sellable 可否出售：true = 可出售（缺省视为不可出售；描述带「可出售」备注的卡
 *           同样视为可出售，完整判定规则见 isSellable()）
 *   unrandom 随机池排除：true = 无法被随机或发现获得（传说特例卡，设计者
 *           2026-09-01 定版：非常强力，只能通过设计者指定的途径获取，
 *           不进商店随机槽位与「发现/随机获取」效果卡池，判定见 isRandomObtainable()）
 * ============================================================ */
  const KEY = 'sdt-cards-v1';
  // 桌游道具卡播种记录：每批一个标记，只播一次，之后删改都尊重玩家
  const TT_KEY = 'sdt-cards-tt-seeded';
  const TT2_KEY = 'sdt-cards-tt2-seeded';
  const TT3_KEY = 'sdt-cards-tt3-seeded';
  // 第二/三批按高清照片重辨修订后换用新版本标记：老浏览器重播一次，按 id 覆盖旧识别
  const TT2_KEY_V3 = 'sdt-cards-tt2-v3-seeded';  // v3：第五批照片精修武术描述
  const TT3_KEY_V4 = 'sdt-cards-tt3-v4-seeded';  // v4：第五批照片修正武术摞费用与描述
  const TT1_KEY_V6 = 'sdt-cards-tt1-v6-seeded';  // v6：资源标注重拍照片——第一批改为资源类型、木材/木化拆分、经济卡包可出售
  const TT4_KEY_V2 = 'sdt-cards-tt4-v2-seeded';  // v2：第四批补入「木化」（与「木材」是两张卡）
  const TT3_KEY_V5 = 'sdt-cards-tt3-v5-seeded';  // v5：传说卡系列照片——8 张已有卡升传说/重辨修订并锁定随机获取
  const TT5_KEY = 'sdt-cards-tt5-seeded';        // 第五批：传说新设计大法师的权杖/银河之旅
  const TT6_KEY = 'sdt-cards-tt6-seeded';        // 第六批：事件卡（只能经事件格触发，背包记录）
  const TT7_KEY = 'sdt-cards-tt7-seeded';        // 第七批：职业卡（开局二选一职业，不进随机池）
  const TT7_KEY_V2 = 'sdt-cards-tt7-v2-seeded';  // v2：职业稀有度定版——44 张职业卡 rarity 统一改「职业」（只改稀有度，不动玩家改过的名字与描述）
  const TT8_KEY = 'sdt-cards-tt8-seeded';        // 第八批：英雄卡及衍生牌（每职业 1 英雄，衍生牌围绕英雄效果）
  const TT9_KEY = 'sdt-cards-tt9-seeded';        // 第九批：生物图鉴（全部敌人信息录入，类型「生物」）
  const CC_KEY = 'sdt-cards-cc2-seeded';         // 职业整合迁移（2026-09-05 定版）：11 职业 → 5 职业，逐卡改归属；v2：邪渊主宰·妲莉薇特改归降临者并撤下「九尾焚天·妲」占位卡

  // 职业表（2026-09-05 设计者定版职业整合：原 11 职业 → 5 职业，每职业 10-12 张职业卡，
  // 不同职业不互通——cls 字段挂在每张职业卡上，classPool 按 cls 严格隔离）：
  //   侠客（← 刺客/剑客/游侠）· 战士（← 战士/守卫）· 牧师（← 牧师/授印者/术士）
  //   法师（← 法师/召唤师）· 降临者（← 降临者/授印者）
  // 整合明细与逐卡归属见 docs/class-consolidation.md；实机卡库迁移见 ensureClassConsolidation()。
  const CLASSES = ['侠客', '战士', '牧师', '法师', '降临者'];

  SDT.Cards = {
    // 2026-09-04 定版增补：稀有度新增「棱彩」（英雄卡及其衍生牌专属，rv7/渐变棱彩）；
    // 稀有稀有度宝石改为蓝色（原黑色，见 base.css rv2）。
    RARITIES: ['初始', '古朴', '稀有', '史诗', '传说', '衍生', '职业', '棱彩'],
    // 类型新增「生物」（2026-09-04 定版：敌人图鉴卡，与武术/法术等并列；无法打出）
    TYPES: ['武术', '法术', '生物', '道具', '装备', '事件', '英雄卡', '资源'],
    TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '英雄卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
    // 类型到位图图标名（卡面插画与页签用；TYPE_ICON 保留给纯文本场景）
    TYPE_ART: { '武术': 'swords', '法术': 'sparkles', '生物': 'paw', '道具': 'flask', '装备': 'shield', '事件': 'question', '英雄卡': 'helmet', '资源': 'wood' },
    // 拥有伤害词条（红色伤害宝石）的类型
    DMG_TYPES: ['武术', '法术'],

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
    deriveDmgValue(card) {
      if (+(card.dmg || 0) > 0) return +card.dmg;
      if (!SDT.Cards.DMG_TYPES.includes(card.type)) return 0;
      const desc = String(card.desc || '').trim();
      if (/^注能\s*[（(]/.test(desc)) return 0;
      const m = desc.match(/(?:^|[：:，,]\s*)?(\d+)\s*′/);
      return m ? +m[1] : 0;
    },

    // 伤害类型词条回填：只补缺失值，绝不覆盖玩家已标注的 dmgType（每次启动运行）
    ensureDmgTypes() {
      const cards = SDT.Cards.all();
      let dirty = false;
      cards.forEach((c) => {
        if (c.dmgType) return;
        const dt = SDT.Cards.deriveDmgType(c);
        if (dt) { c.dmgType = dt; dirty = true; }
      });
      if (dirty) SDT.Cards.saveAll(cards);
    },

    // 抽卡词条推导（ensureEffectFields 回填用，只读不写）：
    // 已标注 draw → 原样；描述「抽 N 张牌」→ N（与 battle.js 的描述结算同一线）
    deriveDraw(card) {
      if (+(card.draw || 0) > 0) return +card.draw;
      const m = String(card.desc || '').match(/抽\s*(\d+)\s*张牌/);
      return m ? +m[1] : 0;
    },

    // 注能词条推导：「注能(N)」→ N；「注能(小)」→ 1（设计者记号：小 = 1 张）
    deriveInfuse(card) {
      if (+(card.infuse || 0) > 0) return +card.infuse;
      const m = String(card.desc || '').match(/注能\s*[（(]\s*(\d+|小)\s*[)）]/);
      return m ? (m[1] === '小' ? 1 : +m[1]) : 0;
    },

    // 注能变体词条（2026-09-04 定版提醒）：描述里带「注能(N)：…」子句的卡，
    // 注能前后效果不同——卡面角标与战斗内注能提示条都会展示该子句提醒玩家。
    infuseAlt(card) {
      if (!(+(card.infuse || 0) > 0)) return null;
      const m = String(card.desc || '').match(/注能\s*[（(]\s*(?:\d+|小)\s*[)）]\s*[：:]?\s*[^。；;]*/);
      return m ? m[0].trim() : null;
    },

    // 回复词条推导（v0.25 正式词条化）：「回复 N 点生命/血」「+N 血」→ N
    deriveHeal(card) {
      if (+(card.heal || 0) > 0) return +card.heal;
      const m = String(card.desc || '').match(/回复\s*(\d+)\s*(?:点\s*生命|点?血)/) ||
                String(card.desc || '').match(/\+\s*(\d+)\s*血/);
      return m ? +m[1] : 0;
    },

    // 护甲词条推导：「获得 N 点护甲」「+N 甲」→ N
    deriveArmor(card) {
      if (+(card.armor || 0) > 0) return +card.armor;
      const m = String(card.desc || '').match(/获得\s*(\d+)\s*点?\s*护甲/) ||
                String(card.desc || '').match(/\+\s*(\d+)\s*甲/);
      return m ? +m[1] : 0;
    },

    // 效果词条回填（draw/infuse/heal/armor）：只补缺失值，
    // 绝不覆盖玩家已在制作坊标注的值（每次启动运行）
    ensureEffectFields() {
      const cards = SDT.Cards.all();
      let dirty = false;
      const tryFill = (c, key, val) => {
        if (val && +(c[key] || 0) !== val) { c[key] = val; dirty = true; }
      };
      cards.forEach((c) => {
        tryFill(c, 'draw', SDT.Cards.deriveDraw(c));
        tryFill(c, 'infuse', SDT.Cards.deriveInfuse(c));
        tryFill(c, 'heal', SDT.Cards.deriveHeal(c));
        tryFill(c, 'armor', SDT.Cards.deriveArmor(c));
      });
      if (dirty) SDT.Cards.saveAll(cards);
    },

    // 伤害数值回填（2026-09-04 新增）：描述写明「N′」但 dmg 字段缺失的法术卡
    // 自动补入 dmg 与 spell 伤害类型（如 银刺 5′ / 冰刺 1′ / 闪电链 3′）。
    // 只补缺失值，绝不覆盖已标注的 dmg（每次启动运行）
    ensureDmgValues() {
      const cards = SDT.Cards.all();
      let dirty = false;
      cards.forEach((c) => {
        if (+(c.dmg || 0) > 0) return;
        const v = SDT.Cards.deriveDmgValue(c);
        if (v > 0) {
          c.dmg = v;
          if (!SDT.Cards.DMG_TYPE_META[c.dmgType]) c.dmgType = 'spell';
          dirty = true;
        }
      });
      if (dirty) SDT.Cards.saveAll(cards);
    },
    // 商店按稀有度定价（币；设计者 2026-09-04 定版：武术/法术/装备/道具
    // 同稀有度同价：古朴 2 / 稀有 3 / 史诗 4 / 传说 5 / 棱彩（英雄卡）8）
    PRICE: { '初始': 1, '古朴': 2, '稀有': 3, '史诗': 4, '传说': 5, '棱彩': 8 },
    // 商店随机槽位的稀有度权重
    SHOP_WEIGHTS: { '初始': 30, '古朴': 30, '稀有': 20, '史诗': 12, '传说': 8 },

    // 卡牌爆率（设计者 2026-09-05 定版，宝箱掉落等「生成一张卡」场景同源）：
    //   先按稀有度掷档：古朴 = 稀有 ×1.5，稀有 = 史诗 ×1.5（古朴:稀有:史诗 = 2.25:1.5:1）；
    //   传说 / 职业 / 初始卡不会直接生成（不在权重表即不出）；
    //   同稀有度内 资源 / 道具 的爆率比其他类型低 20%（×0.8）；
    //   宝箱只会开出 武术 / 法术 / 装备 / 道具 / 资源 五类。
    DROP_WEIGHTS: { '古朴': 2.25, '稀有': 1.5, '史诗': 1 },
    DROP_DISCOUNT_TYPES: ['道具', '资源'],
    DROP_TYPES: ['武术', '法术', '装备', '道具', '资源'],
    // 按爆率随机抽 1 张掉落卡；taken = Set<id>（同一宝箱内尽量不重复，可选）
    randomDropCard(taken) {
      const hasTaken = !!(taken && taken.size);
      const entries = Object.entries(SDT.Cards.DROP_WEIGHTS);
      const totalW = entries.reduce((a, b) => a + b[1], 0);
      for (let tries = 0; tries < 50; tries++) {
        // ① 稀有度先掷档（2.25:1.5:1，不受卡库各稀有度卡牌数量影响）
        let roll = Random.random('loot') * totalW, rarity = entries[0][0];
        for (const [r, w] of entries) { roll -= w; if (roll <= 0) { rarity = r; break; } }
        // ② 档内按类型权重挑卡（道具/资源 ×0.8）；该档无可用卡则重掷
        const pool = SDT.Cards.all().filter(c =>
          c.rarity === rarity && SDT.Cards.DROP_TYPES.includes(c.type) &&
          SDT.Cards.isRandomObtainable(c) && !(hasTaken && taken.has(c.id)));
        if (!pool.length) continue;
        let tw = 0;
        const weighted = pool.map(c => {
          const w = SDT.Cards.DROP_DISCOUNT_TYPES.includes(c.type) ? 0.8 : 1;
          tw += w; return [c, w];
        });
        let roll2 = Random.random('loot') * tw;
        for (const [c, w] of weighted) { roll2 -= w; if (roll2 <= 0) return c; }
        return weighted[weighted.length - 1][0];
      }
      return null;
    },

    // 出售资格判定（设计者 2026-09-01 定版：所有卡牌默认不可出售，
    // 只有特殊备注「可出售」的道具才能卖给商店）：
    //   1. 已标注 sellable（true/false）→ 原样（制作坊勾选，优先级最高）
    //   2. 描述带「不可出售」→ 不可出售（如经济卡包，注意优先于「可出售」判断）
    //   3. 描述带「可出售」→ 可出售（桌游手绘卡备注：铜币/银币/金币/钻石/石榴石弹珠）
    //   4. 其余一律不可出售
    isSellable(card) {
      if (card.sellable === true) return true;
      if (card.sellable === false) return false;
      const desc = String(card.desc || '');
      if (desc.includes('不可出售')) return false;
      return desc.includes('可出售');
    },
    // 有效稀有度（展示/经济用，设计者 2026-09-04 定版）：
    //   英雄卡与其衍生牌（tokenOf 指向英雄卡）为「棱彩」（渐变棱彩，见 cardHTML 的 rv-prism 类）；
    //   其余衍生物（tokenOf 指向创造者）与其创造者稀有度相同。
    rarityOf(card) {
      if (SDT.Cards.isHeroLine(card)) return '棱彩';
      if (card.rarity === '衍生' && card.tokenOf) {
        const src = SDT.Cards.all().find(c => c.id === card.tokenOf);
        if (src) return SDT.Cards.rarityOf(src);
      }
      return card.rarity;
    },

    // 英雄卡系判定：英雄卡本体（hero: true）或其衍生牌（tokenOf 指向英雄卡）。
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
    sellPrice(card) {
      const v = +(card.value || 0);
      if (v > 0) return v;
      return Math.max(1, Math.floor((SDT.Cards.PRICE[SDT.Cards.rarityOf(card)] || 2) / 2));
    },

    // 「无法被随机或发现」判定（设计者 2026-09-01 定版：传说特例卡非常强力，
    // 不进商店随机槽位，也不进「发现 / 随机获取卡牌」效果的卡池；
    // 2026-09-04 增补：职业稀有度卡同此排除——职业卡牌不能被发现或随机获取到，
    // 除非明确表示是从职业卡池中获取（classPool / randomClassCard 直发，不经本判定）；
    // 后续 M1 实装发现/随机词条时必须经过本判定过滤）
    // 「无法被随机或发现」判定（设计者 2026-09-01 定版：传说特例卡非常强力，
    // 不进商店随机槽位，也不进「发现 / 随机获取卡牌」效果的卡池；
    // 2026-09-04 增补：职业稀有度卡同此排除——职业卡牌不能被发现或随机获取到，
    // 除非明确表示是从职业卡池中获取（classPool / randomClassCard 直发，不经本判定）；
    // 2026-09-05 增补：英雄卡 / 生物图鉴 / 棱彩稀有度（含元素之门等英雄衍生物）同样排除；
    // 后续 M1 实装发现/随机词条时必须经过本判定过滤）
    isRandomObtainable(card) {
      if (card.rarity === '职业') return false;
      if (card.type === '英雄卡' || card.type === '生物') return false;
      if (card.rarity === '棱彩') return false;
      return !card.unrandom;
    },

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
    // 不含英雄卡与衍生牌——英雄卡只能走 事件拼凑/祭坛弃牌/彩色令牌 三种途径
    randomClassCard(cls) {
      const base = cls ? this.classPool(cls) : SDT.Cards.all().filter(c => c.cls);
      const pool = base.filter(c => c.rarity === '职业' && !c.hero);
      return pool.length ? pool[Math.floor(Random.random('card') * pool.length)] : null;
    },

    // 内置卡：金疮药（商店固定栏位，3 币，回复 10 血）
    POTION: {
      id: 'builtin-jinchuangyao', name: '金疮药', cost: 1,
      rarity: '稀有', type: '道具', desc: '回复 10 点生命。',
    },

    // 内置卡：复原药水（商店固定栏位，3 币；背包中使用——复原消耗口袋至多 2 张卡牌）
    RESTORE: {
      id: 'builtin-fuyuanyao', name: '复原药水', cost: 1,
      rarity: '稀有', type: '道具', desc: '复原至多 2 张消耗卡牌（背包中使用）。',
    },

    // 内置初始牌「初始攻击」：每局开始固定携带 5 张（同名堆叠只占 1 格背包）。
    // 1 费 · 攻（+0）＝ 伤害等同于攻击力（combat.js：攻击伤害 = 卡面值 + 攻击力）
    SHA: {
      id: 'builtin-sha', name: '初始攻击', cost: 1,
      rarity: '初始', type: '武术', dmg: 0, dmgType: 'attack',
      desc: '攻（+0）：造成等同于攻击力的伤害。',
    },

    // 稀有度初始缺失时自动补入的新手卡（可在卡牌库里编辑/删除）
    STARTERS: [
      { name: '新兵操典', cost: 0, rarity: '初始', type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' },
      { name: '应急绷带', cost: 0, rarity: '初始', type: '道具', dmg: 0, desc: '回复 2 点生命。' },
      { name: '制式口粮', cost: 0, rarity: '初始', type: '资源', dmg: 0, desc: '获得 1 份口粮。' },
    ],

    // 桌游手绘道具卡（2026-09-01 照片提取，17 张 → 15 种：
    // 银币 ×2、铜币 ×2 为重复/同卡备注，各保留一种设计）。
    // 资源标注重拍照片后：钥匙/口粮/木材系/经济卡包按卡面「资源·N币」标注
    // 改为资源类型（设计者规则：未标注类型的卡牌均为资源）；
    // 医疗针/金创药/能源水晶/金银铜币/令牌仍为道具（药水与代币可在背包直接使用）。
    TABLETOP: [
      // —— 第一排 ——
      { id: 'tt-medneedle',  name: '医疗针',   cost: 1, rarity: '古朴', type: '道具', desc: '回复 16 点生命。', value: 4 },
      { id: 'tt-copper',     name: '铜币',     cost: 0, rarity: '初始', type: '道具', desc: '高价值，可出售。', value: 3 },
      { id: 'tt-keys-bunch', name: '一串钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×2。', value: 4 },
      { id: 'tt-rations',    name: '口粮',     cost: 0, rarity: '初始', type: '资源', desc: '升级宠物。', value: 3 },
      { id: 'tt-token-color', name: '彩色令牌', cost: 2, rarity: '史诗', type: '道具', desc: '觉醒。', value: 8 },
      // —— 第二排 ——
      { id: 'tt-gold',       name: '金币',     cost: 0, rarity: '史诗', type: '道具', desc: '贵重货币，可出售。', value: 9 },
      { id: 'tt-econpack',   name: '经济卡包', cost: 2, rarity: '传说', type: '资源', desc: '带入战场时，以 5 张随机卡牌开局。可出售。', value: 10, sellable: true }, // 资源标注重拍：卡面明确「可出售 10币」
      { id: 'tt-silver',     name: '银币',     cost: 0, rarity: '古朴', type: '道具', desc: '可出售。', value: 6 },
      { id: 'tt-key',        name: '钥匙',     cost: 0, rarity: '初始', type: '资源', desc: '解锁神秘宝箱。', value: 2 },
      // —— 第三排 ——
      { id: 'tt-crystal',    name: '能源水晶', cost: 1, rarity: '古朴', type: '道具', desc: '复活最多 3 张卡牌。', value: 3 },
      { id: 'tt-key-one',    name: '一把钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×3。', value: 6 },
      { id: 'tt-token-gold', name: '金色令牌', cost: 1, rarity: '稀有', type: '道具', desc: '抽取 1 张传说卡。', value: 5 }, // 照片重辨：手写为「传说卡」（[[icon:crystal]]传），非「传统卡」
      { id: 'tt-jinchuangyao', name: '金创药', cost: 1, rarity: '古朴', type: '道具', desc: '回复 10 点生命。', value: 3 },
      { id: 'tt-wood',       name: '木材',     cost: 0, rarity: '初始', type: '资源', desc: '木材 ×1。', value: 2 }, // 资源标注重拍：纯资源卡（无回复效果）；「木化」药水另录于 TABLETOP4
      { id: 'tt-wood-lots',  name: '大量木材', cost: 0, rarity: '古朴', type: '资源', desc: '木材 ×2。', value: 4 },
    ],

    // 桌游手绘卡 · 第二批（2026-09-01 照片提取，17 张：7 装备 + 10 武术）。
    // 注意：这批卡角标注「类型 · N[[icon:coin]]」中的 N 是能量费用（不是币值！），
    // 「射击」左上角 free = 0 费；[[icon:crystal]] 为手绘的类别记号，稀有度按效果强度代拟。
    // 抽牌/破甲/吸血/加甲等词条等 M1 卡牌战斗实装。
    TABLETOP2: [
      // —— 装备（描述已按第四批高清照片重辨精修）——
      { id: 'tt2-apollo',     name: '阿波罗的礼物', cost: 2, rarity: '史诗', type: '装备', desc: '限定：获得 1 点能量，抽 2 张牌；发现或随机获取任何牌时，可直接施放（不受限定限制）。' },
      { id: 'tt2-pearlbox',   name: '珍珠盒',   cost: 4, rarity: '稀有', type: '装备', desc: '可以容纳所有资源卡牌。' },
      { id: 'tt2-wreck',      name: '沉船宝藏', cost: 4, rarity: '史诗', type: '装备', desc: '抽到或消耗时，获取 1 张随机卡牌。' },
      { id: 'tt2-treasuremap', name: '寻宝图', cost: 4, rarity: '古朴', type: '装备', desc: '限定：将 2 张军用保险柜的物资置入牌库，抽 1 张牌。' },
      { id: 'tt2-pouch',      name: '神秘口袋', cost: 3, rarity: '稀有', type: '装备', desc: '贮藏至多 3 张牌。' },
      { id: 'tt2-venomstaff', name: '毒木杖',   cost: 2, rarity: '古朴', type: '装备', desc: '限定：施放中毒牌时，每 1 层法伤加成，额外施放 1 次。' },
      { id: 'tt2-frostsword', name: '寒冰剑',   cost: 2, rarity: '古朴', type: '装备', desc: '对冰冻角色伤害 +2。' },
      // —— 武术（描述已按第五批高清武术摞照片重辨精修）——
      { id: 'tt2-jianghu',     name: '江湖救急', cost: 4, rarity: '稀有', type: '武术', desc: '发现 1 张其它职业的卡牌并施放。' },
      { id: 'tt2-swiftarrow',  name: '迅疾箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，抽 1 张牌。' },
      { id: 'tt2-block',       name: '格挡',     cost: 2, rarity: '古朴', type: '武术', desc: '本回合所受伤害降为 1。' },
      { id: 'tt2-comboarrow',  name: '连击箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1；如果你的上一张牌是武术，变为 0 费。' },
      { id: 'tt2-piercearrow', name: '破甲箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，破甲。' },
      { id: 'tt2-shoot',       name: '射击',     cost: 0, rarity: '初始', type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' }, // 设计者定版：2 点固定伤害
      { id: 'tt2-turtlearmor', name: '龟寿甲',   cost: 2, rarity: '古朴', type: '武术', desc: '弃 1 张装备牌，+8 甲。' },
      { id: 'tt2-bloodblade',  name: '血刃',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加吸血。' },
      { id: 'tt2-greenarrow',  name: '青箭',     cost: 2, rarity: '古朴', type: '武术', desc: '攻击，附加中毒。' },
      { id: 'tt2-forestarrow', name: '绿化箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，+3 甲。' },
    ],

    // 桌游手绘卡 · 第三批（2026-09-01 全套照片提取；另一会话录入 93 张在先，
    // 本会话对「28 张法术一摞」照片做了逐张放大重辨：同卡条目已按更准确的读法
    // 覆盖（保留原 id），缺卡补录于「法术（重辨补录）」段，其余各摞条目未动）。
    // 注意：本摞照片角标为「法术·N[[icon:coin]]」，与第二批一致 = 能量费用（非币值）；
    // 卡名前 [[icon:crystal]] 数量 = 稀有度记号（1 古朴 / 2 稀有 / 3 史诗）。
    TABLETOP3: [
      // —— 武术（28 张一揽；2026-09-01 高清武术摞照片逐张重辨：费用按卡角
      //     「武术·N[[icon:coin]]」修正（此前普遍低记 1 费）、描述按原文「攻⁺n」记号，
      //     同卡异名已改（飞箭鹰→飞身劈、重射→重新）；制敌/跳击/铠甲/剑落纷霜
      //     不在本摞照片中，保持原样）——
      { id: 'tt3-blood-arrow',   name: '血箭',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加流血。' },
      { id: 'tt3-fatal-pierce',  name: '致命穿刺', cost: 2, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2；若对方有流血，伤害 +1 并破甲。' },
      { id: 'tt3-fly-arrowhawk', name: '飞身劈',   cost: 3, rarity: '稀有', type: '武术', dmg: 3, dmgType: 'attack', desc: '攻⁺3，触发流血伤害翻倍。' },
      { id: 'tt3-frost-slash',   name: '霜月斩',   cost: 4, rarity: '稀有', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2，附加冰冻，冻结状态 2 回合。' },
      { id: 'tt3-noon-duel',     name: '正午决战', cost: 4, rarity: '稀有', type: '武术', desc: '下回合开始，连开四枪！四响。' },
      { id: 'tt3-armor-rush',    name: '破甲急袭', cost: 3, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2，附加 2 层流血。' },
      { id: 'tt3-double-shot',   name: '连射',     cost: 2, rarity: '古朴', type: '武术', dmg: 2, desc: '2 点伤害，2 次。' },
      { id: 'tt3-bandage',       name: '包扎',     cost: 2, rarity: '初始', type: '武术', desc: '+3 血，+3 甲。' },
      { id: 'tt3-purify-arrow',  name: '净化箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，净化负面效果。' },
      { id: 'tt3-arrow-rain',    name: '箭雨',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，全体攻击。' },
      { id: 'tt3-wave-slash',    name: '破浪斩',   cost: 2, rarity: '古朴', type: '武术', dmg: 3, dmgType: 'attack', desc: '攻⁺3，下回合无法抽牌。' },
      { id: 'tt3-qi-wave',       name: '气功波',   cost: 3, rarity: '古朴', type: '武术', desc: '抽 1 张牌，对全体敌人造成等量伤害。' },
      { id: 'tt3-hold-fast',     name: '坚守',     cost: 2, rarity: '初始', type: '武术', desc: '+3 甲，抽 1 张牌。' },
      { id: 'tt3-life-arrow',    name: '生命箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，获得 1 张随机卡牌。' },
      { id: 'tt3-dig-treasure',  name: '挖宝',     cost: 4, rarity: '古朴', type: '武术', desc: '从牌库底发现 1 张牌，并获得等价护甲。' },
      { id: 'tt3-reshot',        name: '重新',     cost: 2, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2。' },
      { id: 'tt3-pindown',       name: '制敌',     cost: 1, rarity: '古朴', type: '武术', dmg: 2, desc: '攻 2 点；目标下回合无法行动。', value: 2 },
      { id: 'tt3-hop-strike',    name: '跳击',     cost: 0, rarity: '古朴', type: '武术', dmg: 1, desc: '攻 1 点，不受反击。', value: 2 },
      { id: 'tt3-plate',         name: '铠甲',     cost: 1, rarity: '初始', type: '武术', desc: '获得 3 点护甲。', value: 2 },
      { id: 'tt3-venom-arrow',   name: '毒箭',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加中毒。' },
      { id: 'tt3-toxin',         name: '毒药',     cost: 0, rarity: '初始', type: '武术', desc: '附加 1 层中毒。' },
      { id: 'tt3-frostfall',     name: '剑落纷霜', cost: 2, rarity: '传说', type: '武术', dmg: 5, dmgType: 'attack', unrandom: true, desc: '攻5，破坏敌方手牌中 1 张武术。', value: 5 }, // 传说系列重拍：首张照片，效果修订（旧读「破坏冰阵」）
      // —— 武术（本摞照片重辨补录 1 张）——
      { id: 'tt3wu-shike',       name: '割蚀',     cost: 2, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，附加流血。' },
      // —— 法术 / 药水（第一摞 28 张）——
      { id: 'tt3-ice-arrow',     name: '寒冰箭',   cost: 2, rarity: '古朴', type: '法术', dmg: 1, desc: '造成 1 点伤害，附加冰冻。', value: 2 },
      { id: 'tt3-mystery-potion', name: '神秘药水', cost: 3, rarity: '古朴', type: '道具', desc: '随机神秘效果。', value: 2 },
      { id: 'tt3-heal-potion',   name: '治疗药水', cost: 2, rarity: '古朴', type: '法术', desc: '回复：回复 5 血。' },
      { id: 'tt3-blue-potion',   name: '蓝瓶药水', cost: 3, rarity: '古朴', type: '道具', desc: '回复 3 点生命，抽 1 张牌。', value: 2 },
      { id: 'tt3-treasure-hunt', name: '寻宝',     cost: 2, rarity: '古朴', type: '法术', desc: "3′，发现 1 张牌。" },
      { id: 'tt3-flame-storm',   name: '火焰风暴', cost: 3, rarity: '稀有', type: '法术', dmg: 3, desc: '对全体敌人造成 3 点伤害。', value: 3 },
      { id: 'tt3-fish-out',      name: '摸底',     cost: 2, rarity: '古朴', type: '法术', desc: '抽 2 张牌。', value: 2 },
      { id: 'tt3-freeze',        name: '冰冻药水', cost: 2, rarity: '古朴', type: '法术', desc: '道具：冰冻 1 名敌人。' },
      { id: 'tt3-arcane-wisdom', name: '奥术智慧', cost: 2, rarity: '古朴', type: '法术', desc: '抽 2 张牌。', value: 2 },
      { id: 'tt3-fate-potion',   name: '命运药水', cost: 2, rarity: '古朴', type: '法术', desc: '混合：随机获取 2 张卡牌。' },
      { id: 'tt3-nature-form',   name: '自然升华', cost: 4, rarity: '稀有', type: '法术', desc: '本场战斗中，能量上限 +1。' },
      { id: 'tt3-python-potion', name: '巨蟒药水', cost: 2, rarity: '古朴', type: '道具', desc: '召唤巨蟒助战。', value: 2 },
      { id: 'tt3-chain-lightning', name: '闪电链', cost: 2, rarity: '古朴', type: '法术', desc: "3′，2 段伤害。" },
      { id: 'tt3-houyi-potion',  name: '后羿药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合攻击 +2。', value: 2 },
      { id: 'tt3-fireball',      name: '火球',     cost: 2, rarity: '古朴', type: '法术', dmg: 4, desc: '造成 4 点伤害（4′）。' },
      { id: 'tt3-holy-water',    name: '圣水',     cost: 2, rarity: '古朴', type: '法术', desc: '回复 4 点生命，净化负面效果。', value: 2 },
      { id: 'tt3-skewer',        name: '穿刺',     cost: 2, rarity: '古朴', type: '法术', dmg: 2, desc: '造成 2 点伤害，无视护甲。', value: 3 },
      { id: 'tt3-holy-shield',   name: '圣盾',     cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '获得 5 点护甲。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3-shadow-clone',  name: '影分身',   cost: 3, rarity: '稀有', type: '法术', desc: '召唤 1 个影分身参战。', value: 3 },
      { id: 'tt3-blood-feast',   name: '血膳宴',   cost: 3, rarity: '稀有', type: '法术', dmg: 3, desc: '造成 3 点伤害，回复等量生命。', value: 4 },
      { id: 'tt3-iceheart-potion', name: '冰心药水', cost: 2, rarity: '古朴', type: '道具', desc: '免疫冰冻，回复 3 点生命。', value: 2 },
      { id: 'tt3-demon-potion',  name: '魔化药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合法术伤害 +2。', value: 2 },
      { id: 'tt3-resurrect',     name: '复活',     cost: 3, rarity: '稀有', type: '法术', desc: '复活 1 张卡牌。', value: 2 },
      { id: 'tt3-nuke-ray',      name: '核爆射线', cost: 2, rarity: '史诗', type: '法术', dmg: 4, desc: '造成 4 点伤害。', value: 4 },
      { id: 'tt3-windchaser',    name: '追风剑',   cost: 1, rarity: '古朴', type: '装备', desc: '装备：攻击 +1。', value: 2 },
      { id: 'tt3-petal',         name: '花瓣',     cost: 2, rarity: '稀有', type: '法术', desc: '每回合结束回复 2 点生命。', value: 4 },
      { id: 'tt3-flame-potion',  name: '火焰药水', cost: 2, rarity: '古朴', type: '法术', desc: "混合：2′，全体攻击。" },
      { id: 'tt3-snipe',         name: '狙击',     cost: 5, rarity: '史诗', type: '法术', dmg: 5, desc: '造成 5 点伤害。', value: 2 },
      // —— 法术 / 药水（第二摞补 11 张）——
      { id: 'tt3-magic-lamp',    name: '神灯',     cost: 4, rarity: '古朴', type: '法术', desc: '抉择：1° 发现 1 张牌并释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，+5 甲。' },
      { id: 'tt3-thornfield',    name: '棘刺之地', cost: 3, rarity: '古朴', type: '法术', desc: '对所有敌人附加 1 层中毒，+1 甲。' },
      { id: 'tt3-toxic-potion',  name: '剧毒药水', cost: 2, rarity: '古朴', type: '法术', desc: "混合：2′，附加中毒。" },
      { id: 'tt3-bleed-potion',  name: '流血药水', cost: 1, rarity: '古朴', type: '道具', desc: '造成 2 点伤害，附加流血。', value: 2 },
      { id: 'tt3-copy-potion',   name: '复制药水', cost: 2, rarity: '古朴', type: '法术', desc: '混合：重复施放一种混合药水。' },
      { id: 'tt3-mind-potion',   name: '精神药水', cost: 2, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', value: 4 },
      { id: 'tt3-turnabout-potion', name: '转势药水', cost: 1, rarity: '稀有', type: '道具', desc: '使所有敌人附加陷阱牌。', value: 3 },
      { id: 'tt3-firm-barrier',  name: '坚冰结界', cost: 4, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '延长 1 名角色的冰冻 1 回合。（手绘卡左上角注 free）' }, // 2026-09-05 职业整合：原地转为法师职业卡
      { id: 'tt3-ice-spike',     name: '冰刺',     cost: 2, rarity: '古朴', type: '法术', desc: "1′，附加冰冻。" },
      { id: 'tt3-grope',         name: '摸索',     cost: 1, rarity: '古朴', type: '法术', desc: '抽 2 张牌。', value: 3 },
      { id: 'tt3-mixed-potion',  name: '混血药水', cost: 1, rarity: '古朴', type: '道具', desc: '造成 2 点伤害，附加流血。', value: 2 },
      // —— 法术（重辨补录 15 张：此前未入库的同摞卡）——
      { id: 'tt3sp-mysticsummon', name: '神秘召唤', cost: 4, rarity: '稀有', type: '法术', desc: '获得 1 张金色令牌或彩色令牌，无法将其带入对战。' },
      { id: 'tt3sp-dodge',        name: '闪避',     cost: 2, rarity: '古朴', type: '法术', desc: '应对攻击时：避开 1 段伤害。' },
      { id: 'tt3sp-devour',       name: '吞噬',     cost: 3, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '消灭 1 名 4 级及以下小怪。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3sp-doom',         name: '毁灭',     cost: 3, rarity: '史诗', type: '法术', desc: '消灭 2 名 5 级及以下小怪，不可复原。' },
      { id: 'tt3sp-silverthorn',  name: '银刺',     cost: 2, rarity: '古朴', type: '法术', desc: "5′；注能(小)：改为 8′。" },
      { id: 'tt3sp-poisonfog',    name: '毒雾',     cost: 2, rarity: '稀有', type: '法术', desc: '对敌方全体附加中毒，立即触发一次毒伤。' },
      { id: 'tt3sp-magicoil',     name: '魔法药水', cost: 2, rarity: '古朴', type: '法术', desc: "限定：1′，抽 1 张牌。" },
      { id: 'tt3sp-search',       name: '搜索',     cost: 2, rarity: '古朴', type: '法术', desc: '抽 2 张牌。' },
      { id: 'tt3sp-shadowbug',    name: '影蛊',     cost: 3, rarity: '古朴', type: '法术', desc: '本回合偷取 1 名敌人的攻击。' },
      { id: 'tt3sp-flowerzhen',   name: '花鸩',     cost: 4, rarity: '古朴', type: '法术', desc: '使 1 名角色中毒层数效果翻倍。' },
      { id: 'tt3sp-rageoil',      name: '狂血药水', cost: 2, rarity: '古朴', type: '法术', desc: "混合：2′，附加狂血。" },
      { id: 'tt3sp-bloodstorm',   name: '血腥风暴', cost: 4, rarity: '稀有', type: '法术', desc: "3′，吸血，对敌方全体；注能(2)：额外施放 1 段。" },
      { id: 'tt3sp-shadowshot',   name: '暗影射击', cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "3′，若对手处于诅咒状态，额外施放 1 次。", value: 2 }, // 2026-09-05 职业整合：原地转为降临者职业卡
      { id: 'tt3sp-cursewave',    name: '诅咒光波', cost: 3, rarity: '稀有', type: '法术', desc: "注能(1)：1′ 冰冻、流血、中毒。" },
      // —— 杂项（第三摞 9 张：高费大招与宝物）——
      { id: 'tt3-thunderblast',  name: '雷殛',     cost: 3, rarity: '传说', type: '法术', dmg: 7, dmgType: 'spell', unrandom: true, desc: "7′，墓地指定 1 张牌，伤害 +1。", value: 5 }, // 传说系列重拍：desc 重辨（原文疑「蓄地槽…」），机制沿旧读「从墓地指定」
      { id: 'tt3-flux-slash',    name: '流光斩',   cost: 2, rarity: '传说', type: '武术', dmg: 1, dmgType: 'attack', unrandom: true, desc: '攻1，附加 2 层流血；将流光斩复制放入牌库。', value: 5 }, // 传说系列重拍：改武术、攻1、复制入牌库（原文「流光照影放入牌库」重辨存疑）
      { id: 'tt3-galaxy-mirage', name: '银河幻境', cost: 2, rarity: '史诗', type: '法术', desc: '布下幻阵，治疗所有队友。', value: 5 },
      { id: 'tt3-immortal-blade', name: '不朽神剑', cost: 2, rarity: '传说', type: '装备', unrandom: true, desc: '对战开始时，你的攻击化为 1 张不朽斩。', value: 5 }, // 传说系列重拍：效果按本批照片重写
      { id: 'tt3-diamond',       name: '钻石',     cost: 0, rarity: '传说', type: '资源', unrandom: true, desc: '贵重货币，可出售。', value: 16 },
      { id: 'tt3-master-staff',  name: '大师的神杖', cost: 2, rarity: '稀有', type: '道具', desc: '回合开始时回复 5 点生命。', value: 5 },
      { id: 'tt3-chaos-eye',     name: '混沌之眼', cost: 1, rarity: '传说', type: '装备', unrandom: true, desc: '装备：血量上限 +10，牌库上限 5。', value: 5 }, // 传说系列重拍：卡名/效果按本批照片（旧读「混沌眼」「生命上限+10」）
      { id: 'tt3-execute',       name: '斩杀',     cost: 3, rarity: '传说', type: '武术', dmg: 9, dmgType: 'spell', unrandom: true, desc: "对 9 血以下角色造成 9′。", value: 5 }, // 传说系列重拍：角标武术、阈值 9 血
      { id: 'tt3-savior-elixir', name: '救世灵药', cost: 0, rarity: '传说', type: '道具', unrandom: true, desc: '回复 99 点生命（相当于回满）。', value: 5 },
      // —— 装备（武器/防具/符印一摞；角标与描述已按第四批高清照片逐张重辨修正，
      //     未在本摞照片中出现的条目（魔纹银剑/深红丝袋/圣杖/玄龟/草甲/逆弓/聚魔之血/深衍日记）保持原样）——
      { id: 'tt3-silver-runesword', name: '魔纹银剑', cost: 2, rarity: '稀有', type: '装备', desc: '装备：攻击 +3。', value: 3 },
      { id: 'tt3-azure-sword',  name: '百炼青虹剑', cost: 2, rarity: '稀有', type: '装备', desc: '消耗时 +4 甲，将其置于牌库底。' },
      { id: 'tt3-deep-seal',    name: '深解印记', cost: 4, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。' },
      { id: 'tt3-fate-wheel',   name: '命运钟表', cost: 4, rarity: '史诗', type: '装备', desc: '限定：弃掉所有手牌，获得 1 个额外回合。' },
      { id: 'tt3-crimson-pouch', name: '深红丝袋', cost: 2, rarity: '稀有', type: '装备', desc: '装备：可复制你装备的 1 张牌。', value: 4 },
      { id: 'tt3-holy-staff',   name: '圣杖',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：消耗能量进入法阵。', value: 3 },
      { id: 'tt3-staff',        name: '法杖',     cost: 2, rarity: '古朴', type: '装备', desc: '法伤 +1。' },
      { id: 'tt3-dark-blade',   name: '灭魔之剑', cost: 3, rarity: '稀有', type: '装备', desc: '攻 +2，回合开始 -2 血。' },
      { id: 'tt3-wolf-bow',     name: '天狼长弓', cost: 2, rarity: '稀有', type: '装备', desc: '回合开始时，舍弃 1 张牌并抽 1 张牌。' },
      { id: 'tt3-sapper-bomb',  name: '石工炸药', cost: 2, rarity: '古朴', type: '装备', desc: '消耗时，造成 4 点伤害。' },
      { id: 'tt3-turtle',       name: '玄龟',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：消耗能量，指定 2 张牌并抽 1 张。', value: 3 },
      { id: 'tt3-twinwater-mail', name: '二水甲', cost: 2, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+1 甲。' },
      { id: 'tt3-grass-armor',  name: '草甲',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：装备时回复 2 点生命。', value: 2 },
      { id: 'tt3-blooddrinker', name: '饮血剑',   cost: 2, rarity: '古朴', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 攻。' },
      { id: 'tt3-longsword',    name: '长剑',     cost: 2, rarity: '初始', type: '装备', desc: '+1 攻。' },
      { id: 'tt3-element-seal', name: '元素符印', cost: 4, rarity: '稀有', type: '装备', desc: '注能 2 张法术牌后解锁：法伤 +2，抽 2 张牌。' },
      { id: 'tt3-light-mail',   name: '轻甲',     cost: 2, rarity: '古朴', type: '装备', desc: '+5 血。' },
      { id: 'tt3-reverse-bow',  name: '逆弓',     cost: 2, rarity: '古朴', type: '装备', desc: '装备：对方行动时，将 2 张手牌换新。', value: 2 },
      { id: 'tt3-mana-blood',   name: '聚魔之血', cost: 2, rarity: '稀有', type: '装备', desc: '装备：施法时获得能量。', value: 3 },
      { id: 'tt3-deep-diary',   name: '深衍日记', cost: 1, rarity: '古朴', type: '装备', desc: '装备：记载深处的秘密。', value: 3 },
      // —— 装备（第四批照片重辨补录 2 张：此前未入库）——
      { id: 'tt3eq-boiler',     name: '魔法锅炉', cost: 3, rarity: '古朴', type: '装备', desc: '限定：消耗至多 2 张牌，发现等量随机卡牌。' },
      { id: 'tt3eq-mistbox',    name: '迷之匣',   cost: 2, rarity: '古朴', type: '装备', desc: '对战开始时，将 2 张攻替换为随机卡牌。' },
      // —— 资源（散卡 3 张）——
      { id: 'tt3-garnet-marble', name: '石榴石弹珠', cost: 0, rarity: '古朴', type: '资源', desc: '漂亮的小玩意，可出售。', value: 3 },
      { id: 'tt3-wood-bundle',  name: '一捆木材', cost: 0, rarity: '稀有', type: '资源', desc: '木材 ×3。', value: 6 },
      { id: 'tt3-ration-double', name: '双份口粮', cost: 0, rarity: '稀有', type: '资源', desc: '口粮 ×2。', value: 6 },
    ],

    // 桌游手绘卡 · 第四批（2026-09-01 照片提取，15 张）：
    // 13 张与第一批同设计（金色令牌 ×2、银币 ×2、铜币 ×3 含「高价值」1 张、
    // 彩色令牌、能源水晶、金创药、医疗针、金币），不再重复入库；高清照片同时
    // 修正第一批「金色令牌传说卡」识别。播本批新设计 3 张：耀金令牌、烟雾弹，
    // 以及「木化」——资源标注重拍照片证实它是独立药水卡（回复 6 血、物品·2币），
    // 此前被误并入「木材」，已在第一批拆分还原。
    // 角标「[[icon:crystal]] 字」多数取卡名/效果用字（彩/木/水/金/传），唯烟雾弹 [[icon:crystal]]稀 与效果
    // 无关，按稀有度「稀有」解读。
    TABLETOP4: [
      { id: 'tt4-shine-token', name: '耀金令牌', cost: 2, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', value: 7 },
      { id: 'tt4-smoke-bomb',  name: '烟雾弹',   cost: 1, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', value: 3 },
      { id: 'tt4-woodify',     name: '木化',     cost: 0, rarity: '初始', type: '道具', desc: '回复 6 点生命。', value: 2 },
    ],

    // 桌游手绘卡 · 第五批（2026-09-01「传说卡」照片，10 张）：
    // 全批为传说特例卡——非常强力，unrandom: true 锁死随机与发现获取
    // （含商店随机槽位；「耀金令牌：发现 1 张传说卡」同样发现不到它们）。
    // 照片中另 8 张为已有卡重拍：斩杀/流光斩/剑落纷霜/雷殛/混沌之眼/不朽神剑
    // 已在 TABLETOP3 升传说并按照片修订，救世灵药/钻石仅补 unrandom 标记。
    TABLETOP5: [
      { id: 'tt5-archstaff',    name: '大法师的权杖', cost: 2, rarity: '传说', type: '装备', unrandom: true, desc: '回合开始时，法伤 +1。', value: 5 },
      { id: 'tt5-galaxy-voyage', name: '银河之旅',   cost: 4, rarity: '传说', type: '法术', unrandom: true, desc: '本场对战中，你的所有法术均为 1 费。', value: 5 }, // 原文单字「术」，按法术解读
    ],

    // 桌游手绘卡 · 第六批（2026-09-01「事件卡」照片，10 张）：
    // 设计者定版——这一类是事件，只能在棋盘的事件格中触发，无法在背包中使用，
    // 背包里会记录本局触发过哪些事件（game.js 事件格结算 + 背包「事件记录」）。
    // 因此稀有度记为「衍生」（不进商店/随机池），并全部加 unrandom 双保险；
    // 闪金之锤角标 <事件战斗>、盗匪横行含土匪×5，battle: true 供战斗结算识别。
    TABLETOP6: [
      { id: 'tt6-timeskip',    name: '时空孔隙',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '前进 6 格。' },
      { id: 'tt6-demondeal',   name: '恶魔交易',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '-1 血，获得传奇武器。' },
      { id: 'tt6-bandits',     name: '盗匪横行',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '掠夺者 ×5。奖励：密封物资箱 ×2。' },
      { id: 'tt6-mystery',     name: '神秘补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得彩色令牌（特殊单位），+2 币。' },
      { id: 'tt6-goldmine',    name: '金矿',       cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得 3 币。' },
      { id: 'tt6-goldhammer',  name: '闪金之锤',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '造成 5 点伤害，若斩杀敌人，+2 币。' },
      { id: 'tt6-relief',      name: '爱心救济站', cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '回复 6 血。' },
      { id: 'tt6-airdrop',     name: '空中补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从木材、口粮、绷带、碘酒中抽取一项。' }, // 后两项重辨存疑
      { id: 'tt6-chestdraw',   name: '遗留物资',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从遗留物资箱中撬开 1 个。' },
      { id: 'tt6-systemsupply', name: '系统补给',  cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得彩色令牌（特殊单位），木材 ×1。' }, // 卡名/描述重辨存疑，与「神秘补给」同系列
    ],

    // 桌游手绘卡 · 第七批（2026-09-01「职业卡」照片 → 2026-09-05 职业整合定版）：
    // 2026-09-05 设计者定版：原 11 职业 44 张职业卡整合为 5 职业（侠客/战士/牧师/法师/降临者），
    // 每职业 10-12 张职业卡（含本批新增 cc- 前缀整合卡与第三批原地转职的 4 张，全表见
    // docs/class-consolidation.md）；职业卡 rarity 全部为「职业」，unrandom 锁死随机与发现获取
    // ——不同职业不互通，只经 classPool / randomClassCard 按职业发放。
    // 实机卡库的老卡改归属/更名/退役与 cc- 新卡补种由 ensureClassConsolidation() 完成。
    TABLETOP7: [
      // —— 侠客（← 刺客 + 剑客 + 游侠；英雄卡：白梅落影·妄 / 天剑诛魔·云阳 / 无量仙剑·云风）——
      { id: 'tt7-throwblade',  name: '飞刃偷袭',   cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 3, dmgType: 'attack', desc: '攻3，附加流血，抽 1 张牌。', value: 3 },
      { id: 'cc-jianghu',      name: '江湖救急',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '发现 1 张其它职业的卡牌并施放。', value: 3 }, // 职业版，与第二批同名普通版并存（与设计者卡库一致）
      { id: 'tt7-goldencicada', name: '金蝉脱壳',  cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '弃掉所有手牌，抽 3 张。', value: 4 },
      { id: 'tt7-sneak',       name: '偷袭',       cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1。', value: 3 },
      { id: 'cc-treasure',     name: '盗宝',       cost: 1, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '发现 1 张装备牌。', value: 2 },
      { id: 'tt7-ghostblade',  name: '鬼魅之刃',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，破隐时伤害 +2，并抽 2 张牌。', value: 3 },
      { id: 'tt7-thundergrudge', name: '快意恩仇', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 0, dmgType: 'attack', desc: '消耗 2 张杀，攻击 3 次。', value: 3 }, // 定版更名（原疾雷恩仇），代价句对齐 battle.core「消耗 N 张杀」结算
      { id: 'tt7-meteorrain',  name: '流星箭雨',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，2 段伤害。', value: 3 },
      { id: 'tt7-stealth',     name: '潜匿',       cost: 1, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '进入潜行状态 1 回合。', value: 4 },
      { id: 'tt7-swordimmortal', name: '剑仙形态', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '对决中，每回合额外抽 1 张。', value: 4 }, // 定版更名（原剑仙附身）
      // —— 战士（← 战士 + 守卫；英雄卡：龙吟沧海·关云长 / 圣剑誓约·亚瑟）——
      { id: 'cc-unmoved',      name: '不变应万变', cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合所受伤害降为 1，获得 4 点护甲。', value: 3 },
      { id: 'tt7-marchrush',   name: '急行军',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '抽 2 张牌，+4 甲；压制：抽 1 张牌。', value: 3 }, // 定版更名（原急行奔驰）
      { id: 'tt7-bulwark',     name: '坚盾',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合获得 8 点护甲，回合结束 -4 点。', value: 2 },
      { id: 'tt7-armup',       name: '武装',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '从牌库中抽取 1 张装备贮藏。', value: 2 },
      { id: 'tt7-whirlwind',   name: '旋风斩',     cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，全体攻击。', value: 2 },
      { id: 'cc-prep',         name: '厉兵秣马',   cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合攻击 +2，抽 2 张牌。', value: 3 },
      { id: 'tt7-demonbreaker', name: '破甲重斩',  cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，附加破甲；击杀则 +4 甲。', value: 3 },
      { id: 'tt7-fullstrike',  name: '全力一击',   cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，抽 1 张牌。', value: 2 },
      { id: 'tt7-ironphalanx', name: '铁甲阵',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '+10 甲，洗入 5 张随机卡牌。', value: 4 },
      { id: 'tt7-bloodpoison', name: '血毒双镖',   cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，附加流血；攻1，附加中毒。', value: 2 },
      // —— 牧师（← 牧师 + 授印者 + 术士；英雄卡：浪掷风吟·露娜拉 / 无极梦魇·血苑修罗）——
      // 另有 吞噬（tt3sp-devour）/ 圣盾（tt3-holy-shield）自第三批原地转职为本职业卡
      { id: 'tt7-silence',     name: '禁言术',     cost: 0, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '沉默 1 名角色 1 回合，抽 1 张牌。', value: 2 },
      { id: 'cc-demon',        name: '恶魔之力',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，损失 2 点生命。", value: 3 },
      { id: 'cc-petal',        name: '花瓣法阵',   cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '每回合结束回复 3 点生命。', value: 4 },
      { id: 'tt7-holyglow',    name: '沐愈光辉',   cost: 4, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '将自身血量回复至 12 血。', value: 3 },
      { id: 'tt7-holyheal',    name: '圣光治愈',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '弃置 1 张牌，回复 2 倍于其费用的血量。', value: 2 },
      { id: 'tt7-provoke',     name: '扰敌',       cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '迫使 2 名敌人斗殴。', value: 2 },
      { id: 'tt7-bloodpotion', name: '噬血术',     cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 3, dmgType: 'spell', desc: "混合：3′，吸血。", value: 3 }, // 定版更名（原噬血药水）
      { id: 'tt7-smite',       name: '惩击',       cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，对血量以下的敌人不能增益。", value: 2 },
      { id: 'cc-holysrc',      name: '圣光之源',   cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '每回合结束回复 2 点生命。', value: 3 },
      // —— 法师（← 法师 + 召唤师；英雄卡：明灯千里·孔明 / 神话终章·雷修斯）——
      // 另有 坚冰结界（tt3-firm-barrier）自第三批原地转职为本职业卡
      { id: 'tt7-arcanebolt',  name: '奥术弹',     cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, dmg: 1, dmgType: 'spell', desc: "1′，抽 1 张牌。", value: 3 },
      { id: 'tt7-energize',    name: '聚能',       cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '能量 +1。', value: 2 },
      { id: 'tt7-frozenight',  name: '冰封千里',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '冰冻所有敌人。', value: 3 },
      { id: 'cc-manasupply',   name: '法力补给',   cost: 1, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '获得 2 点能量，抽 1 张牌。', value: 3 },
      { id: 'tt7-stratagem',   name: '法师锦囊',   cost: 1, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '对战开始时拿 3 张牌备用，打牌时选择 1 张施放。', value: 3 }, // 定版更名（原锦囊）
      { id: 'cc-thousand',     name: '千变万化',   cost: 2, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '发现并直接施放 1 张牌，再抽 2 张牌。', value: 4 },
      { id: 'tt7-bladebloom',  name: '永恒绽放',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '发现并施放 1 张牌，获取剩下两张。', value: 4 }, // 定版更名（原利刃绽放）
      { id: 'tt7-recruit',     name: '征召',       cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：召唤骑兵 ×2 冲锋作战。', value: 3 },
      { id: 'tt7-elementstorm', name: '元素风暴',  cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：下一张法术施放 2 次。', value: 4 },
      // —— 降临者（← 降临者 + 授印者；英雄卡：九尾焚天·妲 / 楔天玄翼·焚殃）——
      // 另有 暗影射击（tt3sp-shadowshot）自第三批原地转职为本职业卡
      { id: 'cc-doom',         name: '厄运',       cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: '随机获取 2 张能施加诅咒的卡牌。', value: 3 },
      { id: 'cc-darkform',     name: '黑暗形态',   cost: 1, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: '回合开始时获得 1 点能量。', value: 3 },
      { id: 'tt7-burnharvest', name: '爆燃火球',   cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，受法伤加成翻倍。", value: 3 }, // 定版更名（原燃烧收获）；注能收益已删（ensureCardFixes，2026-09-05）
      { id: 'cc-chargefb',     name: '充能火球',   cost: 1, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 3, dmgType: 'spell', desc: "3′；注能(小)：改为 6′。", value: 2 },
      { id: 'cc-flameform',    name: '火焰形态',   cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 3, dmgType: 'spell', desc: '对全体敌人造成 3 点伤害，本回合法伤 +1。', value: 3 },
      { id: 'tt7-twinfireball', name: '三重火球',  cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，可使用 3 次。", value: 4 }, // 定版更名（原双生火球），次数按三重
      { id: 'tt7-abysscurse',  name: '深渊诅咒',   cost: 3, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，附加禁疗；此时对方每有 1 种诅咒，抽 1 张牌。", value: 3 },
      { id: 'tt7-meteorstrong', name: '星陨之力',  cost: 4, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "注能(2)：施放 3 次火球术(4′)。", value: 4 }, // 定版更名（原陨强）
      { id: 'cc-deathray',     name: '致命射线',   cost: 3, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，附加 2 种随机诅咒。", value: 4 },
      { id: 'cc-stormfb',      name: '风暴火球',   cost: 3, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: '对全体敌人每人释放 1 次火球。', value: 4 },
    ],

    // 桌游手绘卡 · 第八批（2026-09-01「英雄卡」照片 → 2026-09-05 职业整合定版）：
    // 英雄卡 = 各职业的觉醒形态（角标「职业·觉醒」），type 英雄卡、cls 绑定职业、hero: true；
    // 2026-09-05 职业整合后每职业 1-3 张英雄卡：
    //   侠客：妄 / 云阳 / 云风 · 战士：关云长 / 亚瑟 · 牧师：露娜拉 / 修罗（原术士英雄定版更名）
    //   法师：孔明 / 雷修斯（原召唤师英雄定版更名）· 降临者：邪渊主宰·妲莉薇特 / 楔
    // 原授印者英雄「邪渊主宰」2026-09-05 定版更名「邪渊主宰·妲莉薇特」并改归降临者
    //（描述按降临者火焰主题重写，卡面立绘随 cls 自动换为降临者）；
    // 其印记衍生牌（治伤+1 等 4 张）未随迁，保留退役。
    // 英雄卡本体只能通过 ① 事件拼凑 ② 祭坛弃牌 ③ 彩色令牌 三种途径获得——均不实装为
    // 随机获取，故全部 unrandom（获取途径待后续版本实装）。
    // 衍生牌（角标「衍」/「××专属·衍生」）围绕英雄效果展开：rarity 衍生、
    // tokenOf 指向所属英雄；禁咒×4 由牧师英雄「无极梦魇·血苑修罗」洗入牌库，
    // 诛魔剑系由侠客英雄「天剑诛魔·云阳」洗入牌库，青龙偃月斩为战士英雄武器。
    // 角标 [[icon:crystal]][[icon:crystal]]/[[icon:crystal]] 照录为稀有/古朴；「5[[icon:coin]]/8[[icon:coin]]」为币值（右下盾形数字同值）。
    TABLETOP8: [
      // —— 英雄卡（5 职业 · 11 张）——
      { id: 'tt8-hero-assassin',   name: '白梅落影·妄',       cost: 0, rarity: '稀有', type: '英雄卡', cls: '侠客', hero: true, unrandom: true, desc: '潜入夺宝：净化陷阱，潜行 2 回合；破隐一连击开弹幕。', value: 5 }, // 关键词与尾句重辨存疑
      { id: 'tt8-hero-sword',      name: '无量仙剑·云风',     cost: 0, rarity: '稀有', type: '英雄卡', cls: '侠客', hero: true, unrandom: true, desc: '万剑归宗：抽 5 张牌，充能 +1。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-hero-ranger',     name: '天剑诛魔·云阳',     cost: 0, rarity: '古朴', type: '英雄卡', cls: '侠客', hero: true, unrandom: true, desc: '寂断念：将天启剑与 5 件魔剑洗入牌库。', value: 5 }, // 关键词重辨存疑
      { id: 'tt8-hero-warrior',    name: '龙吟沧海·关云长',   cost: 0, rarity: '稀有', type: '英雄卡', cls: '战士', hero: true, unrandom: true, desc: '真龙降世：攻 +2 的青龙偃月斩。', value: 8 },
      { id: 'tt8-hero-guardian',   name: '圣剑誓约·亚瑟',     cost: 0, rarity: '古朴', type: '英雄卡', cls: '战士', hero: true, unrandom: true, desc: '诛邪圣剑：本局对战，能量上限 +1，起始牌 +1。', value: 8 },
      { id: 'tt8-hero-priest',     name: '浪掷风吟·露娜拉',   cost: 0, rarity: '稀有', type: '英雄卡', cls: '牧师', hero: true, unrandom: true, desc: '甘霖降世：置入随机卡牌直至 6 张；每 1 次施法回复 3 血。', value: 5 },
      { id: 'tt8-hero-warlock',    name: '无极梦魇·血苑修罗', cost: 0, rarity: '稀有', type: '英雄卡', cls: '牧师', hero: true, unrandom: true, desc: '无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。', value: 5 }, // 定版更名（原无极魔怨·血欲断念）；关键词重辨存疑
      { id: 'tt8-hero-mage',       name: '明灯千里·孔明',     cost: 0, rarity: '稀有', type: '英雄卡', cls: '法师', hero: true, unrandom: true, desc: '万法乾坤：法伤 +1，回合结束时抽 1 张牌。', value: 5 },
      { id: 'tt8-hero-summoner',   name: '神话终章·雷修斯',   cost: 0, rarity: '稀有', type: '英雄卡', cls: '法师', hero: true, unrandom: true, desc: '元素潮汐：打开神界之门。', value: 5 }, // 定版更名（原神话终章·维新）；卡名/关键词重辨存疑
      { id: 'tt8-hero-sealer',     name: '邪渊主宰·妲莉薇特', cost: 0, rarity: '稀有', type: '英雄卡', cls: '降临者', hero: true, unrandom: true, desc: '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。', value: 5 }, // 定版更名并改归降临者（原授印者英雄「邪渊主宰」）；效果沿用「每消耗 1 张牌施放火球」结算
      { id: 'tt8-hero-descender',  name: '楔天玄翼·焚殃',     cost: 0, rarity: '古朴', type: '英雄卡', cls: '降临者', hero: true, unrandom: true, dmg: 4, dmgType: 'spell', desc: "寂灭苍穹：法伤 +1，每消耗 1 张牌，施放 1 次火球术(4′)。", value: 5 }, // 卡名重辨存疑
      // —— 衍生牌 · 牧师专属（无极梦魇·血苑修罗洗入牌库的禁咒）——
      { id: 'tt8-curse1', name: '禁咒I',   cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：夺取 1 点攻击力。', value: 5 },
      { id: 'tt8-curse2', name: '禁咒II',  cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：冰冻。', value: 5 },
      { id: 'tt8-curse3', name: '禁咒III', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：中毒，流血。', value: 5 },
      { id: 'tt8-curse4', name: '禁咒IV', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：沉默 1 回合。', value: 5 },
      // —— 衍生牌 · 侠客专属（天剑诛魔·云阳洗入牌库的剑）——
      { id: 'tt8-demonslay',  name: '诛魔剑',     cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时攻击全体敌人；以天启诛魔剑覆盖你的所有武器。', value: 4 },
      { id: 'tt8-archdemon',  name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '攻 +1，手中所有武器牌视为重衍。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-heavensword', name: '天启剑',    cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时额外抽 1 张牌；在你抽到天启剑与 5 件魔剑后……', value: 4 },
      // —— 衍生牌 · 战士（关云长的佩刀）——
      { id: 'tt8-dragonblade', name: '青龙偃月斩', cost: 0, rarity: '衍生', type: '武术', cls: '战士', tokenOf: 'tt8-hero-warrior', unrandom: true, dmg: 6, dmgType: 'attack', desc: '攻6，破甲，流血。', value: 8 },
    ],

    // 生物图鉴（第九批，2026-09-04 定版：新卡牌类型「生物」——与武术/法术等并列）。
    // 全部敌人信息录入：数值与 mapData.js monsters / altar.bosses 一一对应
    // （角标「攻-血」即设计者记法，如巨兽「荒渊」7-40）；art 字段指向战场立绘 id。
    // 生物卡是敌人图鉴：unrandom + 衍生稀有度双重排除，不进商店/发现/随机池，
    // 也无法在对战中打出（battle.core unplayableReason）。
    BESTIARY: [
      // —— 普通怪物（外圈 → 内圈）——
      { id: 'foe-infantry',   name: '荒民打手',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'infantry',   desc: '攻击 4 / 生命 4。普通近战，行动无特殊之处。' },
      { id: 'foe-archer',     name: '废土猎手',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'archer',     desc: '攻击 5 / 生命 3。远程攻击。' },
      { id: 'foe-bandit',     name: '掠夺者',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'bandit',     desc: '攻击 3 / 生命 3。普通近战，成群出现（盗匪横行 ×5）。' },
      { id: 'foe-cavalry',    name: '机车掠袭者', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'cavalry',    desc: '攻击 5 / 生命 6。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-orc_jav',    name: '畸变投掷者', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_jav',    desc: '攻击 6 / 生命 4。远程投掷。' },
      { id: 'foe-orc_axe',    name: '畸变屠夫',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_axe',    desc: '攻击 4 / 生命 7。防御/反击型，隔回合蓄势。' },
      { id: 'foe-wolf_rider', name: '畸变狼骑兵', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'wolf_rider', desc: '攻击 7 / 生命 6。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-fire_el',    name: '灼热异变体', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'fire_el',    desc: '攻击 10 / 生命 7。攻击并灼烧。' },
      { id: 'foe-water_el',   name: '腐蚀异变体', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'water_el',   desc: '攻击 7 / 生命 10。防御/反击型，隔回合蓄势。' },
      { id: 'foe-grass_el',   name: '滋生异变体', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'grass_el',   desc: '攻击 5 / 生命 12。攻击并施加诅咒。' },
      { id: 'foe-dragon',     name: '巨兽「荒渊」', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'dragon', desc: '攻击 7 / 生命 40。精英强敌：重击/特殊；第一回合蓄力不会攻击。' },
      // —— BOSS（污染核心三首脑）——
      { id: 'foe-boss_general', name: '锈蚀将军', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_general',
        desc: '攻击 5 / 生命 50。BOSS·词缀【军威】：每个回合结束时攻击力 +2。' },
      { id: 'foe-boss_orc',   name: '兽群之主',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_orc',
        desc: '攻击 4 / 生命 45。BOSS·词缀【狂乱】：每回合攻击两次，每次附加 1 层流血或中毒。' },
      { id: 'foe-boss_elem',  name: '辐射领主',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_elem',
        desc: '攻击 8 / 生命 48。BOSS·词缀【元素庇幕】：偶数回合减免所有伤害（破甲可克制）。' },
    ],

    all() {
      try { return JSON.parse(localStorage.getItem(KEY)) || []; }
      catch (e) { return []; }
    },

    saveAll(cards) { localStorage.setItem(KEY, JSON.stringify(cards)); },

    upsert(card) {
      const cards = SDT.Cards.all();
      if (!card.id) card.id = 'c' + Date.now().toString(36) + Math.floor(Random.random('identity') * 46656).toString(36);
      const i = cards.findIndex(c => c.id === card.id);
      if (i >= 0) cards[i] = card; else cards.push(card);
      SDT.Cards.saveAll(cards);
      return card;
    },

    remove(id) { SDT.Cards.saveAll(SDT.Cards.all().filter(c => c.id !== id)); },

    clearAll() { localStorage.removeItem(KEY); },

    // ---- 卡背图案（v0.21）：默认「行囊粗布」恒解锁，其余由成就领取解锁 ----
    // emblem 印在卡背中央；from 说明解锁途径（基地成就页展示）。
    CARD_BACKS: [
      { id: 'classic', name: '行囊粗布', icon: 'cards',   from: '默认卡背' },
      { id: 'wolf',    name: '猎手皮纸', icon: 'swords',  from: '成就「猎手」' },
      { id: 'coin',    name: '富商锦缎', icon: 'coin',    from: '成就「小有积蓄」' },
      { id: 'vault',   name: '仓廪木纹', icon: 'pocket',  from: '成就「仓廪充实」' },
      { id: 'boss',    name: '弑神黑曜', icon: 'demon',   from: '成就「弑神者」' },
      { id: 'altar',   name: '核心星轨', icon: 'crystal', from: '成就「净化征服者」' },
      { id: 'pet',     name: '忠犬爪印', icon: 'paw',     from: '成就「最忠实的伙伴」' },
    ],

    // 卡背渲染：backId 缺省 = 当前存档装备的卡背（未选档时回退默认）。
    // 样式类 hb-* 定义在 index.html；cls 控制尺寸场景（如缩略图）。
    cardBackHTML(backId, cls) {
      const backs = SDT.Cards.CARD_BACKS;
      let id = backId;
      if (!id) {
        try { id = window.SDT.Base ? window.SDT.Base.backSel() : 'classic'; }
        catch (e) { id = 'classic'; }
      }
      const bd = backs.find(b => b.id === id) || backs[0];
      return `<div class="hs-back hb-${bd.id}${cls ? ' ' + cls : ''}">` +
        `<i class="hsb-frame"></i><span class="hsb-emblem">${SDT.Icons.img(bd.icon || 'cards')}</span><i class="hsb-shine"></i></div>`;
    },

    // 卡面渲染（em 布局，cls 控制尺寸 sm/lg/xl；game.js / battle.js 共用）
    cardHTML(c, cls) {
      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
      const dmg = +(c.dmg || 0);
      const isDmgType = SDT.Cards.DMG_TYPES.includes(c.type);
      // 稀有度展示（2026-09-04 定版）：有效稀有度一律经 rarityOf 推导——
      // 英雄卡与其衍生牌 = 棱彩（rv-prism 渐变流转，传说英雄走金光变体 rv-gold）；
      // 衍生物继承创造者稀有度；攻击词条允许负数字。
      const isPrism = SDT.Cards.rarityOf(c) === '棱彩';
      const ro = SDT.Cards.rarityOf(c);
      const rvCls = isPrism
        ? ('rv-prism' + ((c.rarity === '传说' ||
            (c.tokenOf && (SDT.Cards.all().find(x => x.id === c.tokenOf) || {}).rarity === '传说')) ? ' rv-gold' : ''))
        : 'rv' + Math.max(0, SDT.Cards.RARITIES.indexOf(ro));
      const ti = Math.max(0, SDT.Cards.TYPES.indexOf(c.type));
      const showDmg = isDmgType && (dmg > 0 || (dmg < 0 && c.dmgType === 'attack'));
      const mark = showDmg ? SDT.Cards.dmgMark(c.dmgType, dmg) : null;
      const ghostDmg = !showDmg && isDmgType && c._preview;
      // 桌游道具卡的币值角标（右下角金色硬币）
      const val = +(c.value || 0);
      const showVal = val > 0;
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
      return `<div class="hs-card tp${ti} ${rvCls}${cls ? ' ' + cls : ''}">
        <div class="hsc-cost">${c.cost}</div>
        <div class="hsc-art">${artHTML}</div>
        <div class="hsc-name">${esc(c.name || '未命名卡牌')}</div>
        <div class="hsc-type">${esc(c.type || '?')} · ${esc(ro === '职业' ? '人物专属' : ro)}</div>
        ${kwHTML}
        <i class="hsc-gem"></i>
        <div class="hsc-desc">${c.desc ? `<span>${esc(c.desc)}</span>` : ''}</div>
        ${showDmg ? `<div class="hsc-dmg" title="${escAttr(mark.tip)}">${mark.icon}<b>${mark.text}</b></div>` : ''}
        ${ghostDmg ? `<div class="hsc-dmg ghost">${SDT.Icons.img('swords')}<b>0</b></div>` : ''}
        ${showVal ? `<div class="hsc-val" title="币值 ${val}${SDT.Cards.isSellable(c) ? ' · 可出售' : ' · 不可出售'}"><i>[[icon:coin]]</i><b>${val}</b></div>` : ''}
      </div>`;
    },

    // 播入初始牌「初始攻击」（只播一次，之后删改都尊重玩家）
    ensureSha() {
      // 旧档迁移：早期版本默认名「杀」统一纠正为定版「初始攻击」
      // （按 id 识别系统卡，只纠正旧默认名，不覆盖玩家后来改过的其它名字）
      try {
        const cards = SDT.Cards.all();
        const sha = cards.find(c => c.id === SDT.Cards.SHA.id);
        if (sha && sha.name === '杀') {
          sha.name = SDT.Cards.SHA.name;
          sha.desc = SDT.Cards.SHA.desc;
          SDT.Cards.saveAll(cards);
        }
      } catch (e) { /* 存储不可用时静默跳过 */ }
      SDT.Cards.seedBatch([SDT.Cards.SHA], 'sdt-cards-sha-seeded');
    },

    // 卡牌库为空或缺少初始牌时，补入新手卡
    ensureStarters() {
      const cards = SDT.Cards.all();
      if (!cards.length || !cards.some(c => c.rarity === '初始')) {
        SDT.Cards.STARTERS.forEach(c => SDT.Cards.upsert(c));
      }
    },

    // 通用播种：一批卡一个标记，只播一次；已有同名/同 id 的卡跳过。
    // replacePrefix：同前缀且同 id 的内置卡视为「旧识别」，用最新数据覆盖。
    seedBatch(list, markerKey, replacePrefix) {
      try {
        if (localStorage.getItem(markerKey)) return;
        list.forEach(c => {
          const cards = SDT.Cards.all();
          if (replacePrefix && String(c.id || '').startsWith(replacePrefix) &&
              cards.some(x => x.id === c.id)) {
            SDT.Cards.upsert({ ...c });
            return;
          }
          if (!cards.some(x => x.id === c.id || x.name === c.name)) {
            SDT.Cards.upsert({ ...c });
          }
        });
        localStorage.setItem(markerKey, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 护盾→护甲术语迁移（设计者 2026-09-04 定版：护盾与护甲同义，统一为护甲；
    // 战后护甲清零）。每次启动把卡牌描述里的「护盾」改写为「护甲」，幂等。
    ensureShieldToArmor() {
      try {
        const cards = SDT.Cards.all();
        let dirty = false;
        cards.forEach(c => {
          if (c.desc && String(c.desc).includes('护盾')) { c.desc = String(c.desc).replace(/护盾/g, '护甲'); dirty = true; }
        });
        if (dirty) SDT.Cards.saveAll(cards);
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 设计者定版数据修正（一次性）：爆燃火球描述未写注能收益，删除其注能字段
    ensureCardFixes() {
      try {
        if (localStorage.getItem('sdt-mig-burnharvest')) return;
        const cards = SDT.Cards.all();
        cards.forEach(c => {
          if (c.id === 'tt7-burnharvest' && c.infuse) { delete c.infuse; }
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem('sdt-mig-burnharvest', '1');
      } catch (e) { /* 静默跳过 */ }
    },

    // 播入桌游手绘卡（第一批资源·道具 + 第二批装备/武术 + 第三批全套 + 第四/五批新设计）
    ensureTabletop() {
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP, TT1_KEY_V6, 'tt');   // v6：老档重播一次，按 id 覆盖（资源类型化、木材/木化拆分、经济卡包可出售）
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP2, TT2_KEY_V3, 'tt2');
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP3, TT3_KEY_V5, 'tt3'); // v5：传说系列照片——升传说、unrandom 锁定、重辨修订
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP4, TT4_KEY_V2, 'tt4'); // v2：补入木化
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP5, TT5_KEY, 'tt5');
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP6, TT6_KEY, 'tt6');
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP7, TT7_KEY, 'tt7');
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP8, TT8_KEY, 'tt8');
      SDT.Cards.seedBatch(SDT.Cards.BESTIARY, TT9_KEY);            // 第九批：生物图鉴（全部敌人信息录入，2026-09-04 定版）
      SDT.Cards.ensureClassRarity();   // v2：老档第七批职业卡统一迁移为「职业」稀有度（2026-09-04 定版）
      SDT.Cards.ensureShieldToArmor(); // 护盾→护甲术语迁移（含老存档，2026-09-04 定版）
      SDT.Cards.ensureCardFixes();    // 设计者定版数据修正（爆燃火球删注能，2026-09-05）
      SDT.Cards.ensureClassConsolidation(); // 职业整合：11 职业 → 5 职业，逐卡改归属（2026-09-05 定版）
      SDT.Cards.ensureDmgValues();    // 伤害数值回填（描述 N′ → dmg 字段，2026-09-04 新增）
      SDT.Cards.ensureHeroFields();   // 修复早期制作坊保存丢失的 cls/hero（专属立绘依赖）
    },

    // 职业稀有度迁移（设计者 2026-09-04 定版）：老档里第七批职业卡（tt7- 前缀）
    // 还带着 初始/古朴/稀有 旧稀有度，一次性统一改为「职业」（黑棱形）。
    // 只改 rarity 字段，不覆盖玩家在制作坊改过的名字与描述；一次性运行，
    // 之后玩家手动改稀有度不再被纠正。
    ensureClassRarity() {
      try {
        if (localStorage.getItem(TT7_KEY_V2)) return;
        const defs = SDT.Cards.TABLETOP7;
        const cards = SDT.Cards.all();
        let dirty = false;
        cards.forEach((c) => {
          if (!defs.some(d => d.id === c.id)) return;
          if (c.rarity !== '职业') { c.rarity = '职业'; dirty = true; }
        });
        if (dirty) SDT.Cards.saveAll(cards);
        localStorage.setItem(TT7_KEY_V2, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 职业整合迁移（设计者 2026-09-05 定版）：原 11 职业 → 5 职业（侠客/战士/牧师/法师/降临者），
    // 每职业 10-12 张职业卡，不同职业不互通。一次性运行（CC_KEY 标记），之后玩家在制作坊的
    // 改名/改描述/改稀有度不再被纠正。步骤：
    //   ① 旧职业卡按 id 改归属并统一为职业卡形态（职业稀有度 + unrandom），按 id 定版更名；
    //   ② 设计者在制作坊自建的职业卡（id 不在种子表）按卡名收编（只动 cls/稀有度/锁定位）；
    //   ③ 补种整合新增卡（TABLETOP7/8 中 cc- 前缀定义）并撤下已废弃的占位卡；
    //   ④ 未入列的旧职业卡退役：去掉 cls 保留在图鉴（不再进任何职业池/随机发放），
    //      并兜底清掉一切残留旧职业名的归属。
    // 定版归属总表见 docs/class-consolidation.md。
    ensureClassConsolidation() {
      try {
        if (localStorage.getItem(CC_KEY)) return;
        const cards = SDT.Cards.all();
        const CC_CLASSES = CLASSES;
        // ① id → 新职业（老 id 保留，便于存档兼容与后续调整）
        const CC_REASSIGN = {
          // 侠客（← 刺客/剑客/游侠）
          'tt7-throwblade': '侠客', 'tt7-stealth': '侠客', 'tt7-ghostblade': '侠客', 'tt7-goldencicada': '侠客',
          'tt7-sneak': '侠客', 'tt7-meteorrain': '侠客', 'tt7-thundergrudge': '侠客', 'tt7-swordimmortal': '侠客',
          // 战士（← 战士/守卫）
          'tt7-whirlwind': '战士', 'tt7-demonbreaker': '战士', 'tt7-marchrush': '战士',
          'tt7-bulwark': '战士', 'tt7-fullstrike': '战士', 'tt7-armup': '战士', 'tt7-ironphalanx': '战士', 'tt7-bloodpoison': '战士',
          // 牧师（← 牧师/授印者/术士；吞噬/圣盾 自第三批转职）
          'tt7-holyglow': '牧师', 'tt7-holyheal': '牧师', 'tt7-provoke': '牧师', 'tt7-bloodpotion': '牧师',
          'tt7-silence': '牧师', 'tt7-smite': '牧师', 'tt3sp-devour': '牧师', 'tt3-holy-shield': '牧师',
          // 法师（← 法师/召唤师；坚冰结界 自第三批转职）
          'tt7-arcanebolt': '法师', 'tt7-energize': '法师', 'tt7-frozenight': '法师', 'tt7-recruit': '法师',
          'tt7-elementstorm': '法师', 'tt7-stratagem': '法师', 'tt7-bladebloom': '法师', 'tt3-firm-barrier': '法师',
          // 降临者（← 降临者/授印者；暗影射击 自第三批转职）
          'tt7-abysscurse': '降临者', 'tt7-burnharvest': '降临者', 'tt7-twinfireball': '降临者',
          'tt7-meteorstrong': '降临者', 'tt3sp-shadowshot': '降临者',
        };
        // ①' 英雄卡与衍生牌：只改 cls 归属（稀有度保持 稀有/古朴/衍生，不并入「职业」）
        const CC_HERO_REASSIGN = {
          // 侠客：妄（原刺客）/ 云风（原剑客）/ 云阳（原游侠）
          'tt8-hero-assassin': '侠客', 'tt8-hero-sword': '侠客', 'tt8-hero-ranger': '侠客',
          'tt8-demonslay': '侠客', 'tt8-archdemon': '侠客', 'tt8-heavensword': '侠客', // 云阳专属衍生剑随迁
          // 战士：关云长（原战士）/ 亚瑟（原守卫）
          'tt8-hero-warrior': '战士', 'tt8-hero-guardian': '战士', 'tt8-dragonblade': '战士',
          // 牧师：露娜拉（原牧师）/ 修罗（原术士）；禁咒×4 随修罗迁入
          'tt8-hero-priest': '牧师', 'tt8-hero-warlock': '牧师',
          'tt8-curse1': '牧师', 'tt8-curse2': '牧师', 'tt8-curse3': '牧师', 'tt8-curse4': '牧师',
          // 法师：孔明（原法师）/ 雷修斯（原召唤师）
          'tt8-hero-mage': '法师', 'tt8-hero-summoner': '法师',
          // 降临者：邪渊主宰·妲莉薇特（原授印者英雄定版更名改归）/ 楔（原降临者）
          'tt8-hero-descender': '降临者', 'tt8-hero-sealer': '降临者',
        };
        // ① id → 定版更名（与设计者实机卡库的最新命名对齐）
        const CC_RENAME = {
          'tt7-thundergrudge': '快意恩仇', 'tt7-swordimmortal': '剑仙形态', 'tt7-bloodpotion': '噬血术',
          'tt7-marchrush': '急行军', 'tt7-stratagem': '法师锦囊', 'tt7-bladebloom': '永恒绽放',
          'tt7-burnharvest': '爆燃火球', 'tt7-twinfireball': '三重火球', 'tt7-meteorstrong': '星陨之力',
          'tt8-hero-warlock': '无极梦魇·血苑修罗', 'tt8-hero-summoner': '神话终章·雷修斯', 'tt8-hero-warrior': '龙吟沧海·关云长',
          'tt8-hero-sealer': '邪渊主宰·妲莉薇特',
        };
        // ①" 定版重写描述（设计者 2026-09-05 定版：妲莉薇特信息按降临者火焰主题重写）
        const CC_DESC = { 'tt8-hero-sealer': '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。' };
        // ② 制作坊自建卡按卡名收编 → 职业（cls 从第七批同名定义反查）
        const CC_CONVERT = ['盗宝', '花瓣法阵', '千变万化', '厄运', '黑暗形态', '充能火球', '火焰形态', '致命射线', '风暴火球'];
        // ④ 退役（未入列旧职业卡 + 印记衍生牌×4；邪渊主宰·妲莉薇特已改归降临者，不再退役）
        const CC_RETIRE = ['tt7-drunksong', 'tt7-livingwater', 'tt7-naturestaff', 'tt7-darkfort',
          'tt7-arcanescroll', 'tt7-talisman', 'tt7-ironcharge', 'tt7-bloodthirst', 'tt7-maxsupply',
          'tt7-imitate', 'tt7-bloodblade', 'tt8-healplus', 'tt8-energycap',
          'tt8-nofocus', 'tt8-curseimmune'];
        const defByName = {};
        SDT.Cards.TABLETOP7.forEach(d => { if (d.cls) defByName[d.name] = d; });
        let dirty = false;
        // ① 按 id 改归属 / 更名 / 统一职业卡形态
        cards.forEach(c => {
          const cls = CC_REASSIGN[c.id];
          if (cls) {
            if (c.cls !== cls) { c.cls = cls; dirty = true; }
            if (c.rarity !== '职业') { c.rarity = '职业'; dirty = true; }
            if (!c.unrandom) { c.unrandom = true; dirty = true; }
          }
          const heroCls = CC_HERO_REASSIGN[c.id];
          if (heroCls && c.cls !== heroCls) { c.cls = heroCls; dirty = true; }
          const name = CC_RENAME[c.id];
          if (name && c.name !== name) { c.name = name; dirty = true; }
          const desc = CC_DESC[c.id];
          if (desc && c.desc !== desc) { c.desc = desc; dirty = true; }
          if (heroCls && !c.hero) { c.hero = true; dirty = true; }
        });
        // ② 按卡名收编制作坊自建职业卡（不覆盖玩家写的效果文本）
        CC_CONVERT.forEach(nm => {
          const def = defByName[nm];
          if (!def) return;
          cards.forEach(c => {
            if (c.name === nm && (c.cls !== def.cls || c.rarity !== '职业' || !c.unrandom)) {
              c.cls = def.cls; c.rarity = '职业'; c.unrandom = true; dirty = true;
            }
          });
        });
        // 江湖救急特例：普通版（tt2-jianghu）保持原样，职业版按「职业稀有度/已有归属」识别收编
        cards.forEach(c => {
          if (c.name === '江湖救急' && c.id !== 'cc-jianghu' && (c.rarity === '职业' || c.cls) && c.cls !== '侠客') {
            c.cls = '侠客'; c.rarity = '职业'; c.unrandom = true; dirty = true;
          }
        });
        // ③ 补种整合新增卡（cc- 前缀定义在 TABLETOP7/8）；
        //    撤下 v1 曾补种的占位英雄「九尾焚天·妲」（cc-heroda，定版由妲莉薇特顶替）
        const ccDefs = SDT.Cards.TABLETOP7.concat(SDT.Cards.TABLETOP8).filter(d => String(d.id || '').startsWith('cc-'));
        ccDefs.forEach(d => {
          if (!cards.some(x => x.id === d.id || (x.name === d.name && x.cls === d.cls))) {
            cards.push({ ...d }); dirty = true;
          }
        });
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].id === 'cc-heroda') { cards.splice(i, 1); dirty = true; }
        }
        // ④ 退役未入列卡 + 兜底清理一切残留旧职业归属
        cards.forEach(c => {
          if (CC_RETIRE.includes(c.id) && c.cls) { delete c.cls; dirty = true; }
          if (c.cls && !CC_CLASSES.includes(c.cls)) { delete c.cls; dirty = true; }
        });
        if (dirty) SDT.Cards.saveAll(cards);
        localStorage.setItem(CC_KEY, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 英雄卡查询（第八批）：heroOf(职业) 返回该职业的英雄卡；
    // 2026-09-05 职业整合后每职业 1-3 张英雄卡，随机抽 1 张（如侠客：妄/云阳/云风）
    heroOf(cls) {
      const heroes = SDT.Cards.all().filter(c => c.hero && c.cls === cls);
      return heroes.length ? heroes[Math.floor(Random.random('card') * heroes.length)] : null;
    },

    // 英雄卡字段回填：早期制作坊保存会丢掉 cls/hero，导致专属立绘与 heroOf 失效。
    // 只按 id 补缺失的 cls / hero / tokenOf / unrandom，不覆盖玩家改过的名字与描述。
    // 另：任何 hero:true 但缺 cls 的卡（如旧对局存档里的副本来源），按 id/名称从英雄卡定义表回填。
    ensureHeroFields() {
      try {
        const defs = SDT.Cards.TABLETOP8;
        const cards = SDT.Cards.all();
        let dirty = false;
        for (const c of cards) {
          if (!/^tt8-/.test(String(c.id || ''))) {
            // 非 tt8 id 的英雄卡：按 id / 名称找回职业归属
            if (c.hero && !c.cls) {
              const def = defs.find(d => d.hero && d.cls && (d.id === c.id || d.name === c.name));
              if (def) { c.cls = def.cls; dirty = true; }
            }
            continue;
          }
          const def = defs.find(d => d.id === c.id);
          if (!def) continue;
          if (def.cls && !c.cls) { c.cls = def.cls; dirty = true; }
          if (def.hero && !c.hero) { c.hero = true; dirty = true; }
          if (def.tokenOf && !c.tokenOf) { c.tokenOf = def.tokenOf; dirty = true; }
          if (def.unrandom && !c.unrandom) { c.unrandom = true; dirty = true; }
        }
        if (dirty) SDT.Cards.saveAll(cards);
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },
  };

export { KEY };
