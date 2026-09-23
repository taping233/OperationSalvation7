/* 由 cards.js 拆出（2026-09-22 六文件重构批2）：模块级常量（迁移标记键/退役清单/职业表/存储键）。
 * 逐字搬迁；SDT.Cards 键面与数据字节不变，外部 API 仍由 cards.js 转出（export { KEY }）。 */
  const KEY = 'sdt-cards-v1';
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
  const TT11_KEY = 'sdt-cards-tt11-v6-seeded';   // 第十一批：与设计者实机卡库导出完全对齐（2026-09-09 老板拍板，见 TABLETOP11 注释）；v2：法力补给补 cls=法师（白塔专属）；v3：不变应万变补 cls=侠客（无专属，老板 2026-09-12 拍板）；v4：恶魔之力补 cls=牧师（星月专属，老板 2026-09-13 拍板）；v5：恶魔之力 tt7-drunksong 整卡退役（老板 2026-09-13 改拍板删除，同名双版收口只留 cc-demon）；v6：圣光之源补 cls=牧师（星月专属，老板 2026-09-20 拍板）——均换 key 重播让旧档拿到
  const ITEM_RENAME_KEY = 'sdt-cards-item-renames-v1'; // 2026-09-08：道具定名 + 金创药/金疮药合并
  const EVENTS_0919_KEY = 'sdt-events-0919-v2-seeded'; // 2026-09-19：都市污染事件池（10 旧事件改名 + 9 新事件）；v2：熔断双箱/隧道血契 desc 对齐实装口径（迭代评审 09-20 B-P0/P2）
  const TT12_KEY = 'sdt-cards-tt12-v1-seeded';         // 第十二批：射线/研发系列新卡 17 张（2026-09-23 老板卡表）；全新 KEY——老档未标记过，启动即补播（不进 cards-sync 数组）
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
export { KEY, TT2_KEY_V3, TT1_KEY_V6, TT4_KEY_V2, TT3_KEY_V5, TT5_KEY, TT6_KEY, TT7_KEY, TT7_KEY_V2, TT8_KEY, TT9_KEY, TT10_KEY, TT11_KEY, ITEM_RENAME_KEY, EVENTS_0919_KEY, TT12_KEY, RETIRE_TT10, RETIRE_TT11, CC_KEY, CLASSES };
