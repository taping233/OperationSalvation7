/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
import { Random } from './random.js';
import { characterName } from './characters.js';
import { cardHTML, cardBackHTML } from './cards.view.js';
import { DATA } from './data-loader.js';

/* ============================================================
 * 搜打撤 v0.8 —— 卡牌系统数据（localStorage 持久化）
 *
 * 卡牌要素（开发者可在"卡牌制作坊"里自行设计）：
 *   id      自动生成
 *   name    名称
 *   cost    费用：0 ~ 5 费（桌游手绘卡最高 5 费，如「狙击」）
 *   rarity  稀有度：初始 / 古朴 / 稀有 / 史诗 / 传说 / 衍生 / 职业 / 棱彩
 *           （2026-09-04 定版：衍生（tokenOf）展示与计价继承创造者稀有度；
 *            能力卡（hero）及其衍生牌按「棱彩」展示——渐变棱彩流转边框，传说英雄金光变体；
 *            宝石配色：古朴白 / 稀有蓝 / 史诗紫 / 传说金，见 base.css rv*） / 职业
 *           （职业稀有度，设计者 2026-09-04 定版：卡面棱形宝石为黑色；
 *           职业卡牌不能被发现或随机获取到，除非明确表示是从职业卡池中获取
 *           —— 即只经 classPool / randomClassCard 发放；2026-09-05 职业整合定版：
 *           5 职业（侠客/战士/牧师/法师/降临者），每职业 10-12 张职业卡，
 *           不同职业不互通，归属总表见 docs/class-consolidation.md）
 *   type    类型：武术 / 法术 / 生物 / 道具 / 装备 / 事件 / 能力卡 / 资源
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
  let _cardsCache = null;   // all() 的内存缓存，见 all() 处注释
  // 桌游道具卡播种记录：每批一个标记，只播一次，之后删改都尊重玩家
  // 第二/三批按高清照片重辨修订后换用新版本标记：老浏览器重播一次，按 id 覆盖旧识别
  const TT2_KEY_V3 = 'sdt-cards-tt2-v3-seeded';  // v3：第五批照片精修武术描述
  const TT1_KEY_V6 = 'sdt-cards-tt1-v6-seeded';  // v6：资源标注重拍照片——第一批改为资源类型、木材/木化拆分、经济卡包可出售
  const TT4_KEY_V2 = 'sdt-cards-tt4-v2-seeded';  // v2：第四批补入「木化」（与「木材」是两张卡）
  const TT3_KEY_V5 = 'sdt-cards-tt3-v5-seeded';  // v5：传说卡系列照片——8 张已有卡升传说/重辨修订并锁定随机获取
  const TT5_KEY = 'sdt-cards-tt5-seeded';        // 第五批：传说新设计银河之旅（大法师的权杖已随 RETIRE_TT11 退役删除定义）
  const TT6_KEY = 'sdt-cards-tt6-seeded';        // 第六批：事件卡（只能经事件格触发，背包记录）
  const TT7_KEY = 'sdt-cards-tt7-seeded';        // 第七批：职业卡（开局二选一职业，不进随机池）
  const TT7_KEY_V2 = 'sdt-cards-tt7-v2-seeded';  // v2：职业稀有度定版——44 张职业卡 rarity 统一改「职业」（只改稀有度，不动玩家改过的名字与描述）
  const TT8_KEY = 'sdt-cards-tt8-seeded';        // 第八批：能力卡及衍生牌（原类型「英雄卡」，2026-09-08 定版更名「能力卡」；每职业 1 英雄，衍生牌围绕英雄效果）
  const TT9_KEY = 'sdt-cards-tt9-seeded';        // 第九批：生物图鉴（全部敌人信息录入，类型「生物」）
  const TT10_KEY = 'sdt-cards-tt10-v2-seeded';   // 第十批：设计者实机定版同步（2026-09-07 双向合并）；v2：清掉合并残留的错误词条（能力卡 armor:5 等）并重播覆盖一次
  const TT11_KEY = 'sdt-cards-tt11-v5-seeded';   // 第十一批：与设计者实机卡库导出完全对齐（2026-09-09 老板拍板，见 TABLETOP11 注释）；v2：法力补给补 cls=法师（白塔专属）；v3：不变应万变补 cls=侠客（无专属，老板 2026-09-12 拍板）；v4：恶魔之力补 cls=牧师（星月专属，老板 2026-09-13 拍板）；v5：恶魔之力 tt7-drunksong 整卡退役（老板 2026-09-13 改拍板删除，同名双版收口只留 cc-demon）——均换 key 重播让旧档拿到
  const ITEM_RENAME_KEY = 'sdt-cards-item-renames-v1'; // 2026-09-08：道具定名 + 金创药/金疮药合并
  const EVENTS_0919_KEY = 'sdt-events-0919-v1-seeded'; // 2026-09-19：都市污染事件池（10 旧事件改名 + 9 新事件）
  // 第十批退役：同设计重复 id（设计者实机已把同名卡定版在旧 id 上，见 TABLETOP10 尾部注释）
  const RETIRE_TT10 = ['tt3-freeze', 'tt3-flame-potion', 'tt3-toxic-potion', 'tt3-bleed-potion'];
  // 第十一批退役（2026-09-09 对齐设计者实机）：仓库独有、设计者实机没有的 39 张。
  // 含 12 张 cc-* 职业整合卡（设计者稿用 cmtn*/tt7 旧 id 版本）与新手卡新兵操典/制式口粮；
  // 新兵操典无固定 id（种子不带 id，制作坊式生成），由 ensureTabletopSync11() 按名字清理。
  const RETIRE_TT11 = ['starter-ration', 'tt2-pouch', 'tt2-greenarrow', 'tt3-pindown', 'tt3-hop-strike',
    'tt3-plate', 'tt3-ice-arrow', 'tt3-heal-potion', 'tt3-fish-out', 'tt3-arcane-wisdom', 'tt3-fate-potion',
    'tt3-shadow-clone', 'tt3-blood-feast', 'tt3-resurrect', 'tt3-windchaser', 'tt3-snipe', 'tt3-copy-potion',
    'tt3sp-mysticsummon', 'tt3sp-poisonfog', 'tt3sp-search', 'tt3sp-rageoil', 'tt3sp-cursewave',
    'tt3-galaxy-mirage', 'tt3-turtle', 'tt3-mana-blood', 'tt5-archstaff',
    'cc-treasure', 'cc-petal', 'cc-holysrc', 'cc-manasupply', 'cc-thousand', 'cc-doom', 'cc-darkform',
    'cc-chargefb', 'cc-flameform', 'cc-deathray', 'cc-stormfb', 'cc-jianghu',
    'tt7-drunksong']; // 2026-09-13 老板拍板删除：恶魔之力同名双版收口只留 cc-demon
  const CC_KEY = 'sdt-cards-cc3-seeded';         // 职业整合迁移（2026-09-05 定版）：11 职业 → 5 职业，逐卡改归属；v2：邪渊主宰·妲莉薇特改归降临者并撤下「九尾焚天·妲」占位卡；v3：奥术残卷归法师、黑暗吊坠归降临者（2026-09-09 老板拍板收编）

  // 职业表（2026-09-05 设计者定版职业整合：原 11 职业 → 5 职业，每职业 10-12 张职业卡，
  // 不同职业不互通——cls 字段挂在每张职业卡上，classPool 按 cls 严格隔离）：
  //   侠客（← 刺客/剑客/游侠）· 战士（← 战士/守卫）· 牧师（← 牧师/授印者/术士）
  //   法师（← 法师/召唤师）· 降临者（← 降临者/授印者）
  // 整合明细与逐卡归属见 docs/class-consolidation.md；实机卡库迁移见 ensureClassConsolidation()。
  const CLASSES = ['侠客', '战士', '牧师', '法师', '降临者'];

  SDT.Cards = {
    // 2026-09-04 定版增补：稀有度新增「棱彩」（能力卡及其衍生牌专属，rv7/渐变棱彩）；
    // 稀有稀有度宝石改为蓝色（原黑色，见 base.css rv2）。
    RARITIES: ['初始', '古朴', '稀有', '史诗', '传说', '衍生', '职业', '棱彩'],
    // 类型新增「生物」（2026-09-04 定版：敌人图鉴卡，与武术/法术等并列；无法打出）
    TYPES: ['武术', '法术', '生物', '道具', '装备', '事件', '能力卡', '资源'],
    TYPE_ICON: { '武术': '[[icon:swords]]', '法术': '[[icon:sparkles]]', '生物': '[[icon:paw]]', '道具': '[[icon:flask]]', '装备': '[[icon:shield]]', '事件': '[[icon:question]]', '能力卡': '[[icon:helmet]]', '资源': '[[icon:wood]]' },
    // 类型到位图图标名（卡面插画与页签用；TYPE_ICON 保留给纯文本场景）
    TYPE_ART: { '武术': 'swords', '法术': 'sparkles', '生物': 'paw', '道具': 'flask', '装备': 'shield', '事件': 'question', '能力卡': 'helmet', '资源': 'wood' },
    EVENTS_0919: [
      { id: 'tt6-demondeal', name: '隧道血契', cost: 0, rarity: '衍生', type: '事件', desc: '-5 血，获得 1 个大宝箱。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-bandits', name: '暴雨劫道', cost: 0, rarity: '衍生', type: '事件', battle: true, desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-mystery', name: '实验室余粮', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，+2 币。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-goldmine', name: '塌方采掘点', cost: 0, rarity: '衍生', type: '事件', desc: '稳妥取走 3 币，或冒险深挖获得 6 币并损失 3 血。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-goldhammer', name: '满电动力锤', cost: 0, rarity: '衍生', type: '事件', desc: '获得卡牌「闪金之锤」。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-relief', name: '临时救护站', cost: 0, rarity: '衍生', type: '事件', desc: '回复 6 点生命。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-airdrop', name: '污染空投箱', cost: 0, rarity: '衍生', type: '事件', desc: '从木材、口粮、能量饮料、随机药水中选择一项。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-chestdraw', name: '熔断双箱', cost: 0, rarity: '衍生', type: '事件', desc: '从小型与密封物资箱中选择 1 个开启。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-systemsupply', name: '末班配送无人机', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片和木材卡 ×1。', value: 0, sellable: false, unrandom: true },
      { id: 'cmtn7qttxqo4', name: '巷口修鞋匠', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片；复原 1 张卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-vital', name: '高压急救', cost: 0, rarity: '衍生', type: '事件', desc: '生命上限 +3，并回复 3 点生命。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-pearlbox', name: '遗落的珍珠匣', cost: 0, rarity: '衍生', type: '事件', desc: '获得卡牌「珍珠盒」。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-fireballs', name: '双焰走私', cost: 0, rarity: '衍生', type: '事件', desc: '获得两张「火球」。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-classchest', name: '黑箱调拨', cost: 0, rarity: '衍生', type: '事件', desc: '获得 1 个职业·密封物资箱。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-recode', name: '故障重编', cost: 0, rarity: '衍生', type: '事件', desc: '选择 2 张招式或装备卡，随机变为同稀有度、同类型的卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-potions', name: '避难市集药摊', cost: 0, rarity: '衍生', type: '事件', desc: '从 3 瓶随机药水中选择 1 瓶获得。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-arrows', name: '海堤箭库', cost: 0, rarity: '衍生', type: '事件', desc: '获得 2 张随机非职业箭系列卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-gamble', name: '地下商场黑市', cost: 0, rarity: '衍生', type: '事件', desc: '每次投入 3 币，50% 获得预览的 1 张装备和 2 张招式；第 5 次必定成功，可随时放弃。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-quartermaster', name: '装备征用令', cost: 0, rarity: '衍生', type: '事件', desc: '花费 3 币，从 3 张随机装备卡中选择 1 张获得。', value: 0, sellable: false, unrandom: true },
    ],
    // 拥有伤害词条（红色伤害宝石）的类型
    DMG_TYPES: ['武术', '法术'],

    // 无能量消耗的类型（2026-09-08 老板定版）：道具/生物/资源/装备/事件不耗能量，
    // 在背包与宝箱等界面展示时隐去左上角费用角标（卡牌库中仍显示，见 cardHTML 第 3 参 opts.hideCost）
    NO_COST_TYPES: ['道具', '生物', '资源', '装备', '事件'],

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
    // 同稀有度同价：古朴 2 / 稀有 3 / 史诗 4 / 传说 5 / 棱彩（能力卡）8）
    PRICE: { '初始': 1, '古朴': 2, '稀有': 3, '史诗': 4, '传说': 5, '棱彩': 8 },
    // 商店随机槽位的稀有度权重（2026-09-08 定版：与宝箱爆率同源，百分比即权重）
    SHOP_WEIGHTS: { '古朴': 60, '稀有': 28, '史诗': 9, '传说': 3 },

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
    CLASSES,
    classPool(cls) {
      return SDT.Cards.all().filter(c => c.cls === cls);
    },
    // 随机发放职业卡（开局选职业 / 火堆 / 事件）：只从「职业」稀有度卡中取，
    // 不含能力卡与衍生牌——能力卡只能走 事件拼凑/祭坛弃牌/员工通行证A 三种途径
    randomClassCard(cls) {
      const base = cls ? this.classPool(cls) : SDT.Cards.all().filter(c => c.cls);
      const pool = base.filter(c => c.rarity === '职业' && !c.hero);
      return pool.length ? pool[Math.floor(Random.random('card') * pool.length)] : null;
    },

    // 内置初始牌「初始攻击」：每局开始固定携带 5 张（同名堆叠只占 1 格背包）。
    // 1 费 · 攻（+0）＝ 伤害等同于攻击力（combat.js：攻击伤害 = 卡面值 + 攻击力）
    SHA: {
      id: 'starter-attack', name: '初始攻击', cost: 1,
      rarity: '初始', type: '武术', dmg: 0, dmgType: 'attack',
      desc: '攻（+0）：造成等同于攻击力的伤害。',
    },

    // 稀有度初始缺失时自动补入的新手卡（可在卡牌库里编辑/删除）
    STARTERS: [
      { id: 'starter-emergency-bandage', name: '应急绷带', cost: 0, rarity: '初始', type: '道具', dmg: 0, desc: '回复 2 点生命。' },
    ],

    // 桌游手绘道具卡（2026-09-01 照片提取，17 张 → 15 种：
    // 银币 ×2、铜币 ×2 为重复/同卡备注，各保留一种设计）。
    // 资源标注重拍照片后：钥匙/口粮/木材系/经济卡包按卡面「资源·N币」标注
    // 改为资源类型（设计者规则：未标注类型的卡牌均为资源）；
    // 急救合剂/金疮药/能源结晶/金银铜币/员工通行证仍为道具（药水与通行证可在背包直接使用）。
    TABLETOP: [
      // —— 第一排 ——
      { id: 'tt-medneedle',  name: '急救合剂', cost: 1, rarity: '古朴', type: '道具', desc: '回复 16 点生命。', value: 4 },
      { id: 'tt-copper',     name: '铜币',     cost: 0, rarity: '初始', type: '道具', desc: '高价值，可出售。', value: 3, unrandom: true }, // 2026-09-13 老板拍板：经济牌退出商店/发现池，堵买低卖高套利
      { id: 'tt-keys-bunch', name: '一串钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×2。', value: 4 },
      { id: 'tt-rations',    name: '口粮',     cost: 0, rarity: '初始', type: '资源', desc: '升级宠物。', value: 3 },
      { id: 'tt-token-color', name: '员工通行证A', cost: 2, rarity: '史诗', type: '道具', desc: '觉醒。', value: 8 },
      // —— 第二排 ——
      { id: 'tt-gold',       name: '金币',     cost: 0, rarity: '史诗', type: '道具', desc: '贵重货币，可出售。', value: 9, unrandom: true },
      { id: 'tt-econpack',   name: '经济卡包', cost: 2, rarity: '传说', type: '资源', desc: '带入战场时，以 5 张随机卡牌开局。可出售。', value: 10, sellable: true, unrandom: true }, // 资源标注重拍：卡面明确「可出售 10币」
      { id: 'tt-silver',     name: '银币',     cost: 0, rarity: '古朴', type: '道具', desc: '可出售。', value: 6, unrandom: true },
      { id: 'tt-key',        name: '钥匙',     cost: 0, rarity: '初始', type: '资源', desc: '解锁神秘宝箱。', value: 2 },
      // —— 第三排 ——
      { id: 'tt-crystal',    name: '能源结晶', cost: 1, rarity: '古朴', type: '道具', desc: '复活最多 3 张卡牌。', value: 3 },
      { id: 'tt-key-one',    name: '一把钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×3。', value: 6 },
      { id: 'tt-token-gold', name: '员工通行证B', cost: 1, rarity: '稀有', type: '道具', desc: '抽取 1 张传说卡。', value: 5 }, // 照片重辨：手写为「传说卡」（[[icon:crystal]]传），非「传统卡」
      { id: 'tt-jinchuangyao', name: '金疮药', cost: 1, rarity: '古朴', type: '道具', desc: '回复 10 点生命。', value: 3 },
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
      { id: 'tt3-venom-arrow',   name: '毒箭',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加中毒。' },
      { id: 'tt3-toxin',         name: '毒药',     cost: 0, rarity: '初始', type: '武术', desc: '附加 1 层中毒。' },
      { id: 'tt3-frostfall',     name: '剑落纷霜', cost: 2, rarity: '传说', type: '武术', dmg: 5, dmgType: 'attack', desc: '攻5，破坏敌方手牌中 1 张武术。', value: 5 }, // 传说系列重拍：首张照片，效果修订（旧读「破坏冰阵」）
      // —— 武术（本摞照片重辨补录 1 张）——
      { id: 'tt3wu-shike',       name: '割蚀',     cost: 2, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，附加流血。' },
      // —— 法术 / 药水（第一摞 28 张）——
      { id: 'tt3-mystery-potion', name: '神秘药水', cost: 3, rarity: '古朴', type: '道具', desc: '随机神秘效果。', value: 2 },
      { id: 'tt3-blue-potion',   name: '蓝瓶药水', cost: 3, rarity: '古朴', type: '道具', desc: '回复 3 点生命，抽 1 张牌。', value: 2 },
      { id: 'tt3-treasure-hunt', name: '寻宝',     cost: 2, rarity: '古朴', type: '法术', desc: "3′，发现 1 张牌。" },
      { id: 'tt3-flame-storm',   name: '火焰风暴', cost: 3, rarity: '稀有', type: '法术', dmg: 3, desc: '对全体敌人造成 3 点伤害。', value: 3 },
      { id: 'tt3-nature-form',   name: '自然升华', cost: 4, rarity: '稀有', type: '法术', desc: '本场战斗中，能量上限 +1。' },
      { id: 'tt3-python-potion', name: '巨蟒药水', cost: 2, rarity: '古朴', type: '道具', desc: '召唤巨蟒助战。', value: 2 },
      { id: 'tt3-chain-lightning', name: '闪电链', cost: 2, rarity: '古朴', type: '法术', desc: "3′，2 段伤害。" },
      { id: 'tt3-houyi-potion',  name: '后羿药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合攻击 +2。', value: 2 },
      { id: 'tt3-fireball',      name: '火球',     cost: 2, rarity: '衍生', type: '法术', dmg: 4, unrandom: true, desc: '造成 4 点伤害（4′）。' }, // 衍生牌（2026-09-16 留言「把火球设定成衍生」）：不再每局携带，仅由三重火球等效果生成；不随机掉落/发现/上架
      { id: 'tt3-holy-water',    name: '圣水',     cost: 2, rarity: '古朴', type: '法术', desc: '回复 4 点生命，净化负面效果。', value: 2 },
      { id: 'tt3-skewer',        name: '穿刺',     cost: 2, rarity: '古朴', type: '法术', dmg: 2, desc: '造成 2 点伤害，无视护甲。', value: 3 },
      { id: 'tt3-holy-shield',   name: '圣盾',     cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '获得 5 点护甲。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3-iceheart-potion', name: '冰心药水', cost: 2, rarity: '古朴', type: '道具', desc: '免疫冰冻，回复 3 点生命。', value: 2 },
      { id: 'tt3-demon-potion',  name: '魔化药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合法术伤害 +2。', value: 2 },
      { id: 'tt3-nuke-ray',      name: '核爆射线', cost: 2, rarity: '史诗', type: '法术', dmg: 4, desc: '造成 4 点伤害。', value: 4 },
      { id: 'tt3-petal',         name: '花瓣',     cost: 2, rarity: '稀有', type: '法术', desc: '每回合结束回复 2 点生命。', value: 4 },
      // —— 法术 / 药水（第二摞补 11 张）——
      { id: 'tt3-magic-lamp',    name: '神灯',     cost: 4, rarity: '古朴', type: '法术', desc: '抉择：1° 发现 1 张牌并释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，+5 甲。' },
      { id: 'tt3-thornfield',    name: '棘刺之地', cost: 3, rarity: '古朴', type: '法术', desc: '对所有敌人附加 1 层中毒，+1 甲。' },
      { id: 'tt3-mind-potion',   name: '精神药水', cost: 2, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', value: 4 },
      { id: 'tt3-turnabout-potion', name: '转势药水', cost: 1, rarity: '稀有', type: '道具', desc: '使所有敌人附加陷阱牌。', value: 3 },
      { id: 'tt3-firm-barrier',  name: '坚冰结界', cost: 4, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '延长 1 名角色的冰冻 1 回合。（手绘卡左上角注 free）' }, // 2026-09-05 职业整合：原地转为法师职业卡
      { id: 'tt3-ice-spike',     name: '冰刺',     cost: 2, rarity: '古朴', type: '法术', desc: "1′，附加冰冻。" },
      { id: 'tt3-grope',         name: '摸索',     cost: 1, rarity: '古朴', type: '法术', desc: '抽 2 张牌。', value: 3 },
      { id: 'tt3-mixed-potion',  name: '混血药水', cost: 1, rarity: '古朴', type: '道具', desc: '造成 2 点伤害，附加流血。', value: 2 },
      // —— 法术（重辨补录 15 张：此前未入库的同摞卡）——
      { id: 'tt3sp-dodge',        name: '闪避',     cost: 2, rarity: '古朴', type: '法术', desc: '应对攻击时：避开 1 段伤害。' },
      { id: 'tt3sp-devour',       name: '吞噬',     cost: 3, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '消灭 1 名 4 级及以下小怪。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3sp-doom',         name: '毁灭',     cost: 3, rarity: '史诗', type: '法术', desc: '消灭 2 名 5 级及以下小怪，不可复原。' },
      { id: 'tt3sp-silverthorn',  name: '银刺',     cost: 2, rarity: '古朴', type: '法术', desc: "5′；注能(小)：改为 8′。" },
      { id: 'tt3sp-magicoil',     name: '魔法药水', cost: 2, rarity: '古朴', type: '法术', desc: "限定：1′，抽 1 张牌。" },
      { id: 'tt3sp-shadowbug',    name: '影蛊',     cost: 3, rarity: '古朴', type: '法术', desc: '本回合偷取 1 名敌人的攻击。' },
      { id: 'tt3sp-flowerzhen',   name: '花鸩',     cost: 4, rarity: '古朴', type: '法术', desc: '使 1 名角色中毒层数效果翻倍。' },
      { id: 'tt3sp-bloodstorm',   name: '血腥风暴', cost: 4, rarity: '稀有', type: '法术', desc: "3′，吸血，对敌方全体；注能(2)：额外施放 1 段。" },
      { id: 'tt3sp-shadowshot',   name: '暗影射击', cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "3′，若对手处于诅咒状态，额外施放 1 次。", value: 2 }, // 2026-09-05 职业整合：原地转为降临者职业卡
      // —— 杂项（第三摞 9 张：高费大招与宝物）——
      { id: 'tt3-thunderblast',  name: '雷殛',     cost: 3, rarity: '传说', type: '法术', dmg: 7, dmgType: 'spell', desc: "7′，墓地指定 1 张牌，伤害 +1。", value: 5 }, // 传说系列重拍：desc 重辨（原文疑「蓄地槽…」），机制沿旧读「从墓地指定」
      { id: 'tt3-flux-slash',    name: '流光斩',   cost: 2, rarity: '传说', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻1，附加 2 层流血；将流光斩复制放入牌库。', value: 5 }, // 传说系列重拍：改武术、攻1、复制入牌库（原文「流光照影放入牌库」重辨存疑）
      { id: 'tt3-immortal-blade', name: '不朽神剑', cost: 2, rarity: '传说', type: '装备', desc: '对战开始时，你的攻击化为 1 张不朽斩。', value: 5 }, // 传说系列重拍：效果按本批照片重写
      { id: 'tt3-diamond',       name: '钻石',     cost: 0, rarity: '传说', type: '资源', desc: '贵重货币，可出售。', value: 16, unrandom: true },
      { id: 'tt3-master-staff',  name: '大师的神杖', cost: 2, rarity: '稀有', type: '道具', desc: '回合开始时回复 5 点生命。', value: 5 },
      { id: 'tt3-chaos-eye',     name: '混沌之眼', cost: 1, rarity: '传说', type: '装备', desc: '装备：血量上限 +10，牌库上限 5。', value: 5 }, // 传说系列重拍：卡名/效果按本批照片（旧读「混沌眼」「生命上限+10」）
      { id: 'tt3-execute',       name: '斩杀',     cost: 3, rarity: '传说', type: '武术', dmg: 9, dmgType: 'spell', desc: "对 9 血以下角色造成 9′。", value: 5 }, // 传说系列重拍：角标武术、阈值 9 血
      { id: 'tt3-savior-elixir', name: '斗神酒', cost: 0, rarity: '传说', type: '道具', desc: '回复 99 点生命（相当于回满）。', value: 5 },
      // —— 装备（武器/防具/符印一摞；角标与描述已按第四批高清照片逐张重辨修正，
      //     未在本摞照片中出现的条目（魔纹银剑/深红丝袋/圣杖/玄龟/草甲/逆弓/聚魔之血/深衍日记）保持原样）——
      { id: 'tt3-silver-runesword', name: '魔纹银剑', cost: 2, rarity: '稀有', type: '装备', desc: '装备：攻击 +3。', value: 3 },
      { id: 'tt3-azure-sword',  name: '百炼青虹剑', cost: 2, rarity: '稀有', type: '装备', desc: '消耗时 +4 甲，将其置于牌库底。' },
      { id: 'tt3-deep-seal',    name: '深解印记', cost: 4, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。' },
      { id: 'tt3-fate-wheel',   name: '命运钟表', cost: 4, rarity: '史诗', type: '装备', desc: '限定：弃掉所有手牌，获得 1 个额外回合。' },
      { id: 'tt3-crimson-pouch', name: '深红丝袋', cost: 2, rarity: '稀有', type: '装备', desc: '装备：可复制你装备的 1 张牌。', value: 4 },
      { id: 'tt3-holy-staff',   name: '圣杖',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：消耗能量进入法阵。', value: 3 },
      { id: 'tt3-staff',        name: '法杖',     cost: 2, rarity: '古朴', type: '装备', desc: '法伤 +1。' },
      // 灭魔之剑 tt3-dark-blade 已整卡退役（2026-09-16 留言「删除灭魔之剑」，cards-sync v24 retire 清旧档）
      { id: 'tt3-wolf-bow',     name: '天狼长弓', cost: 2, rarity: '稀有', type: '装备', desc: '回合开始时，舍弃 1 张牌并抽 1 张牌。' },
      { id: 'tt3-sapper-bomb',  name: '石工炸药', cost: 2, rarity: '古朴', type: '装备', desc: '消耗时，造成 4 点伤害。' },
      { id: 'tt3-twinwater-mail', name: '二水甲', cost: 2, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+1 甲。' },
      { id: 'tt3-grass-armor',  name: '草甲',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：装备时回复 2 点生命。', value: 2 },
      { id: 'tt3-blooddrinker', name: '饮血剑',   cost: 2, rarity: '古朴', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 攻。' },
      { id: 'tt3-longsword',    name: '长剑',     cost: 2, rarity: '初始', type: '装备', desc: '+1 攻。' },
      { id: 'tt3-element-seal', name: '元素符印', cost: 4, rarity: '稀有', type: '装备', desc: '注能 2 张法术牌后解锁：法伤 +2，抽 2 张牌。' },
      { id: 'tt3-light-mail',   name: '轻甲',     cost: 2, rarity: '古朴', type: '装备', desc: '+5 血。' },
      { id: 'tt3-reverse-bow',  name: '逆弓',     cost: 2, rarity: '古朴', type: '装备', desc: '装备：对方行动时，将 2 张手牌换新。', value: 2 },
      { id: 'tt3-deep-diary',   name: '深衍日记', cost: 1, rarity: '古朴', type: '装备', desc: '装备：记载深处的秘密。', value: 3 },
      // —— 装备（第四批照片重辨补录 2 张：此前未入库）——
      { id: 'tt3eq-boiler',     name: '魔法锅炉', cost: 3, rarity: '古朴', type: '装备', desc: '限定：消耗至多 2 张牌，发现等量随机卡牌。' },
      { id: 'tt3eq-mistbox',    name: '迷之匣',   cost: 2, rarity: '古朴', type: '装备', desc: '对战开始时，将 2 张攻替换为随机卡牌。' },
      // —— 资源（散卡 3 张）——
      { id: 'tt3-garnet-marble', name: '石榴石弹珠', cost: 0, rarity: '古朴', type: '资源', desc: '漂亮的小玩意，可出售。', value: 4, unrandom: true }, // 2026-09-13 老板拍板：卖价 3→4，并退出商店/发现池
      { id: 'tt3-wood-bundle',  name: '一捆木材', cost: 0, rarity: '稀有', type: '资源', desc: '木材 ×3。', value: 6 },
      { id: 'tt3-ration-double', name: '双份口粮', cost: 0, rarity: '稀有', type: '资源', desc: '口粮 ×2。', value: 6 },
    ],

    // 桌游手绘卡 · 第四批（2026-09-01 照片提取，15 张）：
    // 13 张与第一批同设计（员工通行证B ×2、银币 ×2、铜币 ×3 含「高价值」1 张、
    // 员工通行证A、能源结晶、金疮药、急救合剂、金币），不再重复入库；高清照片同时
    // 修正第一批「员工通行证B传说卡」识别。播本批新设计 3 张：员工通行证C、烟雾弹，
    // 以及「木化」——资源标注重拍照片证实它是独立药水卡（回复 6 血、物品·2币），
    // 此前被误并入「木材」，已在第一批拆分还原。
    // 角标「[[icon:crystal]] 字」多数取卡名/效果用字（彩/木/水/金/传），唯烟雾弹 [[icon:crystal]]稀 与效果
    // 无关，按稀有度「稀有」解读。
    TABLETOP4: [
      { id: 'tt4-shine-token', name: '员工通行证C', cost: 2, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', value: 7 },
      { id: 'tt4-smoke-bomb',  name: '烟雾弹',   cost: 1, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', value: 3 },
      { id: 'tt4-woodify',     name: '能量饮料', cost: 0, rarity: '初始', type: '道具', desc: '回复 6 点生命。', value: 2 },
    ],

    // 桌游手绘卡 · 第五批（2026-09-01「传说卡」照片，10 张）：
    // 全批为传说特例卡——非常强力，unrandom: true 锁死随机与发现获取
    // （含商店随机槽位；「员工通行证C：发现 1 张传说卡」同样发现不到它们）。
    // 照片中另 8 张为已有卡重拍：斩杀/流光斩/剑落纷霜/雷殛/混沌之眼/不朽神剑
    // 已在 TABLETOP3 升传说并按照片修订，斗神酒/钻石仅补 unrandom 标记。
    TABLETOP5: [
      { id: 'tt5-galaxy-voyage', name: '银河之旅',   cost: 4, rarity: '传说', type: '法术', desc: '本场对战中，你的所有法术均为 1 费。', value: 5 }, // 原文单字「术」，按法术解读
    ],

    // 桌游手绘卡 · 第六批（2026-09-01「事件卡」照片，10 张）：
    // 设计者定版——这一类是事件，只能在棋盘的事件格中触发，无法在背包中使用，
    // 背包里会记录本局触发过哪些事件（game.js 事件格结算 + 背包「事件记录」）。
    // 因此稀有度记为「衍生」（不进商店/随机池），并全部加 unrandom 双保险；
    // 闪金之锤角标 <事件战斗>、盗匪横行含反抗组织拾荒者×5，battle: true 供战斗结算识别。
    // tt6 事件卡与下方桌面区同名同 id 双版并存（微信版 233 张定版口径）——两处描述必须
    // 保持一致（2026-09-19 审计 D-5 对齐），实际结算效果以 game.run.flow eventChoiceSpec V2 为准。
    TABLETOP6: [
      { id: 'tt6-demondeal',   name: '恶魔交易',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '-5血，获得1个大宝箱。' },
      { id: 'tt6-bandits',     name: '盗匪横行',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。' },
      { id: 'tt6-mystery',     name: '神秘补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得员工通行证A碎片，+2 币。' },
      { id: 'tt6-goldmine',    name: '金矿',       cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得 3 币。' },
      { id: 'tt6-goldhammer',  name: '闪金之锤',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '造成 5 点伤害，若斩杀敌人，+2 币。' },
      { id: 'tt6-relief',      name: '爱心救济站', cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '回复 6 血。' },
      { id: 'tt6-airdrop',     name: '空中补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从木材、口粮、能量饮料、随机药水中抽取一项。' },
      { id: 'tt6-chestdraw',   name: '宝箱',       cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从大，中，小宝箱中抽取 1 个。' },
      { id: 'tt6-systemsupply', name: '系统补给',  cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得员工通行证A碎片，木材 ×1。' },
    ],

    // 桌游手绘卡 · 第七批（2026-09-01「职业卡」照片 → 2026-09-05 职业整合定版）：
    // 2026-09-05 设计者定版：原 11 职业 44 张职业卡整合为 5 职业（侠客/战士/牧师/法师/降临者），
    // 每职业 10-12 张职业卡（含本批新增 cc- 前缀整合卡与第三批原地转职的 4 张，全表见
    // docs/class-consolidation.md）；职业卡 rarity 全部为「职业」，unrandom 锁死随机与发现获取
    // ——不同职业不互通，只经 classPool / randomClassCard 按职业发放。
    // 实机卡库的老卡改归属/更名/退役与 cc- 新卡补种由 ensureClassConsolidation() 完成。
    TABLETOP7: [
      // —— 侠客（← 刺客 + 剑客 + 游侠；能力卡：白梅落影·妄 / 天剑诛魔·云阳 / 无量仙剑·云风）——
      { id: 'tt7-throwblade',  name: '飞刃偷袭',   cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 3, dmgType: 'attack', desc: '攻3，附加流血，抽 1 张牌。', value: 3 },
      { id: 'tt7-goldencicada', name: '金蝉脱壳',  cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '弃掉所有手牌，抽 3 张。', value: 4 },
      { id: 'tt7-sneak',       name: '偷袭',       cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1。', value: 3 },
      { id: 'tt7-ghostblade',  name: '鬼魅之刃',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，破隐时伤害 +2，并抽 2 张牌。', value: 3 },
      { id: 'tt7-thundergrudge', name: '快意恩仇', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 0, dmgType: 'attack', desc: '消耗 2 张初始攻击，攻击 3 次。', value: 3 }, // 定版更名（原疾雷恩仇），代价句对齐 battle.core「消耗 N 张杀」结算
      { id: 'tt7-meteorrain',  name: '流星箭雨',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，2 段伤害。', value: 3 },
      { id: 'tt7-stealth',     name: '潜匿',       cost: 1, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '进入潜行状态 1 回合。', value: 4 },
      { id: 'tt7-swordimmortal', name: '剑仙形态', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '对决中，每回合额外抽 1 张。', value: 4 }, // 定版更名（原剑仙附身）
      // —— 战士（← 战士 + 守卫；能力卡：青龙化身 / 圣剑化身，2026-09-13 老板拍板定名，原 龙吟沧海·关云长 / 圣剑誓约·亚瑟）——
      { id: 'cc-unmoved',      name: '不变应万变', cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合所受伤害降为 1，获得 4 点护甲。', value: 3 },
      { id: 'tt7-marchrush',   name: '急行军',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '抽 2 张牌，+4 甲；压制：抽 1 张牌。', value: 3 }, // 定版更名（原急行奔驰）
      { id: 'tt7-bulwark',     name: '坚盾',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合获得 8 点护甲，回合结束 -4 点。', value: 2 },
      { id: 'tt7-armup',       name: '武装',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '从牌库中抽取 1 张装备贮藏。', value: 2 },
      { id: 'tt7-whirlwind',   name: '旋风斩',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，全体攻击。', value: 2 },   // 2026-09-17 留言「旋风斩应为2费」
      { id: 'tt7-demonbreaker', name: '破甲重斩',  cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，附加破甲；击杀则 +4 甲。', value: 3 },
      { id: 'tt7-fullstrike',  name: '全力一击',   cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，抽 1 张牌。', value: 2 },
      { id: 'tt7-ironphalanx', name: '铁甲阵',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '+10 甲，洗入 5 张随机卡牌。', value: 4 },
      { id: 'tt7-bloodpoison', name: '血毒双镖',   cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，附加流血；攻1，附加中毒。', value: 2 },
      // —— 牧师（← 牧师 + 授印者 + 术士；能力卡：浪掷风吟 / 禁术解放，2026-09-13 老板拍板实机定名）——
      // 另有 吞噬（tt3sp-devour）/ 圣盾（tt3-holy-shield）自第三批原地转职为本职业卡
      { id: 'tt7-silence',     name: '禁言术',     cost: 0, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '沉默 1 名角色 1 回合，抽 1 张牌。', value: 2 },
      { id: 'cc-demon',        name: '恶魔之力',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，损失 2 点生命。", value: 3 },
      { id: 'tt7-holyglow',    name: '沐愈光辉',   cost: 4, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '将自身血量回复至 12 血。', value: 3 },
      { id: 'tt7-holyheal',    name: '圣光治愈',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '弃置 1 张牌，回复 2 倍于其费用的血量。', value: 2 },
      { id: 'tt7-provoke',     name: '扰敌',       cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '迫使 2 名敌人斗殴。', value: 2 },
      { id: 'tt7-bloodpotion', name: '噬血术',     cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 3, dmgType: 'spell', desc: "混合：3′，吸血。", value: 3 }, // 定版更名（原噬血药水）
      { id: 'tt7-smite',       name: '惩击',       cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，对血量以下的敌人不能增益。", value: 2 },
      // —— 法师（← 法师 + 召唤师；能力卡：博览者的狂语 / 花开两面，2026-09-13 老板拍板实机定名）——
      // 另有 坚冰结界（tt3-firm-barrier）自第三批原地转职为本职业卡
      { id: 'tt7-arcanebolt',  name: '奥术弹',     cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, dmg: 1, dmgType: 'spell', desc: "1′，抽 1 张牌。", value: 3 },
      { id: 'tt7-energize',    name: '聚能',       cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '能量 +1。', value: 2 },
      { id: 'tt7-frozenight',  name: '冰封千里',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '冰冻所有敌人。', value: 3 },
      { id: 'tt7-stratagem',   name: '法师锦囊',   cost: 1, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '对战开始时拿 3 张牌备用，打牌时选择 1 张施放。', value: 3 }, // 定版更名（原锦囊）
      { id: 'tt7-bladebloom',  name: '永恒绽放',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '发现并施放 1 张牌，获取剩下两张。', value: 4 }, // 定版更名（原利刃绽放）
      { id: 'tt7-recruit',     name: '征召',       cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：召唤骑兵 ×2 冲锋作战。', value: 3 },
      { id: 'tt7-elementstorm', name: '元素风暴',  cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：下一张法术施放 2 次。', value: 4 },
      // —— 降临者（← 降临者 + 授印者；能力卡：九尾焚天·妲 / 楔天玄翼·焚殃）——
      // 另有 暗影射击（tt3sp-shadowshot）自第三批原地转职为本职业卡
      { id: 'tt7-burnharvest', name: '爆燃火球',   cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，受法伤加成翻倍。", value: 3 }, // 定版更名（原燃烧收获）；注能收益已删（ensureCardFixes，2026-09-05）
      { id: 'tt7-twinfireball', name: '三重火球',  cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，可使用 3 次。", value: 4 }, // 定版更名（原双生火球），次数按三重
      { id: 'tt7-abysscurse',  name: '深渊诅咒',   cost: 3, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，附加禁疗；此时对方每有 1 种诅咒，抽 1 张牌。", value: 3 },
      { id: 'tt7-meteorstrong', name: '星陨之力',  cost: 4, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "注能(2)：施放 3 次火球术(4′)。", value: 4 }, // 定版更名（原陨强）
    ],

    // 桌游手绘卡 · 第八批（2026-09-01「英雄卡」照片 → 2026-09-05 职业整合定版；类型 2026-09-08 定版更名「能力卡」）：
    // 能力卡 = 各职业的觉醒形态（角标「职业·觉醒」），type 能力卡、cls 绑定职业、hero: true；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡：
    //   侠客：妄 / 云阳 / 云风 · 战士：青龙化身 / 圣剑化身 · 牧师：浪掷风吟 / 禁术解放（2026-09-13 实机定名）
    //   法师：博览者的狂语 / 花开两面（原召唤师英雄定版更名）· 降临者：邪渊主宰 / 充能火山
    // 原授印者英雄「邪渊主宰」2026-09-05 改归降临者；2026-09-13 实机定名定回「邪渊主宰」
    //（描述按降临者火焰主题重写，卡面立绘随 cls 自动换为降临者）；
    // 其印记衍生牌（治伤+1 等 4 张）未随迁，保留退役。
    // 能力卡本体只能通过 ① 事件拼凑 ② 祭坛弃牌 ③ 员工通行证A 三种途径获得——均不实装为
    // 随机获取，故全部 unrandom（获取途径待后续版本实装）。
    // 衍生牌（角标「衍」/「××专属·衍生」）围绕英雄效果展开：rarity 衍生、
    // tokenOf 指向所属英雄；禁咒×4 由牧师英雄「禁术解放」洗入牌库，
    // 诛魔剑系由侠客英雄「天剑诛魔·云阳」洗入牌库，青龙偃月斩为战士英雄武器。
    // 角标 [[icon:crystal]][[icon:crystal]]/[[icon:crystal]] 照录为稀有/古朴；「5[[icon:coin]]/8[[icon:coin]]」为币值（右下盾形数字同值）。
    TABLETOP8: [
      // —— 能力卡（5 职业 · 11 张）——
      { id: 'tt8-hero-assassin',   name: '白梅落影·妄',       cost: 0, rarity: '稀有', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '潜入夺宝：净化陷阱，潜行 2 回合；破隐一连击开弹幕。', value: 5 }, // 关键词与尾句重辨存疑
      { id: 'tt8-hero-sword',      name: '无量仙剑·云风',     cost: 0, rarity: '稀有', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '万剑归宗：抽 5 张牌，充能 +1。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-hero-ranger',     name: '天剑诛魔·云阳',     cost: 0, rarity: '古朴', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '寂断念：将天启剑与 5 件魔剑洗入牌库。', value: 5 }, // 关键词重辨存疑
      { id: 'tt8-hero-warrior',    name: '青龙化身',   cost: 0, rarity: '稀有', type: '能力卡', cls: '战士', hero: true, unrandom: true, desc: '真龙降世：攻 +2 的青龙偃月斩。', value: 8 },
      { id: 'tt8-hero-guardian',   name: '圣剑化身',     cost: 0, rarity: '古朴', type: '能力卡', cls: '战士', hero: true, unrandom: true, desc: '诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。', value: 8 },
      { id: 'tt8-hero-priest',     name: '浪掷风吟',   cost: 0, rarity: '稀有', type: '能力卡', cls: '牧师', hero: true, unrandom: true, desc: '甘霖降世：置入随机卡牌直至 6 张；每 1 次施法回复 3 血。', value: 5 },
      { id: 'tt8-hero-warlock',    name: '禁术解放', cost: 0, rarity: '稀有', type: '能力卡', cls: '牧师', hero: true, unrandom: true, desc: '无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。', value: 5 }, // 定名 2026-09-13 老板拍板实机名（原 无极梦魇·血苑修罗）
      { id: 'tt8-hero-mage',       name: '博览者的狂语',     cost: 0, rarity: '稀有', type: '能力卡', cls: '法师', hero: true, unrandom: true, desc: '万法乾坤：法伤 +1，回合结束时抽 1 张牌。', value: 5 },
      { id: 'tt8-hero-summoner',   name: '花开两面',   cost: 0, rarity: '稀有', type: '能力卡', cls: '法师', hero: true, unrandom: true, desc: '元素潮汐：打开神界之门。', value: 5 }, // 定名 2026-09-13 老板拍板实机名（原 神话终章·雷修斯）
      { id: 'tt8-hero-sealer',     name: '邪渊主宰', cost: 0, rarity: '稀有', type: '能力卡', cls: '降临者', hero: true, unrandom: true, desc: '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。', value: 5 }, // 定版更名并改归降临者（原授印者英雄「邪渊主宰」）；效果沿用「每消耗 1 张牌施放火球」结算
      { id: 'tt8-hero-descender',  name: '充能火山',     cost: 0, rarity: '古朴', type: '能力卡', cls: '降临者', hero: true, unrandom: true, dmg: 4, dmgType: 'spell', desc: "寂灭苍穹：法伤 +1，每消耗 1 张牌，施放 1 次火球术(4′)。", value: 5 }, // 卡名重辨存疑
      // —— 衍生牌 · 牧师专属（禁术解放洗入牌库的禁咒）——
      { id: 'tt8-curse1', name: '禁咒I',   cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：夺取 1 点攻击力。', value: 5 },
      { id: 'tt8-curse2', name: '禁咒II',  cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：冰冻。', value: 5 },
      { id: 'tt8-curse3', name: '禁咒III', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：中毒，流血。', value: 5 },
      { id: 'tt8-curse4', name: '禁咒IV', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：沉默 1 回合。', value: 5 },
      // —— 衍生牌 · 侠客专属（天剑诛魔·云阳洗入牌库的剑）——
      { id: 'tt8-demonslay',  name: '诛魔剑',     cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时攻击全体敌人；以天启诛魔剑覆盖你的所有武器。', value: 4 },
      { id: 'tt8-archdemon',  name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '攻 +1，手中所有武器牌视为重衍。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-heavensword', name: '天启剑',    cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时额外抽 1 张牌；在你抽到天启剑与 5 件魔剑后……', value: 4 },
      // —— 衍生牌 · 战士（青龙化身的佩刀）——
      { id: 'tt8-dragonblade', name: '青龙偃月斩', cost: 0, rarity: '衍生', type: '武术', cls: '战士', tokenOf: 'tt8-hero-warrior', unrandom: true, dmg: 6, dmgType: 'attack', desc: '攻6，破甲，流血。', value: 8 },
    ],

    // 生物图鉴（第九批，2026-09-04 定版：新卡牌类型「生物」——与武术/法术等并列）。
    // 2026-09-09 老板定版：新世界观命名 + 五层分布（联邦部队 / 反抗组织 / 双阵营能力者 / 变异生物体）。
    // 全部敌人信息录入：数值与 mapData.js monsters / altar.bosses 一一对应
    // （角标「攻-血」即设计者记法，如巨兽「荒渊」7-40）；art 字段指向战场立绘 id。
    // 生物卡是敌人图鉴：unrandom + 衍生稀有度双重排除，不进商店/发现/随机池，
    // 也无法在对战中打出（battle.core unplayableReason）。
    BESTIARY: [
      // —— 第 1 层 外围荒地：联邦巡防 vs 反抗拾荒 ——
      { id: 'foe-infantry',   name: '联邦巡防兵',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'infantry',   desc: '攻击 4 / 生命 4。联邦·第1层。普通近战，行动无特殊之处。' },
      { id: 'foe-archer',     name: '联邦射手',       cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'archer',     desc: '攻击 5 / 生命 3。联邦·第1层。远程攻击。' },
      { id: 'foe-bandit',     name: '反抗组织拾荒者', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'bandit',     desc: '攻击 3 / 生命 3。反抗·第1层。普通近战，成群出现（盗匪横行 ×5）。' },
      // —— 第 2 层 风雪哨线：双方正规部队 ——
      { id: 'foe-cavalry',    name: '联邦机动兵',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'cavalry',    desc: '攻击 5 / 生命 6。联邦·第2层。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-orc_jav',    name: '反抗组织掷弹兵', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_jav',    desc: '攻击 6 / 生命 4。反抗·第2层。远程投掷。' },
      // —— 第 3 层 冻土遗迹：异变初现 ——
      { id: 'foe-wolf_rider', name: '变异雪狼',       cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'wolf_rider', desc: '攻击 7 / 生命 6。变异·第3层。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-orc_axe',    name: '甲壳变异体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_axe',    desc: '攻击 4 / 生命 7。变异·第3层。防御/反击型，隔回合蓄势。' },
      // —— 第 4 层 高危战区：元素异变体 + 双阵营能力者 ——
      { id: 'foe-fire_el',    name: '灼热异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'fire_el',    desc: '攻击 10 / 生命 7。变异·第4层。攻击并灼烧。' },
      { id: 'foe-water_el',   name: '腐蚀异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'water_el',   desc: '攻击 7 / 生命 10。变异·第4层。防御/反击型，隔回合蓄势。' },
      { id: 'foe-esper_crow',   name: '白鸦', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_crow',
        desc: '攻击 8 / 生命 5。联邦能力者·第4层。碎晶齐射：远程多段攻击。' },
      { id: 'foe-esper_candle', name: '烛火', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_candle',
        desc: '攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击并灼烧。' },
      // —— 第 5 层 污染核心：深层异变 + 双阵营能力者 + 巨兽 ——
      { id: 'foe-grass_el',   name: '滋生异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'grass_el',   desc: '攻击 5 / 生命 12。变异·第5层。攻击并施加诅咒。' },
      { id: 'foe-esper_silence', name: '静默', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_silence',
        desc: '攻击 7 / 生命 9。联邦能力者·第5层。声场压制：攻击并施加诅咒。' },
      { id: 'foe-esper_echo',    name: '回声', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_echo',
        desc: '攻击 9 / 生命 7。反抗能力者·第5层。声波叠伤：远程多段攻击。' },
      { id: 'foe-dragon',     name: '巨兽「荒渊」',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'dragon', desc: '攻击 7 / 生命 40。变异·第5层精英。重击/特殊；第一回合蓄力不会攻击。' },
      // —— BOSS（污染核心三首脑）——
      { id: 'foe-boss_general', name: '肃清总督', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_general',
        desc: '攻击 5 / 生命 50。BOSS·联邦。词缀【军威】：每个回合结束时攻击力 +2。' },
      { id: 'foe-boss_orc',   name: '变异巢母',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_orc',
        desc: '攻击 4 / 生命 45。BOSS·变异。词缀【狂乱】：每回合攻击两次，每次附加 1 层流血或中毒。' },
      { id: 'foe-boss_elem',  name: '异能领主',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_elem',
        desc: '攻击 8 / 生命 48。BOSS·能力者。词缀【元素庇幕】：偶数回合减免所有伤害（破甲可克制）。' },
    ],

    // 桌游手绘卡 · 第十批（2026-09-07 设计者实机定版同步）：与设计者实机卡库导出
    // （sdt-cards.json，2026-09 微信接收）双向合并的定版快照，由合并脚本生成：
    //   · 共享 id 卡取设计者精修稿（名字/费用/稀有度/类型/描述/词条/币值），
    //     结构字段（cls/hero/tokenOf）与仓库实现标记（battle/art）保仓库；
    //   · unrandom 随机锁取两侧并集；图鉴 foe-*、寻宝图、员工通行证A、初始火球、
    //     经济卡包、tt6-goldhammer、tt3-* 三张撞名职业卡按仓库定版保留（不在本批）；
    //   · 补种设计者实机有而仓库缺失的卡（流光照影/不朽斩/步兵/两扇门/
    //     灵能召唤/刀剑形态/法力光波）；「初始攻击」名字保持不变（老板 2026-09-07 指定）；
    //   · 同设计改名卡（火焰/冰冻/剧毒/流血药水）定版在设计者旧 id 上，
    //     仓库 09-06 转录用的 tt3-freeze 等四个重复 id 由 ensureTabletopSync() 移除。
    // 覆盖/补种走 ensureTabletopSync()（TT10_KEY 标记，一次性，按 id 整卡覆盖）。
    TABLETOP10: [
      { id: 'starter-attack', name: '初始攻击', cost: 1, rarity: '初始', type: '武术', desc: '攻（+0）：造成等同于攻击力的伤害。', dmg: 0, dmgType: 'attack', value: 1 },
      { id: 'tt-medneedle', name: '急救合剂', cost: 0, rarity: '稀有', type: '道具', desc: '回合开始时：回复 6点生命。持续 3 回合。', dmg: 0, heal: 16, value: 4 },
      { id: 'tt-copper', name: '铜币', cost: 0, rarity: '古朴', type: '资源', desc: '可出售。', dmg: 0, value: 3, sellable: true, unrandom: true },
      { id: 'tt-keys-bunch', name: '一串钥匙', cost: 0, rarity: '稀有', type: '资源', desc: '钥匙 ×2。', dmg: 0, value: 4 },
      { id: 'tt-rations', name: '口粮', cost: 0, rarity: '稀有', type: '资源', desc: '升级宠物。', dmg: 0, value: 3 },
      { id: 'tt-gold', name: '金币', cost: 0, rarity: '史诗', type: '资源', desc: '贵重货币，可出售。', dmg: 0, value: 9, sellable: true, unrandom: true },
      { id: 'tt-silver', name: '银币', cost: 0, rarity: '稀有', type: '资源', desc: '可出售。', dmg: 0, value: 6, sellable: true, unrandom: true },
      { id: 'tt-key', name: '钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '解锁大门。', dmg: 0, value: 2 },
      { id: 'tt-crystal', name: '能源结晶', cost: 0, rarity: '史诗', type: '道具', desc: '在背包中才能使用，复原最多 3 张卡牌。', dmg: 0, value: 3 },
      { id: 'tt-key-one', name: '一把钥匙', cost: 0, rarity: '史诗', type: '资源', desc: '钥匙 ×3。', dmg: 0, value: 6 },
      { id: 'tt-token-gold', name: '员工通行证B', cost: 0, rarity: '史诗', type: '道具', desc: '获取 1 张传说卡。', dmg: 0, value: 4 },
      { id: 'tt-jinchuangyao', name: '金疮药', cost: 0, rarity: '史诗', type: '道具', desc: '回复 20 点生命。', dmg: 0, heal: 20, value: 4 },
      { id: 'tt-wood', name: '木材', cost: 0, rarity: '古朴', type: '资源', desc: '木材 ×1。', dmg: 0, value: 2 },
      { id: 'tt-wood-lots', name: '大量木材', cost: 0, rarity: '稀有', type: '资源', desc: '木材 ×2。', dmg: 0, value: 4 },
      { id: 'tt2-apollo', name: '阿猫的礼物', cost: 0, rarity: '史诗', type: '装备', desc: '发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌。', dmg: 0, value: 4 },
      { id: 'tt2-pearlbox', name: '珍珠盒', cost: 0, rarity: '稀有', type: '装备', desc: '内置3*3空间，可以容纳所有类型的资源卡牌。', dmg: 0, value: 3 },
      { id: 'tt2-wreck', name: '沉船宝盒', cost: 0, rarity: '史诗', type: '装备', desc: '消耗该牌时，获取 2张随机卡牌。', dmg: 0, value: 4 },
      { id: 'tt2-venomstaff', name: '毒杖', cost: 0, rarity: '史诗', type: '装备', desc: '每当你使用一张法术牌，为1名随机敌人附加中毒', dmg: 0, value: 4 },
      { id: 'tt2-frostsword', name: '寒冰剑', cost: 0, rarity: '古朴', type: '装备', desc: '对冰冻角色伤害 +2。', dmg: 0, value: 2 },
      { id: 'tt2-jianghu', name: '江湖救急', cost: 1, rarity: '史诗', type: '武术', desc: '发现 1 张其它职业的卡牌并直接施放。', dmg: 0, value: 4 },
      { id: 'tt2-swiftarrow', name: '迅疾箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），抽 1 张牌。', dmg: -1, dmgType: 'attack', draw: 1, value: 2 },
      { id: 'tt2-block', name: '格挡', cost: 1, rarity: '古朴', type: '武术', desc: '本回合所受伤害降为 1。', dmg: 0, value: 2 },
      { id: 'tt2-comboarrow', name: '连击箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1）；如果你打出的上一张牌是武术牌，本牌变为0费。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt2-piercearrow', name: '破甲箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），获得 3 点护甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
      { id: 'tt2-shoot', name: '射击', cost: 0, rarity: '古朴', type: '武术', desc: '造成 2 点伤害。', dmg: 2, dmgType: 'fixed', value: 2 },
      { id: 'tt2-turtlearmor', name: '铸甲', cost: 1, rarity: '稀有', type: '武术', desc: '消耗1 张装备牌，+10甲。', dmg: 0, armor: 10, value: 3 },
      { id: 'tt2-bloodblade', name: '嗜血刃', cost: 2, rarity: '史诗', type: '武术', desc: '攻（+2），回复等量生命。', dmg: 2, dmgType: 'attack', value: 4 },
      { id: 'tt2-forestarrow', name: '绿化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），+3 甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
      { id: 'tt3-blood-arrow', name: '血箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），附加流血。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-fatal-pierce', name: '致命穿刺', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+1）；若对方处于流血状态，伤害 +2 并附加破甲，持续 1 回合。', dmg: 1, dmgType: 'attack', value: 2 },
      { id: 'tt3-fly-arrowhawk', name: '飞身劈', cost: 2, rarity: '稀有', type: '武术', desc: '攻（+3），触发的流血伤害翻倍。', dmg: 3, dmgType: 'attack', value: 3 },
      { id: 'tt3-frost-slash', name: '霜月斩', cost: 2, rarity: '史诗', type: '武术', desc: '攻（+2），附加冰冻与禁疗，持续1回合。', dmg: 2, dmgType: 'attack', value: 4 },
      { id: 'tt3-noon-duel', name: '正午决战', cost: 1, rarity: '史诗', type: '武术', desc: '下回合开始时，连开四枪！（每枪造成2点固定伤害）。', dmg: 0, value: 3 },
      { id: 'tt3-armor-rush', name: '破甲急袭', cost: 2, rarity: '稀有', type: '武术', desc: '攻（+4），附加 2 层流血。', dmg: 4, dmgType: 'attack', value: 3 },
      { id: 'tt3-double-shot', name: '连射', cost: 1, rarity: '稀有', type: '武术', desc: '造成2 点固定伤害，触发 3 次。', dmg: 2, dmgType: 'fixed', value: 2 },
      { id: 'tt3-bandage', name: '包扎', cost: 1, rarity: '古朴', type: '武术', desc: '+3 血，+3 甲。', dmg: 0, heal: 3, armor: 3 },
      { id: 'tt3-purify-arrow', name: '净化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），净化自身。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-arrow-rain', name: '箭雨', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），目标为敌方全体。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-wave-slash', name: '破浪斩', cost: 1, rarity: '稀有', type: '武术', desc: '攻（+3），下回合无法抽牌。', dmg: 3, dmgType: 'attack', value: 2 },
      { id: 'tt3-qi-wave', name: '气功波', cost: 1, rarity: '古朴', type: '武术', desc: '抽 1 张牌，对全体敌人造成等同于其价格的固定伤害。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-hold-fast', name: '坚守', cost: 1, rarity: '古朴', type: '武术', desc: '+5 甲，抽 1 张牌。', dmg: 0, draw: 1, armor: 5, value: 2 },
      { id: 'tt3-life-arrow', name: '生命箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），获得 1 张随机卡牌。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-dig-treasure', name: '挖宝', cost: 1, rarity: '古朴', type: '武术', desc: '从牌库底发现 1 张牌，并获得等同于其价格的护甲。', dmg: 0, value: 2 },
      { id: 'tt3-reshot', name: '重斩', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+2）。', dmg: 2, dmgType: 'attack', value: 2 },
      { id: 'tt3-venom-arrow', name: '毒箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），附加 1层中毒。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-toxin', name: '毒药', cost: 0, rarity: '古朴', type: '法术', desc: '附加 1 层中毒。抽 1 张牌。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-frostfall', name: '剑荡妖邪', cost: 2, rarity: '传说', type: '武术', desc: '攻+5，选择手牌中 1 张武术卡直接释放。', dmg: 5, dmgType: 'attack', value: 5 },
      { id: 'tt3wu-shike', name: '割蚀', cost: 1, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，持续3回合；附加流血。', dmg: 0, value: 2 },
      { id: 'tt3-mystery-potion', name: '神秘药水', cost: 0, rarity: '稀有', type: '道具', desc: '回合开始时：变成1张随机招式卡牌，使其费用为0。', dmg: 0, value: 3 },
      { id: 'tt3-blue-potion', name: '恢复药水', cost: 0, rarity: '稀有', type: '道具', desc: '回复 5 点生命，回复1点能量。', dmg: 0, heal: 5, value: 2 },
      { id: 'tt3-treasure-hunt', name: '寻宝', cost: 1, rarity: '古朴', type: '法术', desc: '造成4点法术伤害，发现 1 张牌。', dmg: 4, dmgType: 'spell', value: 2 },
      { id: 'tt3-nature-form', name: '自然形态', cost: 2, rarity: '稀有', type: '法术', desc: '本局战斗中，能量上限 +1。', dmg: 0, value: 3 },
      { id: 'tt3-python-potion', name: '火焰药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人造成2点法伤', dmg: 0, value: 3 },
      { id: 'tt3-chain-lightning', name: '闪电链', cost: 1, rarity: '古朴', type: '法术', desc: '3′，触发 2 次。', dmg: 3, dmgType: 'spell', value: 2 },
      { id: 'tt3-houyi-potion', name: '狂暴药水', cost: 0, rarity: '稀有', type: '道具', desc: '获得 2 点攻击力。持续 1 回合。', dmg: 0, value: 3 },
      { id: 'tt3-holy-water', name: '治愈', cost: 1, rarity: '古朴', type: '法术', desc: '回复 4 点生命，净化自身', dmg: 0, heal: 4, value: 2 },
      { id: 'tt3-skewer', name: '穿刺', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+2），附加破甲，持续 1 回合。', dmg: 2, dmgType: 'attack', value: 3 },
      { id: 'tt3-holy-shield', cls: '牧师', name: '圣盾', cost: 1, rarity: '职业', type: '法术', desc: '获得 6 点护甲；若你此时护甲为0.本牌变为0费。', dmg: 0, armor: 6, value: 3, unrandom: true },
      { id: 'tt3-iceheart-potion', name: '冰冻药水', cost: 0, rarity: '稀有', type: '道具', desc: '附加冰冻，持续 1 回合。', dmg: 0, value: 3 },
      { id: 'tt3-demon-potion', name: '法力药水', cost: 0, rarity: '稀有', type: '道具', desc: '法伤 +2。持续 1 回合。', dmg: 0, value: 2 },
      { id: 'tt3-magic-lamp', name: '神灯', cost: 1, rarity: '史诗', type: '法术', desc: '抉择：1° 发现 1 张牌并将其释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，获得5 点护甲。', dmg: 0, value: 4 },
      { id: 'tt3-thornfield', name: '棘刺之地', cost: 2, rarity: '稀有', type: '法术', desc: '对所有敌人附加 2 层中毒，并立即触发1次毒伤。', dmg: 0, value: 3 },
      { id: 'tt3-mind-potion', name: '精神药水', cost: 0, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', dmg: 0, draw: 2, value: 3 },
      { id: 'tt3-turnabout-potion', name: '剧毒药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人附加1层中毒。', dmg: 0, value: 3 },
      { id: 'tt3-firm-barrier', cls: '法师', name: '坚冰结界', cost: 0, rarity: '职业', type: '法术', desc: '延长 1 名角色的冰冻 1 回合，抽1张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt3-ice-spike', name: '冰刺', cost: 1, rarity: '古朴', type: '法术', desc: '2′，附加冰冻。', dmg: 2, dmgType: 'spell' },
      { id: 'tt3-grope', name: '摸索', cost: 1, rarity: '古朴', type: '法术', desc: '抽2-3张牌。', dmg: 0, draw: 2, value: 2 },
      { id: 'tt3-mixed-potion', name: '流血药水', cost: 0, rarity: '稀有', type: '道具', desc: '造成 2 点固定伤害，附加流血。', dmg: 0, value: 2 },
      { id: 'tt3sp-dodge', name: '闪避', cost: 1, rarity: '古朴', type: '法术', desc: '本回合避开第1段伤害。', dmg: 0, value: 2 },
      { id: 'tt3sp-devour', cls: '牧师', name: '吞噬', cost: 1, rarity: '职业', type: '法术', desc: '消灭 1 名 攻击力4 点及以下小怪。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt3sp-doom', name: 'TNT', cost: 0, rarity: '史诗', type: '道具', desc: '消灭 2 名 攻击力5点及以下小怪', dmg: 0, value: 4 },
      { id: 'tt3sp-silverthorn', name: '镭射', cost: 1, rarity: '古朴', type: '法术', desc: '造成5点法术伤害；注能(1)：伤害+3。', dmg: 5, dmgType: 'spell', infuse: 1, value: 2 },
      { id: 'tt3sp-magicoil', name: '药水魔法', cost: 1, rarity: '稀有', type: '法术', desc: '发现1瓶药水并直接释放', dmg: 0, value: 3 },
      { id: 'tt3sp-shadowbug', name: '影噬', cost: 1, rarity: '稀有', type: '武术', desc: '本回合偷取 1 名敌人的攻击力至1点。', dmg: 0, value: 3 },
      { id: 'tt3sp-flowerzhen', name: '花鸩', cost: 1, rarity: '史诗', type: '法术', desc: '使 1 名角色中毒层数翻倍并立即触发1次毒伤。', dmg: 0, value: 4 },
      { id: 'tt3sp-bloodstorm', name: '血蝠风暴', cost: 2, rarity: '史诗', type: '法术', desc: '3′，目标为全体敌人，回复等量生命；注能(2)：触发 2 次。', dmg: 3, dmgType: 'spell', infuse: 2, value: 3 },
      { id: 'tt3sp-shadowshot', cls: '降临者', name: '暗影射击', cost: 1, rarity: '职业', type: '法术', desc: '3′，若对手处于诅咒状态，额外施放 1 次。', dmg: 3, dmgType: 'spell', unrandom: true },
      { id: 'tt3-thunderblast', name: '雷殛', cost: 2, rarity: '传说', type: '法术', desc: '造成7点法术伤害；墓地中每有1 张法术牌，伤害+1。', dmg: 7, dmgType: 'spell', value: 5 },
      { id: 'tt3-flux-slash', name: '流光斩', cost: 1, rarity: '传说', type: '武术', desc: '攻（-1），附加 2 层流血；将流光照影洗入牌库。', dmg: -1, dmgType: 'attack', value: 5 },
      { id: 'tt3-immortal-blade', name: '骷髅王剑', cost: 0, rarity: '传说', type: '装备', desc: '对战开始时，你的所有’初始攻击‘化为1张不朽斩。', dmg: 0, value: 5 },
      { id: 'tt3-diamond', name: '钻石', cost: 0, rarity: '传说', type: '资源', desc: '贵重货币，可出售。', value: 16, unrandom: true },
      { id: 'tt3-master-staff', name: '大法师之杖', cost: 0, rarity: '传说', type: '装备', desc: '回合开始时法伤 +1。', dmg: 0, value: 5 },
      { id: 'tt3-chaos-eye', name: '混沌之眼', cost: 0, rarity: '传说', type: '装备', desc: '对战开始时：血量上限 +10，牌库上限+5。', dmg: 0, value: 5 },
      { id: 'tt3-execute', name: '斩杀', cost: 1, rarity: '传说', type: '武术', desc: '对 9 血以下角色造成9点真实伤害。', dmg: 9, dmgType: 'true', value: 5 },
      { id: 'tt3-savior-elixir', name: '斗神酒', cost: 0, rarity: '传说', type: '道具', desc: '回复 99 点生命（相当于回满）。', heal: 99, value: 5, unrandom: true },
      { id: 'tt3-silver-runesword', name: '诅咒之剑', cost: 0, rarity: '史诗', type: '装备', desc: '获得 2 点攻击力；回合开始时，受到2点伤害', dmg: 0, value: 3 },
      { id: 'tt3-azure-sword', name: '百炼青虹剑', cost: 0, rarity: '稀有', type: '装备', desc: '消耗该牌时立即释放一次’初始攻击‘。', dmg: 0, value: 3 },
      { id: 'tt3-deep-seal', name: '深海印记', cost: 0, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。', dmg: 0, dmgType: 'attack' },
      { id: 'tt3-fate-wheel', name: '命运钟表', cost: 0, rarity: '史诗', type: '装备', desc: '主动技能：消耗所有手牌，获得 1 个额外回合。', dmg: 0, value: 4 },
      { id: 'tt3-crimson-pouch', name: '深红丝袋', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：选择并复制你的 1 张手牌。', dmg: 0, value: 3 },
      { id: 'tt3-holy-staff', name: '圣杖', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：净化并回复5血', dmg: 0, heal: 5, value: 3 },
      { id: 'tt3-staff', name: '法杖', cost: 0, rarity: '古朴', type: '装备', desc: '法伤 +1。', dmg: 0, value: 2 },
      { id: 'tt3-wolf-bow', name: '天狼长弓', cost: 0, rarity: '稀有', type: '装备', desc: '回合开始时，获得1张随机的‘箭矢’并将其变为0费。', dmg: 0, value: 3 },
      { id: 'tt3-sapper-bomb', name: '矿工炸药', cost: 0, rarity: '古朴', type: '装备', desc: '消耗该牌时，造成 4 点固定伤害。', dmg: 0, value: 2 },
      { id: 'tt3-twinwater-mail', name: '冰甲', cost: 0, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+3甲。', dmg: 0, armor: 3 },
      { id: 'tt3-grass-armor', name: '草甲', cost: 0, rarity: '古朴', type: '装备', desc: '装备：装备时获得5点护甲。', dmg: 0, armor: 5, value: 2 },
      { id: 'tt3-blooddrinker', name: '饮血剑', cost: 0, rarity: '史诗', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 点攻击力。', dmg: 0, value: 4 },
      { id: 'tt3-longsword', name: '长剑', cost: 0, rarity: '古朴', type: '装备', desc: '+1 攻。', dmg: 0, value: 2 },
      { id: 'tt3-element-seal', name: '元素符印', cost: 0, rarity: '稀有', type: '装备', desc: '本局对战中累计注能3张卡牌后解锁：法伤 +2，抽2张牌。', dmg: 0, draw: 2, value: 3 },
      { id: 'tt3-light-mail', name: '急速跑鞋', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：抽3张牌', dmg: 0, draw: 3 },
      { id: 'tt3-reverse-bow', name: '连弩', cost: 0, rarity: '古朴', type: '装备', desc: '主动技能：直接释放手牌中的所有‘箭’，每释放1张，抽1张牌。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-deep-diary', name: '深海咒印', cost: 0, rarity: '史诗', type: '装备', desc: '自身处于诅咒状态时，获得 2 点攻击力且法伤 +2。', dmg: 0, value: 4 },
      { id: 'tt3eq-boiler', name: '魔法锅炉', cost: 0, rarity: '古朴', type: '装备', desc: '主动技能：消耗至多 2 张牌，发现等量随机卡牌。', dmg: 0, value: 2 },
      { id: 'tt3eq-mistbox', name: '迷之匣', cost: 0, rarity: '古朴', type: '装备', desc: '对战开始时，将 2 张初始攻击替换为随机卡牌。', dmg: 0, value: 2 },
      { id: 'tt3-wood-bundle', name: '一捆木材', cost: 0, rarity: '史诗', type: '资源', desc: '木材 ×3。', dmg: 0, value: 6 },
      { id: 'tt3-ration-double', name: '双份口粮', cost: 0, rarity: '史诗', type: '资源', desc: '口粮 ×2。', dmg: 0, value: 6 },
      { id: 'tt4-shine-token', name: '员工通行证C', cost: 0, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', dmg: 0, value: 4 },
      { id: 'tt4-smoke-bomb', name: '烟雾弹', cost: 0, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', dmg: 0, value: 3 },
      { id: 'tt4-woodify', name: '能量饮料', cost: 0, rarity: '古朴', type: '道具', desc: '回复 6 点生命。', dmg: 0, heal: 6, value: 2 },
      { id: 'tt5-galaxy-voyage', name: '银河之旅', cost: 2, rarity: '传说', type: '法术', desc: '本场对战中，你的所有招式均为 1 费。', dmg: 0, value: 5 },
      { id: 'tt6-demondeal', name: '恶魔交易', cost: 0, rarity: '衍生', type: '事件', desc: '-5血，获得1个大宝箱。', dmg: 0, unrandom: true },
      { id: 'tt6-bandits', battle: true, name: '盗匪横行', cost: 0, rarity: '衍生', type: '事件', desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。', dmg: 0, unrandom: true },
      { id: 'tt6-mystery', name: '神秘补给', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，+2 币。', dmg: 0, unrandom: true },
      { id: 'tt6-goldmine', name: '金矿', cost: 0, rarity: '衍生', type: '事件', desc: '获得 3 币。', dmg: 0, unrandom: true },
      { id: 'tt6-airdrop', name: '空中补给', cost: 0, rarity: '衍生', type: '事件', desc: '从木材、口粮、能量饮料、随机药水中抽取一项。', dmg: 0, unrandom: true },
      { id: 'tt6-chestdraw', name: '宝箱', cost: 0, rarity: '衍生', type: '事件', desc: '从大，中，小宝箱中抽取 1 个。', dmg: 0, unrandom: true },
      { id: 'tt6-systemsupply', name: '系统补给', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，木材 ×1。', dmg: 0, unrandom: true },
      { id: 'tt7-throwblade', cls: '侠客', name: '飞刃偷袭', cost: 0, rarity: '职业', type: '武术', desc: '攻（-3），附加流血，抽 1 张牌。', dmg: -3, dmgType: 'attack', draw: 1, value: 3, unrandom: true },
      { id: 'tt7-stealth', cls: '侠客', name: '潜匿', cost: 1, rarity: '职业', type: '武术', desc: '进入潜行状态 1 回合，抽1张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt7-ghostblade', cls: '侠客', name: '鬼魅之刃', cost: 1, rarity: '职业', type: '武术', desc: '攻（+1），破除隐身时伤害 +2，并抽 2 张牌。', dmg: 1, dmgType: 'attack', draw: 2, value: 3, unrandom: true },
      { id: 'tt7-goldencicada', cls: '侠客', name: '金蝉脱壳', cost: 0, rarity: '职业', type: '武术', desc: '消耗所有手牌，抽 3 张。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-thundergrudge', cls: '侠客', name: '快意恩仇', cost: 1, rarity: '职业', type: '武术', desc: '消耗 2 张初始攻击，攻击 3 次。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-sneak', cls: '侠客', name: '偷袭', cost: 0, rarity: '职业', type: '武术', desc: '攻（-1）。', dmg: -1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-swordimmortal', cls: '侠客', name: '剑仙形态', cost: 2, rarity: '职业', type: '武术', desc: '本局对战中，回合开始时额外抽 1 张牌。', dmg: 0, draw: 1, value: 4, unrandom: true },
      { id: 'tt7-ironphalanx', cls: '战士', name: '铁甲阵', cost: 2, rarity: '职业', type: '武术', desc: '+10 甲，将 5 张随机卡牌洗入牌库，并使其费用均-1。', dmg: 0, armor: 10, value: 3, unrandom: true },
      { id: 'tt7-bloodpotion', cls: '牧师', name: '噬血术', cost: 1, rarity: '职业', type: '法术', desc: '3′，回复等量生命。', dmg: 3, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-bloodpoison', cls: '战士', name: '血毒双镖', cost: 2, rarity: '职业', type: '武术', desc: '选择两个目标（可以重复）：攻（+1），附加流血；攻（+1），附加中毒。', dmg: 1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-provoke', cls: '牧师', name: '扰敌', cost: 1, rarity: '职业', type: '法术', desc: '选择2 名敌人，迫使其相互攻击一次。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-stratagem', cls: '法师', name: '法师锦囊', cost: 1, rarity: '职业', type: '法术', desc: '自带1*3空间，可以置入3张法术牌；打出时选择其中 1 张直接施放。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-bladebloom', cls: '法师', name: '永恒绽放', cost: 2, rarity: '职业', type: '法术', desc: '发现并直接施放 1 张牌，获取剩下两张。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-elementstorm', cls: '法师', name: '元素风暴', cost: 1, rarity: '职业', type: '法术', desc: '注能(1)：下一张法术施放 2 次。', dmg: 0, infuse: 1, value: 3, unrandom: true },
      { id: 'tt7-holyglow', cls: '牧师', name: '沐愈光辉', cost: 1, rarity: '职业', type: '法术', desc: '将自身血量回复至 12 血。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-holyheal', cls: '牧师', name: '圣光治愈', cost: 1, rarity: '职业', type: '法术', desc: '注能（1）：回复 2 倍于被注能卡牌价格的血量。', dmg: 0, infuse: 1, value: 3, unrandom: true },
      { id: 'tt7-energize', cls: '法师', name: '聚能', cost: 0, rarity: '职业', type: '法术', desc: '获得1点能量 。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-abysscurse', cls: '降临者', name: '深渊诅咒', cost: 2, rarity: '职业', type: '法术', desc: '7′，附加禁疗；此时对方身上每有 1 种诅咒，抽 1 张牌。', dmg: 7, dmgType: 'spell', draw: 1, value: 3, unrandom: true },
      { id: 'tt7-smite', cls: '牧师', name: '惩击', cost: 2, rarity: '职业', type: '法术', desc: '10′，对血量一半及以下的敌人伤害增加50%。', dmg: 10, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-silence', cls: '牧师', name: '禁言术', cost: 0, rarity: '职业', type: '法术', desc: '沉默 1 名角色 1 回合，抽 1 张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt7-burnharvest', cls: '降临者', name: '爆燃火球', cost: 1, rarity: '职业', type: '法术', desc: '5′，受法伤加成翻倍；', dmg: 5, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-twinfireball', cls: '降临者', name: '三重火球', cost: 1, rarity: '职业', type: '法术', desc: '4′，将2张‘火球’置入手牌。', dmg: 4, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-meteorstrong', cls: '降临者', name: '星陨之力', cost: 2, rarity: '职业', type: '法术', desc: '注能(2)：施放 3 次火球术。', dmg: 0, infuse: 2, value: 3, unrandom: true },
      { id: 'tt7-recruit', cls: '法师', name: '征召', cost: 2, rarity: '职业', type: '法术', desc: '召唤步兵（4-4） ×2为你抵挡伤害并自动战斗。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-frozenight', cls: '法师', name: '冰封千里', cost: 1, rarity: '职业', type: '法术', desc: '冰冻所有敌人，持续 1 回合。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-fullstrike', cls: '战士', name: '全力一击', cost: 2, rarity: '职业', type: '武术', desc: '攻（+5），抽 1 张牌。', dmg: 5, dmgType: 'attack', draw: 1, value: 2, unrandom: true },
      { id: 'tt7-bulwark', cls: '战士', name: '坚盾', cost: 1, rarity: '职业', type: '武术', desc: '本回合获得 8点护甲，下回合开始时 -4 点。', dmg: 0, armor: 8, value: 3, unrandom: true },
      { id: 'tt7-meteorrain', cls: '侠客', name: '流星箭雨', cost: 1, rarity: '职业', type: '武术', desc: '攻（-1）；触发 2 次。', dmg: -1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-armup', cls: '战士', name: '武装', cost: 1, rarity: '职业', type: '武术', desc: '从牌库中抽取 2 张装备牌。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-demonbreaker', cls: '战士', name: '破甲重斩', cost: 2, rarity: '职业', type: '武术', desc: '攻5，附加破甲，持续 2 回合。；击杀敌人时 +4 甲。', dmg: 5, dmgType: 'attack', armor: 4, value: 3, unrandom: true },
      { id: 'tt7-whirlwind', cls: '战士', name: '旋风斩', cost: 2, rarity: '职业', type: '武术', desc: '攻（+1），目标为敌方全体。', dmg: 1, dmgType: 'attack', value: 3, unrandom: true },   // 2026-09-17 留言「旋风斩应为2费」
      { id: 'tt7-marchrush', cls: '战士', name: '急行军', cost: 1, rarity: '职业', type: '武术', desc: '抽 2张牌，+2甲；若本牌为最后一张手牌，效果触发2次。', dmg: 0, draw: 2, armor: 2, value: 3, unrandom: true },
      { id: 'tt8-hero-assassin', cls: '侠客', hero: true, name: '白梅落影·妄', cost: 2, rarity: '稀有', type: '能力卡', desc: '遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-sword', cls: '侠客', hero: true, name: '无量仙剑·云风', cost: 2, rarity: '稀有', type: '能力卡', desc: '万剑归宗：抽 5 张牌，直接释放其中武术。', dmg: 0, draw: 5, value: 8, unrandom: true },
      { id: 'tt8-hero-warlock', cls: '牧师', hero: true, name: '禁术解放', cost: 2, rarity: '稀有', type: '能力卡', desc: '天灾横行：将四张禁咒洗入牌库，然后抽 2 张牌。', dmg: 0, draw: 2, value: 8, unrandom: true },
      { id: 'tt8-hero-mage', cls: '法师', hero: true, name: '博览者的狂语', cost: 2, rarity: '稀有', type: '能力卡', desc: '万法乾坤：法伤 +1，回合开始时发现 1 张卡牌。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-priest', cls: '牧师', hero: true, name: '浪掷风吟', cost: 2, rarity: '棱彩', type: '能力卡', desc: '甘霖降世：置入随机卡牌直至手牌达到 6 张；其中每置入1 张法术，回复 3 血。', dmg: 0, heal: 3, value: 8, unrandom: true },
      { id: 'tt8-hero-sealer', cls: '降临者', hero: true, name: '邪渊主宰', cost: 2, rarity: '棱彩', type: '能力卡', desc: '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-descender', cls: '降临者', hero: true, name: '充能火山', cost: 2, rarity: '古朴', type: '能力卡', desc: '寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次‘火球’。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-summoner', cls: '法师', hero: true, name: '花开两面', cost: 2, rarity: '棱彩', type: '能力卡', desc: '元素潮汐：抉择：打开‘末日浩劫之门’或者‘天国之门’。两回合后，开启未选择的那扇‘门’', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-guardian', cls: '战士', hero: true, name: '圣剑化身', cost: 2, rarity: '古朴', type: '能力卡', desc: '诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-ranger', cls: '侠客', hero: true, name: '天剑诛魔·云阳', cost: 2, rarity: '古朴', type: '能力卡', desc: '断念：将天启剑与诛魔剑洗入牌库。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-warrior', cls: '战士', hero: true, name: '青龙化身', cost: 2, rarity: '稀有', type: '能力卡', desc: '真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-curse1', cls: '牧师', hero: true, tokenOf: 'tt8-hero-warlock', name: '禁咒I', cost: 0, rarity: '衍生', type: '法术', desc: '抽到时施放：夺取 一名敌人的1 点攻击力。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-curse2', cls: '牧师', hero: true, tokenOf: 'tt8-hero-warlock', name: '禁咒II', cost: 0, rarity: '衍生', type: '法术', desc: '抽到时施放：冰冻一名敌人。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-curse3', cls: '牧师', hero: true, tokenOf: 'tt8-hero-warlock', name: '禁咒III', cost: 0, rarity: '衍生', type: '法术', desc: '抽到时施放：对1名敌人施加中毒，流血。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-curse4', cls: '牧师', hero: true, tokenOf: 'tt8-hero-warlock', name: '禁咒IV', cost: 0, rarity: '衍生', type: '法术', desc: '抽到时施放：沉默1名敌人 1 回合。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-demonslay', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '诛魔剑', cost: 0, rarity: '衍生', type: '装备', desc: '抽到该牌时攻击全体敌人；···以天启诛魔剑覆盖你的所有武器。', dmg: 0, value: 4, unrandom: true },
      { id: 'tt8-archdemon', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', desc: '获得 1 点攻击力，获得3张重斩。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-heavensword', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '天启剑', cost: 0, rarity: '衍生', type: '装备', desc: '抽到该牌时额外抽 1 张牌；在你抽到天启剑与诛魔剑后……', dmg: 0, draw: 1, value: 4, unrandom: true },
      { id: 'tt8-dragonblade', cls: '战士', hero: true, tokenOf: 'tt8-hero-warrior', name: '青龙偃月斩', cost: 2, rarity: '衍生', type: '武术', desc: '攻+6，附加破甲与 1 层流血。', dmg: 6, dmgType: 'attack', value: 8, unrandom: true },
      { id: 'cmtn0pbkmnvc', name: '流光照影', cost: 2, rarity: '衍生', type: '武术', desc: '对方身上每有一层诅咒，释放一次‘初始攻击’', value: 5, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtn1epgt20j', name: '灵能召唤', cost: 1, rarity: '稀有', type: '法术', desc: '发现一张注能卡，使其无需注能', value: 3 }, // 第十批补种（设计者实机卡）
      { id: 'cmtn233trmeg', name: '不朽斩', cost: 1, rarity: '衍生', type: '武术', desc: '攻（+1），永远被保留在手牌中，无法用于注能', dmg: 1, dmgType: 'attack', value: 5, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtn2jc142dj', name: '刀剑形态', cost: 1, rarity: '稀有', type: '武术', desc: '回合开始时，获得一张随机手牌的复制', value: 3 }, // 第十批补种（设计者实机卡）
      { id: 'cmtn6ulm4boj', name: '步兵', cost: 0, rarity: '衍生', type: '生物', desc: '攻击力4生命4，优先为主人承受伤害，自动攻击敌人', unrandom: true }, // 第十批补种（设计者实机卡）；cost 补 0 防库界面显示 undefined
      { id: 'cmtn79743r2n', name: '末日浩劫之门', rarity: '棱彩', type: '生物', desc: '回合开始时对所有敌方角色各施加一层随机诅咒，优先不重复。', unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtn7err0a7', name: '天国之门', rarity: '棱彩', type: '生物', desc: '回合开始时随机获取一项祝福，对全体友方施放，优先不重复。（获得潜行，持续 1 回合。获得 1 点攻击力。法伤 +1。减伤 1。获得 5 点护甲。净化。从这些中随机）', armor: 5, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtna0nb1yxt', name: '法力光波', cost: 1, rarity: '古朴', type: '法术', desc: '5点法术伤害', dmg: 5, dmgType: 'spell', value: 2 }, // 第十批补种（设计者实机卡）
    ],
    // 桌游手绘卡 · 第十一批（2026-09-09 与设计者实机卡库导出完全对齐，老板拍板）：
    // 以微信接收的设计者导出（搜打撤·代号7_卡牌库_233张.json，裸数组旧格式）为准：
    //   · 补入设计者实机有而仓库缺失的 26 张（tt7 旧职业卡 9 / 封印肢体 4 /
    //     制作坊自建 cmtn* 13）；不变应万变新旧两版并存，与设计者实机一致；厉兵秣马双版已终（cc-prep 于 2026-09-19 退役，只留 tt7-ironcharge）
    //     （旧版 tt7-* 无 cls，不进职业池；例外：法力补给 tt7-maxsupply 仓库侧补
    //     cls=法师——白塔专属，卡面「人物专属」写不清归属）；
    //   · 恶魔之力 tt7-drunksong 整卡退役（2026-09-13 老板拍板删除：同名双版收口只留
    //     cc-demon；入 RETIRE_TT11 + key 升 v5 重播清老档）；
    //   · 25 张共享 id 卡整卡取设计者稿（寻宝图/员工通行证A/经济卡包/初始火球/
    //     tt6-goldhammer/风暴火球/致命射线/花瓣 回退设计者版），其中：
    //     能力卡 type 保持定版「能力卡」、敌人图鉴保仓库 art 贴图键、
    //     desc「英雄卡」字样改「能力卡」（2026-09-08 术语定版）；
    // 覆盖/补种/退役走 ensureTabletopSync11()（TT11_KEY 标记，一次性）。
    TABLETOP11: [
      { id: "tt7-livingwater", name: "圣光之源", cost: 2, rarity: "职业", type: "法术", dmg: 0, draw: 5, desc: "抽 5 张牌。", value: 3, sellable: false },
      { id: "tt7-naturestaff", name: "自然法杖", cost: 0, rarity: "稀有", type: "装备", dmg: 0, desc: "主动技能：选择 1 张卡牌，下回合将其变为 0 费。", value: 3, sellable: false }, // 稀有度改稀有 + 限定技能改主动技能（2026-09-16 留言）
      { id: "tt7-darkfort", cls: "降临者", name: "黑暗吊坠", cost: 0, rarity: "职业", type: "装备", dmg: 0, desc: "免疫 1 次致命伤害，并在该回合内处于无敌状态。", value: 3, sellable: false }, // cls 为定版归属（老板 2026-09-09 拍板常无欲专属）
      { id: "tt7-arcanescroll", cls: "法师", name: "奥术残卷", cost: 0, rarity: "职业", type: "装备", dmg: 0, draw: 3, desc: "消耗该牌时抽 3 张牌。", value: 3, sellable: false }, // cls 为定版归属（老板 2026-09-09 拍板白塔专属）
      { id: "tt7-talisman", name: "灵符", cost: 0, rarity: "稀有", type: "装备", dmg: 0, draw: 2, desc: "对战开始时，额外抽 2 张牌。", value: 3, sellable: false }, // 稀有度改稀有（2026-09-16 留言）
      { id: "tt7-ironcharge", name: "厉兵秣马", cost: 2, rarity: "职业", type: "武术", dmg: 0, draw: 2, armor: 12, desc: "+12 甲，抽 2 张牌。", value: 3, sellable: false },
      { id: "tt7-maxsupply", cls: "法师", name: "法力补给", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "抽牌，直到有 4 张手牌。", value: 3, sellable: false }, // cls 为仓库侧定版（老板 2026-09-09 拍板白塔专属），设计者实机稿无 cls
      { id: "tt7-imitate", cls: "侠客", name: "不变应万变-改", cost: 1, rarity: "职业", type: "武术", dmg: 0, desc: "在手牌中时，本牌变为打出的上一张武术牌的1费复制。", value: 3, sellable: false }, // 同名不同效果版本按老板 2026-09-19 规则追加「-改」
      { id: "tt8-healplus", tokenOf: "tt8-hero-sealer", name: "封印肢体4", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, desc: "法伤 +1。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-energycap", tokenOf: "tt8-hero-sealer", name: "封印肢体2", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, desc: "能量上限 +1。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-nofocus", tokenOf: "tt8-hero-sealer", name: "封印肢体3", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, desc: "无需注能。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-curseimmune", tokenOf: "tt8-hero-sealer", name: "封印肢体1", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, desc: "免疫诅咒。", value: 8, sellable: false, unrandom: true },
      { id: "cmtmvq6ss84l", name: "员工通行证A", cost: 0, rarity: "衍生", type: "道具", dmg: 0, desc: "获取本职业的能力卡", value: 8, sellable: false },
      { id: "cmtn0xt0zr7", name: "闪金之锤", cost: 1, rarity: "衍生", type: "武术", dmg: 5, dmgType: "fixed", desc: "造成5点固定伤害，若击杀敌人，+2币。", value: 3, sellable: false },
      { id: "cmtn125e1nk0", name: "神秘召唤", cost: 2, rarity: "史诗", type: "法术", dmg: 0, desc: "发现一张传说或能力卡。", value: 4, sellable: false },
      { id: "cmtn1gfhczzj", cls: "降临者", name: "厄运", cost: 0, rarity: "职业", type: "法术", dmg: 0, desc: "随机获取1张能施加诅咒的招式", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1i64j7y7", cls: "侠客", name: "盗宝", cost: 1, rarity: "职业", type: "武术", dmg: 0, desc: "发现一张装备卡", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1lbhbqi4", cls: "降临者", name: "充能火球", cost: 1, rarity: "职业", type: "法术", dmg: 4, dmgType: "spell", desc: "4‘，回合开始时，本牌伤害+1", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1ntxzoc4", cls: "降临者", name: "火焰形态", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "本局对战中，法伤+1", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1p9vb5au", cls: "法师", name: "千变万化", cost: 2, rarity: "职业", type: "法术", dmg: 0, desc: "发现一种形态并释放", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1r10xnl1", cls: "降临者", name: "黑暗形态", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "本局对战中，每当你发现卡牌时，增加1个可选项", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1wnhhym", cls: "侠客", name: "江湖救急-改", cost: 0, rarity: "职业", type: "武术", dmg: 0, desc: "随机获得3张临时卡牌，回合开始时将其消耗。", value: 3, sellable: false, unrandom: true },   // 同名不同效果版本按老板 2026-09-19 规则追加「-改」
      { id: "cmtn28jv33wx", name: "搜索大宝箱", cost: 0, rarity: "衍生", type: "法术", dmg: 0, desc: "随机获取3张卡牌", value: 3, sellable: false },
      { id: "cmtn6bge52qt", name: "复原药水", cost: 0, rarity: "稀有", type: "道具", dmg: 0, desc: "在背包中才能使用，复原最多两张卡牌", value: 3, sellable: false },
      { id: "cmtn7qttxqo4", name: "修鞋铺", cost: 0, rarity: "衍生", type: "事件", dmg: 0, desc: "获得员工通行证A碎片；复原1张卡牌", value: 0, sellable: false },
      // —— 以下 25 张共享 id 卡取设计者稿（整卡覆盖） ——
      { id: "starter-emergency-bandage", name: "应急绷带", cost: 0, rarity: "稀有", type: "道具", dmg: 0, heal: 12, desc: "回复12 点生命。", value: 0, sellable: false },
      { id: "tt-token-color", name: "员工通行证A", cost: 0, rarity: "史诗", type: "道具", dmg: 0, desc: "集齐两枚碎片，合成真正的员工通行证A：获取一张能力卡。", value: 4, sellable: false },
      { id: "tt-econpack", name: "经济卡包", cost: 0, rarity: "史诗", type: "资源", dmg: 0, desc: "只能在仓库界面点击使用，获得5张随机卡牌", value: 10, sellable: false, unrandom: true },
      { id: "tt2-treasuremap", name: "寻宝图", cost: 0, rarity: "古朴", type: "装备", dmg: 0, draw: 1, desc: "主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。", value: 2, sellable: false },
      { id: "tt3-flame-storm", cls: "降临者", name: "风暴火球", cost: 2, rarity: "职业", type: "法术", dmg: 4, dmgType: "spell", desc: "对全体敌人每人释放1次火球。", value: 3, sellable: false, unrandom: true },
      { id: "tt3-fireball", name: "火球", cost: 1, rarity: "衍生", type: "法术", dmg: 4, dmgType: "spell", desc: "造成 4 点法术伤害。", value: 1, sellable: false, unrandom: true }, // 衍生牌（2026-09-16 留言「初始不给火球，把火球设定成衍生」）：不再每局携带；unrandom 双保险——不进发现/随机/商店池
      { id: "tt3-nuke-ray", cls: "降临者", name: "致命射线", cost: 2, rarity: "职业", type: "法术", dmg: 8, dmgType: "spell", desc: "造成8点法术伤害，对其附加3种随机诅咒", value: 3, sellable: false, unrandom: true },
      { id: "tt3-petal", cls: "牧师", name: "花瓣法阵", cost: 1, rarity: "职业", type: "法术", dmg: 0, draw: 1, heal: 2, desc: "回合开始时额外抽1张牌并回复 3 点生命，持续 3 回合。", value: 3, sellable: false, unrandom: true },
      { id: "tt6-goldhammer", name: "矮人的帮助", cost: 0, rarity: "衍生", type: "事件", dmg: 0, desc: "获得卡牌‘闪金之锤’。", value: 0, sellable: false },
      { id: "tt8-hero-assassin", cls: "侠客", hero: true, name: "白梅落影·妄", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。", value: 8, unrandom: true },
      { id: "tt8-hero-sword", cls: "侠客", hero: true, name: "无量仙剑·云风", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, draw: 5, desc: "万剑归宗：抽 5 张牌，直接释放其中武术。", value: 8, unrandom: true },
      { id: "tt8-hero-warlock", cls: "牧师", hero: true, name: "禁术解放", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, draw: 2, desc: "天灾横行：将四张禁咒洗入牌库，然后抽 2 张牌。", value: 8, unrandom: true },
      { id: "tt8-hero-mage", cls: "法师", hero: true, name: "博览者的狂语", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "万法乾坤：法伤 +1，回合开始时发现 1 张卡牌。", value: 8, unrandom: true },
      { id: "tt8-hero-priest", cls: "牧师", hero: true, name: "浪掷风吟", cost: 2, rarity: "棱彩", type: "能力卡", dmg: 0, heal: 3, desc: "甘霖降世：置入随机卡牌直至手牌达到 6 张；其中每置入1 张法术，回复 3 血。", value: 8, unrandom: true },
      { id: "tt8-hero-sealer", cls: "降临者", hero: true, name: "邪渊主宰", cost: 2, rarity: "棱彩", type: "能力卡", dmg: 0, desc: "深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。", value: 8, unrandom: true },
      { id: "tt8-hero-descender", cls: "降临者", hero: true, name: "充能火山", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次‘火球’。", value: 8, unrandom: true },
      { id: "tt8-hero-summoner", cls: "法师", hero: true, name: "花开两面", cost: 2, rarity: "棱彩", type: "能力卡", dmg: 0, desc: "元素潮汐：抉择：打开‘末日浩劫之门’或者‘天国之门’。两回合后，开启未选择的那扇‘门’", value: 8, unrandom: true },
      { id: "tt8-hero-guardian", cls: "战士", hero: true, name: "圣剑化身", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。", value: 8, unrandom: true },
      { id: "tt8-hero-ranger", cls: "侠客", hero: true, name: "天剑诛魔·云阳", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "断念：将天启剑与诛魔剑洗入牌库。", value: 8, unrandom: true },
      { id: "tt8-hero-warrior", cls: "战士", hero: true, name: "青龙化身", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。", value: 8, unrandom: true },
      // 敌人图鉴 5 张（与 BESTIARY 同 id）：2026-09-09 老板定版新世界观命名，名字与描述随 BESTIARY 同步
      { id: "foe-orc_axe", name: "甲壳变异体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 4 / 生命 7。变异·第3层。防御/反击型，隔回合蓄势。", value: 0, sellable: false, art: "orc_axe" },
      { id: "foe-wolf_rider", name: "变异雪狼", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 7 / 生命 6。变异·第3层。蓄力攻击：隔回合强化一击。", value: 0, sellable: false, art: "wolf_rider" },
      { id: "foe-fire_el", name: "灼热异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 10 / 生命 7。变异·第4层。攻击并灼烧。", value: 0, sellable: false, art: "fire_el" },
      { id: "foe-water_el", name: "腐蚀异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 7 / 生命 10。变异·第4层。防御/反击型，隔回合蓄势。", value: 0, sellable: false, art: "water_el" },
      { id: "foe-grass_el", name: "滋生异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 5 / 生命 12。变异·第5层。攻击并施加诅咒。", value: 0, sellable: false, art: "grass_el" },
    ],

    all() {
      // 内存缓存（2026-09-07 性能）：卡库全量存 localStorage（数百张含全部描述文本），
      // 每张卡渲染时 rarityOf/sellPrice/isHeroLine 都会调 all() 全量 JSON.parse——
      // 战斗页一次 render 按「手牌衍生/能力卡数 ×2-3」放大解析次数。
      // 写路径只有 saveAll / clearAll，在那两处同步更新/失效保持一致
      // （调用方均以 filter/重新赋值产生新数组，无原地修改）。
      if (_cardsCache) return _cardsCache;
      try { _cardsCache = JSON.parse(localStorage.getItem(KEY)) || []; }
      catch (e) { _cardsCache = []; }
      return _cardsCache;
    },

    saveAll(cards) { _cardsCache = cards; localStorage.setItem(KEY, JSON.stringify(cards)); },

    upsert(card) {
      const cards = SDT.Cards.all();
      if (!card.id) card.id = 'c' + Date.now().toString(36) + Math.floor(Random.random('identity') * 46656).toString(36);
      const i = cards.findIndex(c => c.id === card.id);
      if (i >= 0) cards[i] = card; else cards.push(card);
      SDT.Cards.saveAll(cards);
      return card;
    },

    remove(id) { SDT.Cards.saveAll(SDT.Cards.all().filter(c => c.id !== id)); },

    clearAll() { _cardsCache = null; localStorage.removeItem(KEY); },

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

    // 卡背/卡面渲染已外迁 cards.view.js（2026-09-11 架构批次 1：视图与数据分离）。
    // SDT.Cards 上保留同名转发，既有调用方（SDT.Cards.cardHTML 等）不受影响。
    cardBackHTML,
    cardHTML,

    // 播入初始牌「初始攻击」（只播一次，之后删改都尊重玩家）
    ensureSha() {
      // 旧档迁移：早期版本默认名「杀」统一纠正为定版「初始攻击」
      // （按 id 识别系统卡，只纠正旧默认名，不覆盖玩家后来改过的其它名字）
      try {
        const cards = SDT.Cards.all();
        // 旧 id 迁移（2026-09-19 老板令：彻底删除「杀」id）：builtin-sha → starter-attack，
        // 卡库层一次性归一化；对局存档侧由 RunStorage MIGRATIONS 兜底
        let renamed = false;
        for (const c of cards) if (c.id === 'builtin-sha') { c.id = 'starter-attack'; renamed = true; }
        const sha = cards.find(c => c.id === SDT.Cards.SHA.id);
        if (sha && sha.name === '杀') {
          sha.name = SDT.Cards.SHA.name;
          sha.desc = SDT.Cards.SHA.desc;
          renamed = true;
        }
        if (renamed) SDT.Cards.saveAll(cards);
      } catch (e) { /* 存储不可用时静默跳过 */ }
      SDT.Cards.seedBatch([SDT.Cards.SHA], 'sdt-cards-sha-seeded');
    },

    // 卡牌库为空或缺少初始牌时，补入新手卡
    ensureStarters() {
      const cards = SDT.Cards.all();
      // 兼容早期没有 id 的默认资源卡：将历史生成的临时 id 收敛到稳定编号，
      // 使制式口粮的卡面资源不再依赖名称或一次性生成的 id。
      const legacyRation = cards.find(c => c.name === '制式口粮' && c.type === '资源');
      if (legacyRation && legacyRation.id !== 'starter-ration' && !cards.some(c => c.id === 'starter-ration')) {
        legacyRation.id = 'starter-ration';
        SDT.Cards.saveAll(cards);
      }
      const legacyBandage = cards.find(c => c.name === '应急绷带' && c.type === '道具');
      if (legacyBandage && legacyBandage.id !== 'starter-emergency-bandage' && !cards.some(c => c.id === 'starter-emergency-bandage')) {
        legacyBandage.id = 'starter-emergency-bandage';
        SDT.Cards.saveAll(cards);
      }
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

    // 敌人图鉴同步（2026-09-09 老板定版：新世界观命名 + 五层分布）。
    // foe-* 卡名与描述派生自 mapData.js 怪物表（非玩家自制内容），按 id 从 BESTIARY
    // 同步 name/desc 并补种缺失条目（新增能力者白鸦/烛火/静默/回声），每次启动幂等执行
    // （沿用 ensureShieldToArmor 惯例），保证老存档也拿到新文案与新图鉴；
    // 其他字段与玩家在制作坊的改动不受影响。
    ensureFoeRename() {
      try {
        const cards = SDT.Cards.all();
        let dirty = false;
        SDT.Cards.BESTIARY.forEach(src => {
          const i = cards.findIndex(c => c.id === src.id);
          if (i < 0) { cards.push({ ...src }); dirty = true; return; }
          if (cards[i].name !== src.name || cards[i].desc !== src.desc) {
            cards[i].name = src.name;
            cards[i].desc = src.desc;
            dirty = true;
          }
        });
        if (dirty) SDT.Cards.saveAll(cards);
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

    // 「杀」→「初始攻击」术语迁移（2026-09-09 老板定版：效果文本统一写作「初始攻击」，
    // 卡池无「杀」类型，选牌/释放按卡名匹配）。每次启动幂等改写存量卡面描述。
    ensureShaToStarterAttack() {
      try {
        const cards = SDT.Cards.all();
        let dirty = false;
        cards.forEach(c => {
          if (!c.desc) return;
          const before = String(c.desc);
          let d = before
            .replace(/([‘’“”「」])杀([‘’“”「」])/g, '$1初始攻击$2')  // 引号内的概念引用：’杀‘ → ’初始攻击‘
            .replace(/(\d+)(\s*)张\s*杀/g, '$1$2张初始攻击')          // 数量表达：2 张杀 → 2 张初始攻击（保留原空格）
            .replace(/一(\s*)张\s*杀/g, '一$1张初始攻击');
          if (d !== before) { c.desc = d; dirty = true; }
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

    // 抉择卡数据修正（一次性，2026-09-08）：神灯的护甲只属于抉择 3°——
    // 结构化 armor 字段会让任何抉择分支都白送 5 甲，删除字段改由选项文本结算
    ensureChoiceFixes() {
      try {
        if (localStorage.getItem('sdt-mig-choice')) return;
        const cards = SDT.Cards.all();
        cards.forEach(c => {
          if (c.id === 'tt3-magic-lamp' && c.armor) { delete c.armor; }
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem('sdt-mig-choice', '1');
      } catch (e) { /* 静默跳过 */ }
    },

    // 第十批同步：设计者实机定版双向合并（TT10_KEY 标记，一次性）。按 id 整卡覆盖 + 缺失补种；
    // 本轮为老板拍板的定版动作，有意覆盖制作坊玩家改动（与 seedBatch 的「尊重玩家」语义不同）；
    // 并移除同设计重复 id（RETIRE，设计者已在旧 id 上定版同名卡）。
    ensureTabletopSync() {
      try {
        if (localStorage.getItem(TT10_KEY)) return;
        const cards = SDT.Cards.all();
        for (let i = cards.length - 1; i >= 0; i--) {
          if (RETIRE_TT10.includes(cards[i].id)) cards.splice(i, 1);
        }
        SDT.Cards.TABLETOP10.forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...d }; else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(TT10_KEY, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 第十一批同步（2026-09-09 老板拍板）：与设计者实机卡库导出（微信接收的
    // 「搜打撤·代号7_卡牌库_233张.json」，裸数组旧格式）完全对齐——
    //   · 补入设计者实机有而仓库缺失的 26 张；
    //   · 39 张仓库独有卡退役（RETIRE_TT11；「新兵操典」种子不带 id，按名字清理）；
    //   · 25 张共享 id 卡整卡取设计者稿（能力卡 type「能力卡」与敌人图鉴 art
    //     为仓库实现标记，不回退，见 TABLETOP11 注释）。
    // 有意结果：不变应万变 新旧两版并存（设计者实机如此；厉兵秣马 cc-prep 已于 2026-09-19 退役，只留 tt7-ironcharge），
    // 旧版 tt7-* 无 cls 不进职业池，法力补给除外——cls=法师 为仓库定版）；
    // 恶魔之力 tt7-drunksong 已整卡退役（2026-09-13 老板拍板删除，同名双版只留 cc-demon）。
    // 初始牌只剩初始攻击与应急绷带（设计者稿）。
    ensureTabletopSync11() {
      try {
        if (localStorage.getItem(TT11_KEY)) return;
        const cards = SDT.Cards.all();
        for (let i = cards.length - 1; i >= 0; i--) {
          if (RETIRE_TT11.includes(cards[i].id) || cards[i].name === '新兵操典') cards.splice(i, 1);
        }
        SDT.Cards.TABLETOP11.forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...d }; else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(TT11_KEY, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

// ===== 实机定版覆盖批次（数据真源：game/data/cards-sync.json）=====
    // 网页版卡牌库的修改同步进定版数据（老板 2026-09-09 拍板的机制）——
    // 数据由 scripts/sync-cards-from-live.mjs 生成写入 JSON，本文件只负责播种。
    // 沿用 TABLETOP10/11 模式：按 id 整卡覆盖 + 缺失补种 + RETIRE 退役；KEY 变更让旧环境重播。
    CARDS_SYNC: DATA.cardsSync.cards,
    RETIRE_CARDS_SYNC: DATA.cardsSync.retire,
    ensureCardsSyncLive() {
      try {
        const seedKey = `sdt-cards-sync-v${DATA.cardsSync.version}-seeded`;
        if (localStorage.getItem(seedKey)) return;
        const cards = SDT.Cards.all();
        for (let i = cards.length - 1; i >= 0; i--) {
          if (this.RETIRE_CARDS_SYNC.includes(cards[i].id)) cards.splice(i, 1);
        }
        this.CARDS_SYNC.forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...d }; else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(seedKey, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },
    ensureEvents0919() {
      try {
        if (localStorage.getItem(EVENTS_0919_KEY)) return;
        const cards = SDT.Cards.all();
        SDT.Cards.EVENTS_0919.forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...cards[i], ...d };
          else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(EVENTS_0919_KEY, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },
    // 指定道具定名迁移：保留稳定 id 与存档引用，只更新展示名；
    // 旧内置金疮药并入正式 tt-jinchuangyao，避免仓库里继续存在两个定义。
    ensureItemRenames() {
      try {
        if (localStorage.getItem(ITEM_RENAME_KEY)) return;
        const names = {
          'tt-medneedle': '急救合剂',
          'tt-crystal': '能源结晶',
          'tt-token-color': '员工通行证A',
          'tt-token-gold': '员工通行证B',
          'tt4-shine-token': '员工通行证C',
          'tt-jinchuangyao': '金疮药',
          'tt3sp-doom': 'TNT',
          'tt4-woodify': '能量饮料',
          'tt3-savior-elixir': '斗神酒',
        };
        const cards = SDT.Cards.all();
        let dirty = false;
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].id === 'builtin-jinchuangyao') { cards.splice(i, 1); dirty = true; continue; }
          const name = names[cards[i].id];
          if (name && cards[i].name !== name) { cards[i].name = name; dirty = true; }
        }
        if (dirty) SDT.Cards.saveAll(cards);
        localStorage.setItem(ITEM_RENAME_KEY, '1');
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
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
      SDT.Cards.ensureTabletopSync();  // 第十批：设计者实机定版同步（按 id 整卡覆盖/补种，只跑一次）
      SDT.Cards.ensureItemRenames();   // 指定道具定名 + 金创药/金疮药合并（按稳定 id 迁移旧卡库）
      SDT.Cards.ensureClassRarity();   // v2：老档第七批职业卡统一迁移为「职业」稀有度（2026-09-04 定版）
      SDT.Cards.ensureShieldToArmor(); // 护盾→护甲术语迁移（含老存档，2026-09-04 定版）
      SDT.Cards.ensureShaToStarterAttack(); // 「杀」→「初始攻击」术语迁移（含老存档，2026-09-09 定版）
      SDT.Cards.ensureCardFixes();    // 设计者定版数据修正（爆燃火球删注能，2026-09-05）
      SDT.Cards.ensureChoiceFixes();  // 抉择卡数据修正（神灯删 armor 字段，2026-09-08）
      SDT.Cards.ensureClassConsolidation(); // 职业整合：11 职业 → 5 职业，逐卡改归属（2026-09-05 定版）
      SDT.Cards.ensureDmgValues();    // 伤害数值回填（描述 N′ → dmg 字段，2026-09-04 新增）
      SDT.Cards.ensureHeroFields();   // 修复早期制作坊保存丢失的 cls/hero（专属立绘依赖）
      SDT.Cards.ensureAbilityRename(); // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）
      SDT.Cards.ensureAbilityCards();  // 能力卡补种：老档卡库缺失的 11 张能力卡本体自动补入（2026-09-09）
      SDT.Cards.ensureTabletopSync11();
      SDT.Cards.ensureFoeRename();     // 敌人图鉴改名同步（新世界观命名 + 五层分布，含老存档，2026-09-09 定版）
      SDT.Cards.ensureCardsSyncLive(); // 实机卡库同步（数据见 game/data/cards-sync.json，只跑一次）
      SDT.Cards.ensureDuplicateRenames(); // 同名不同 ID/效果版本统一在后者追加「-改」（含旧卡库）
      SDT.Cards.ensureEvents0919();    // 0919 都市污染事件池：放在实机同步之后，以本轮定稿名与效果为准
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
          // 法师（← 法师/召唤师；坚冰结界 自第三批转职；奥术残卷 2026-09-09 老板改判白塔专属）
          'tt7-arcanebolt': '法师', 'tt7-energize': '法师', 'tt7-frozenight': '法师', 'tt7-recruit': '法师',
          'tt7-elementstorm': '法师', 'tt7-stratagem': '法师', 'tt7-bladebloom': '法师', 'tt3-firm-barrier': '法师',
          'tt7-arcanescroll': '法师', 'tt7-maxsupply': '法师',   // 法力补给 09-09 定版白塔专属，v3 重播兜底恢复
          // 降临者（← 降临者/授印者；暗影射击 自第三批转职；黑暗吊坠 2026-09-09 老板改判常无欲专属）
          'tt7-abysscurse': '降临者', 'tt7-burnharvest': '降临者', 'tt7-twinfireball': '降临者',
          'tt7-meteorstrong': '降临者', 'tt3sp-shadowshot': '降临者', 'tt7-darkfort': '降临者',
        };
        // ①' 能力卡与衍生牌：只改 cls 归属（稀有度保持 稀有/古朴/衍生，不并入「职业」）
        const CC_HERO_REASSIGN = {
          // 侠客：妄（原刺客）/ 云风（原剑客）/ 云阳（原游侠）
          'tt8-hero-assassin': '侠客', 'tt8-hero-sword': '侠客', 'tt8-hero-ranger': '侠客',
          'tt8-demonslay': '侠客', 'tt8-archdemon': '侠客', 'tt8-heavensword': '侠客', // 云阳专属衍生剑随迁
          // 战士：青龙化身（原战士）/ 圣剑化身（原守卫）
          'tt8-hero-warrior': '战士', 'tt8-hero-guardian': '战士', 'tt8-dragonblade': '战士',
          // 牧师：浪掷风吟（原牧师）/ 禁术解放（原术士）；禁咒×4 随禁术解放迁入
          'tt8-hero-priest': '牧师', 'tt8-hero-warlock': '牧师',
          'tt8-curse1': '牧师', 'tt8-curse2': '牧师', 'tt8-curse3': '牧师', 'tt8-curse4': '牧师',
          // 法师：博览者的狂语（原法师）/ 花开两面（原召唤师）
          'tt8-hero-mage': '法师', 'tt8-hero-summoner': '法师',
          // 降临者：邪渊主宰（原授印者英雄定版更名改归）/ 充能火山（原降临者）
          'tt8-hero-descender': '降临者', 'tt8-hero-sealer': '降临者',
        };
        // ① id → 定版更名（与设计者实机卡库的最新命名对齐）
        const CC_RENAME = {
          'tt7-thundergrudge': '快意恩仇', 'tt7-swordimmortal': '剑仙形态', 'tt7-bloodpotion': '噬血术',
          'tt7-marchrush': '急行军', 'tt7-stratagem': '法师锦囊', 'tt7-bladebloom': '永恒绽放',
          'tt7-burnharvest': '爆燃火球', 'tt7-twinfireball': '三重火球', 'tt7-meteorstrong': '星陨之力',
          'tt8-hero-warlock': '禁术解放', 'tt8-hero-summoner': '花开两面', 'tt8-hero-warrior': '青龙化身',
          'tt8-hero-sealer': '邪渊主宰·妲莉薇特',
        };
        // ①" 定版重写描述（设计者 2026-09-05 定版：妲莉薇特信息按降临者火焰主题重写）
        const CC_DESC = { 'tt8-hero-sealer': '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。' };
        // ② 制作坊自建卡按卡名收编 → 职业（cls 从第七批同名定义反查）
        const CC_CONVERT = ['盗宝', '花瓣法阵', '千变万化', '厄运', '黑暗形态', '充能火球', '火焰形态', '致命射线', '风暴火球'];
        // ④ 退役（未入列旧职业卡 + 印记衍生牌×4；邪渊主宰·妲莉薇特已改归降临者，不再退役；
        //    奥术残卷→法师、黑暗吊坠→降临者 2026-09-09 老板改判收编，从退役表移除；
        //    法力补给同批移除——09-09 已拍板白塔专属，留在表里会在 v3 重播时误删其 cls）
        const CC_RETIRE = ['tt7-drunksong', 'tt7-livingwater', 'tt7-naturestaff',
          'tt7-talisman', 'tt7-ironcharge', 'tt7-bloodthirst',
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

    // 能力卡查询（第八批）：heroOf(职业) 返回该职业的能力卡；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡，随机抽 1 张（如侠客：妄/云阳/云风）
    heroOf(cls) {
      const heroes = SDT.Cards.all().filter(c => c.hero && c.cls === cls);
      return heroes.length ? heroes[Math.floor(Random.random('card') * heroes.length)] : null;
    },

    // 能力卡字段回填：早期制作坊保存会丢掉 cls/hero，导致专属立绘与 heroOf 失效。
    // 只按 id 补缺失的 cls / hero / tokenOf / unrandom，不覆盖玩家改过的名字与描述。
    // 另：任何 hero:true 但缺 cls 的卡（如旧对局存档里的副本来源），按 id/名称从能力卡定义表回填。
    ensureHeroFields() {
      try {
        const defs = SDT.Cards.TABLETOP8;
        const cards = SDT.Cards.all();
        let dirty = false;
        for (const c of cards) {
          if (!/^tt8-/.test(String(c.id || ''))) {
            // 非 tt8 id 的能力卡：按 id / 名称找回职业归属
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

    // 能力卡术语迁移（设计者 2026-09-08 定版）：类型「英雄卡」整体更名「能力卡」。
    // 幂等（改完即无目标，无需 key 标记）：卡库由 ensureAbilityRename 处理，
    // 存档内的整卡副本（ownedCards / 仓库 stash / 消耗口袋 pocket）由读档路径调用本函数。
    applyAbilityRename(cards) {
      let dirty = false;
      (Array.isArray(cards) ? cards : []).forEach(c => {
        if (c && c.type === '英雄卡') { c.type = '能力卡'; dirty = true; }
      });
      return dirty;
    },

    // 同名不同 ID 且效果不同的现役卡：保留先定义版本原名，后定义版本追加「-改」。
    // 按稳定 id 迁移，避免名称本身再次参与身份判断；每次启动幂等执行，防止后续同步覆盖回旧名。
    applyDuplicateRenames(cards) {
      const names = { 'tt7-imitate': '不变应万变-改', 'cmtn1wnhhym': '江湖救急-改' };
      let dirty = false;
      (Array.isArray(cards) ? cards : []).forEach(card => {
        const name = card && names[card.id];
        if (name && card.name !== name) { card.name = name; dirty = true; }
      });
      return dirty;
    },

    ensureDuplicateRenames() {
      try {
        const cards = SDT.Cards.all();
        if (SDT.Cards.applyDuplicateRenames(cards)) SDT.Cards.saveAll(cards);
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    ensureAbilityRename() {
      try {
        const cards = SDT.Cards.all();
        if (SDT.Cards.applyAbilityRename(cards)) SDT.Cards.saveAll(cards);
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡补种（2026-09-09）：老档卡库可能从未播入第八批能力卡本体（TT8_KEY 标记
    // 已存在时 seedBatch 整批跳过，卡库缺卡不再自愈）。每次启动幂等补种：
    // 按 id 缺失则补入定义，已存在但类型还是旧「英雄卡」则就地修正。
    // 只动 11 张能力卡本体，不碰衍生牌与玩家自建卡。
    ensureAbilityCards() {
      try {
        const cards = SDT.Cards.all();
        let dirty = false;
        SDT.Cards.TABLETOP8.forEach(d => {
          if (!d.hero) return;
          const i = cards.findIndex(c => c.id === d.id);
          if (i < 0) { cards.push({ ...d }); dirty = true; }
          else if (cards[i].type !== '能力卡') { cards[i].type = '能力卡'; dirty = true; }
        });
        if (dirty) SDT.Cards.saveAll(cards);
      } catch (e) { /* 隐私模式等场景静默跳过 */ }
    },
  };

export { KEY };
