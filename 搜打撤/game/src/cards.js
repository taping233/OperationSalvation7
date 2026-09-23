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

let _cardsCache = null;   // all() 的内存缓存，见 all() 处注释（随存储层留壳）
import { KEY, TT2_KEY_V3, TT1_KEY_V6, TT4_KEY_V2, TT3_KEY_V5, TT5_KEY, TT6_KEY, TT7_KEY, TT7_KEY_V2, TT8_KEY, TT9_KEY, TT10_KEY, TT11_KEY, ITEM_RENAME_KEY, EVENTS_0919_KEY, TT12_KEY, RETIRE_TT10, RETIRE_TT11, CC_KEY, CLASSES } from './cards.consts.js';
import { rulesSlice } from './cards.rules.js';
import { dataSlice } from './cards.data.js';
import { syncSlice } from './cards.sync.js';
import { validateCardRules } from './card-rules.schema.js';

let _cardsCacheRaw = null;

function restoreLastValidCardsCache() {
  if (_cardsCacheRaw == null) {
    _cardsCache = null;
    return;
  }
  try { _cardsCache = JSON.parse(_cardsCacheRaw); }
  catch (e) { _cardsCache = null; }
}

function assertValidCardRules(cards) {
  for (const card of cards) {
    if (!card || card.rules === undefined) continue;
    const result = validateCardRules(card);
    if (!result.ok) {
      const details = result.errors
        .map(error => `${error.cardId} ${error.path}: ${error.message}`)
        .join('; ');
      const error = new Error(`Invalid card rules: ${details}`);
      error.name = 'CardRulesValidationError';
      throw error;
    }
  }
}
  SDT.Cards = {
    ...rulesSlice,
    ...dataSlice,

    all() {
      // 内存缓存（2026-09-07 性能）：卡库全量存 localStorage（数百张含全部描述文本），
      // 每张卡渲染时 rarityOf/sellPrice/isHeroLine 都会调 all() 全量 JSON.parse——
      // 战斗页一次 render 按「手牌衍生/能力卡数 ×2-3」放大解析次数。
      // 写路径由 saveAll / clearAll 同步缓存；序列化快照用于写失败时撤销调用方
      // 对 all() 缓存数组做过的原地修改。冷加载时仅校验一次，热读取不重复扫描。
      if (_cardsCache) return _cardsCache;
      let raw;
      let cards;
      try {
        raw = localStorage.getItem(KEY);
        cards = JSON.parse(raw) || [];
      } catch (e) {
        _cardsCache = [];
        _cardsCacheRaw = '[]';
        return _cardsCache;
      }
      // 规则错误必须显式中断加载，保留原始 localStorage 内容供诊断/修复；
      // 这里与 JSON 解析失败分开，避免把有效但含未知规则版本的卡库当空库。
      assertValidCardRules(cards);
      _cardsCache = cards;
      _cardsCacheRaw = JSON.stringify(cards);
      return _cardsCache;
    },

    // 写入走安全封装（迭代评审 09-20 G-P2）：配额满时裸写曾抛未捕获异常、卡牌设计器无声失败

    // 写入走安全封装（迭代评审 09-20 G-P2）：配额满时裸写曾抛未捕获异常、卡牌设计器无声失败
    saveAll(cards) {
      try { assertValidCardRules(cards); }
      catch (e) {
        restoreLastValidCardsCache();
        throw e;
      }
      try {
        const serialized = JSON.stringify(cards);
        localStorage.setItem(KEY, serialized);
        _cardsCache = cards;
        _cardsCacheRaw = serialized;
        return true;
      } catch (e) {
        restoreLastValidCardsCache();
        console.error('[cards] 自定义卡库保存失败（存储空间可能已满）：', e);
        return false;
      }
    },


    upsert(card) {
      const cards = SDT.Cards.all().slice();
      if (!card.id) card.id = 'c' + Date.now().toString(36) + Math.floor(Random.random('identity') * 46656).toString(36);
      const i = cards.findIndex(c => c.id === card.id);
      if (i >= 0) cards[i] = card; else cards.push(card);
      SDT.Cards.saveAll(cards);
      return card;
    },


    remove(id) { SDT.Cards.saveAll(SDT.Cards.all().filter(c => c.id !== id)); },


    clearAll() { _cardsCache = null; _cardsCacheRaw = null; localStorage.removeItem(KEY); },

    // ---- 卡背图案（v0.21）：默认「行囊粗布」恒解锁，其余由成就领取解锁 ----
    // emblem 印在卡背中央；from 说明解锁途径（基地成就页展示）。

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

    // 卡背/卡面渲染已外迁 cards.view.js（2026-09-11 架构批次 1：视图与数据分离）。
    // SDT.Cards 上保留同名转发，既有调用方（SDT.Cards.cardHTML 等）不受影响。
    cardBackHTML,
    cardHTML,

    // 播入初始牌「初始攻击」（只播一次，之后删改都尊重玩家）
    // 网页版卡牌库的修改同步进定版数据（老板 2026-09-09 拍板的机制）——
    // 数据由 scripts/sync-cards-from-live.mjs 生成写入 JSON，本文件只负责播种。
    // 沿用 TABLETOP10/11 模式：按 id 整卡覆盖 + 缺失补种 + RETIRE 退役；KEY 变更让旧环境重播。
    CARDS_SYNC: DATA.cardsSync.cards,
    RETIRE_CARDS_SYNC: DATA.cardsSync.retire,

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
      SDT.Cards.seedBatch(SDT.Cards.TABLETOP12, TT12_KEY, 'tt12'); // 第十二批：射线/研发系列新卡 17 张（2026-09-23）；新 KEY 老档补播，放最后以本批定稿为准
      SDT.Cards.ensureTT12PreplayRules(); // 从定版定义补齐 TT12 的出牌前规则与即时效果规则
      SDT.Cards.ensureTT10BaseMaterialRules(); // 从 TT10 定版定义补齐两张材料卡规则
      SDT.Cards.ensureTT1BaseMaterialRules(); // 从第一批定版定义补齐六张基地材料卡规则
      SDT.Cards.ensureTT10OnPlayRules(); // 从 TT10 定版定义补齐包扎、坚守的有序即时效果规则
      SDT.Cards.ensureBagUseRules(); // 从代码定版定义补齐两张背包道具的使用规则
      SDT.Cards.ensureTT7MultiHitRules(); // TT7 多段攻击与偷袭卡按稳定 id 补齐旧卡规则
      SDT.Cards.ensureTT7StatusRules(); // 冰封千里按稳定 id 补齐群体冰冻规则
      SDT.Cards.ensureTT12DiscoverRules(); // 高端研发按稳定 id 补齐发现与逐回合降费规则
    },

    // 职业稀有度迁移（设计者 2026-09-04 定版）：老档里第七批职业卡（tt7- 前缀）
    // 还带着 初始/古朴/稀有 旧稀有度，一次性统一改为「职业」（黑棱形）。
    // 只改 rarity 字段，不覆盖玩家在制作坊改过的名字与描述；一次性运行，
    // 之后玩家手动改稀有度不再被纠正。
    ...syncSlice,
  };

export { KEY };
