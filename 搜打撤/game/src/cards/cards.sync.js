/* 由 cards.js 拆出（2026-09-22 六文件重构批2）：启动期回填迁移与播种（ensure* / seedBatch / apply* / heroOf）。
 * 逐字搬迁，属性顺序=原文件顺序；在壳 cards.js 中展开装配为 SDT.Cards，键面与数据字节不变。 */
const SDT = window.SDT;   // ESM 垫片（与 cards.js 同源，main.js 加载顺序保证已存在）
import { TT7_KEY_V2, TT10_KEY, TT11_KEY, ITEM_RENAME_KEY, EVENTS_0919_KEY, RETIRE_TT10, RETIRE_TT11, CC_KEY, CLASSES } from './cards.consts.js';
import { Random } from '../core/random.js';
import { DATA } from '../core/data-loader.js';
import { validateCardRules } from './card-rules.schema.js';
// 历史批次 key 可能独立重播；即使 live-sync 已标记，也不能写回旧语义或复活退役卡。
// 同 id 以定版字段为准，定版未携带的 art 等仓库元数据继续取历史快照。
const cardsSyncById = new Map(DATA.cardsSync.cards.map(card => [card.id, card]));
const cardsSyncRetired = new Set(DATA.cardsSync.retire);
const canonicalTabletopSnapshot = (snapshot) => {
  if (cardsSyncRetired.has(snapshot.id)) return null;
  const current = cardsSyncById.get(snapshot.id);
  return current ? { ...snapshot, ...current } : snapshot;
};
function backfillStructuredRuleDefinitions({ markerKey, ids, definitions, domains, extraFieldsById = {}, canonicalFieldsById = {} }) {
  try {
    if (definitions.size !== ids.length) {
      console.error('[cards] Structured rule migration definitions missing:', ids.filter(id => !definitions.has(id)));
      return;
    }
    const marked = localStorage.getItem(markerKey) === '1';
    const cards = SDT.Cards.all();
    const foundIds = new Set();
    let dirty = false;
    const nextCards = cards.map(card => {
      const definition = definitions.get(card.id);
      if (!definition) return card;
      foundIds.add(card.id);
      const nextCard = { ...card };
      const operations = [
        ...(definition.rules?.triggers?.onPlay || []),
        ...(definition.rules?.bag?.use || []),
      ];
      const fields = new Set([
        ...operations.map(operation => operation.amountField).filter(Boolean),
        ...(extraFieldsById[card.id] || []),
      ]);
      for (const field of fields) {
        if ((nextCard[field] === undefined || nextCard[field] === null) && definition[field] !== undefined) {
          nextCard[field] = definition[field];
        }
      }
      for (const field of canonicalFieldsById[card.id] || []) {
        if (definition[field] !== undefined) nextCard[field] = definition[field];
      }

      if (nextCard.rules !== undefined && (!nextCard.rules || typeof nextCard.rules !== 'object' || Array.isArray(nextCard.rules))) {
        console.error(`[cards] Structured rule migration failed for ${card.id} at rules: expected an object.`);
        return null;
      }
      const rules = nextCard.rules || {};
      const nextRules = { ...rules, version: definition.rules.version };
      for (const domain of domains) {
        const current = rules[domain];
        if (current !== undefined && (!current || typeof current !== 'object' || Array.isArray(current))) {
          console.error(`[cards] Structured rule migration failed for ${card.id} at rules.${domain}: expected an object.`);
          return null;
        }
        nextRules[domain] = { ...(current || {}), ...(definition.rules[domain] || {}) };
      }
      nextCard.rules = nextRules;
      if (JSON.stringify(card) !== JSON.stringify(nextCard)) dirty = true;
      return nextCard;
    });

    if (foundIds.size !== ids.length) {
      console.error('[cards] Structured rule migration cards missing:', ids.filter(id => !foundIds.has(id)));
      return;
    }
    if (nextCards.some(card => card === null)) return;
    for (const card of nextCards) {
      if (!ids.includes(card.id)) continue;
      const result = validateCardRules(card);
      if (!result.ok) {
        const details = result.errors.map(error => `${error.cardId} ${error.path}: ${error.message}`);
        console.error('[cards] Structured rule migration validation failed:', details);
        return;
      }
    }
    if (dirty) {
      let saved = false;
      try { saved = SDT.Cards.saveAll(nextCards); }
      catch (error) {
        console.error('[cards] Structured rule migration save failed; marker was not written:', error);
        return;
      }
      if (!saved) {
        console.error('[cards] Structured rule migration save returned false; marker was not written.');
        return;
      }
    }
    if (!marked) localStorage.setItem(markerKey, '1');
  } catch (error) {
    console.error('[cards] Structured rule migration failed; marker was not written:', error && error.message ? error.message : error);
  }
}
export const syncSlice = {

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
      } catch { /* 存储不可用时静默跳过 */ }
      SDT.Cards.seedBatch([SDT.Cards.SHA], 'sdt-cards-sha-seeded');
    },

    // 卡牌库为空或缺少初始牌时，补入新手卡

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 敌人图鉴同步（2026-09-09 老板定版：新世界观命名 + 五层分布）。
    // foe-* 卡名与描述派生自 mapData.js 怪物表（非玩家自制内容），按 id 从 BESTIARY
    // 同步 name/desc 并补种缺失条目（新增能力者白鸦/烛火/静默/回声），每次启动幂等执行
    // （沿用 ensureShieldToArmor 惯例），保证老存档也拿到新文案与新图鉴；
    // 其他字段与玩家在制作坊的改动不受影响。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 护盾→护甲术语迁移（设计者 2026-09-04 定版：护盾与护甲同义，统一为护甲；
    // 战后护甲清零）。每次启动把卡牌描述里的「护盾」改写为「护甲」，幂等。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 「杀」→「初始攻击」术语迁移（2026-09-09 老板定版：效果文本统一写作「初始攻击」，
    // 卡池无「杀」类型，选牌/释放按卡名匹配）。每次启动幂等改写存量卡面描述。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 随机池防退回修正（卡库审计 2026-09-17 发现三，2026-09-25 修复）：石榴弹珠。
    // 老板 2026-09-13 拍板「石榴石弹珠卖价 3→4，并退出商店/发现池」（TABLETOP3 定义已带
    // unrandom: true），但定版覆盖批次 cards-sync.json 的 tt3-garnet-marble 无 unrandom
    // 字段，ensureCardsSyncLive 整卡覆盖会把该字段抹掉——资源/古朴卡 isRandomObtainable
    // 只看 unrandom，抹掉即退回商店随机槽位/发现/掉落池。每次启动幂等补回（改完即无
    // 目标，无需 key 标记），旧档、新库、定版升版重播后同口径防退回。
    ensureRandomPoolFixes() {
      try {
        const cards = SDT.Cards.all();
        const marble = cards.find(c => c.id === 'tt3-garnet-marble');
        if (marble && !marble.unrandom) {
          marble.unrandom = true;
          SDT.Cards.saveAll(cards);
        }
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 设计者定版数据修正（一次性）：爆燃火球描述未写注能收益，删除其注能字段

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
      } catch { /* 静默跳过 */ }
    },

    // 抉择卡数据修正（一次性，2026-09-08）：神灯的护甲只属于抉择 3°——
    // 结构化 armor 字段会让任何抉择分支都白送 5 甲，删除字段改由选项文本结算

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
      } catch { /* 静默跳过 */ }
    },

    // 第十批同步：设计者实机定版双向合并（TT10_KEY 标记，一次性）。按 id 整卡覆盖 + 缺失补种；
    // 本轮为老板拍板的定版动作，有意覆盖制作坊玩家改动（与 seedBatch 的「尊重玩家」语义不同）；
    // 并移除同设计重复 id（RETIRE，设计者已在旧 id 上定版同名卡）。

    // 第十批同步：设计者实机定版双向合并（TT10_KEY 标记，一次性）。按 id 整卡覆盖 + 缺失补种；
    // 本轮为老板拍板的定版动作，有意覆盖制作坊玩家改动（与 seedBatch 的「尊重玩家」语义不同）；
    // 并移除同设计重复 id（RETIRE，设计者已在旧 id 上定版同名卡）。
    ensureTabletopSync() {
      try {
        if (localStorage.getItem(TT10_KEY)) return;
        const cards = SDT.Cards.all();
        for (let i = cards.length - 1; i >= 0; i--) {
          if (RETIRE_TT10.includes(cards[i].id) || cardsSyncRetired.has(cards[i].id)) cards.splice(i, 1);
        }
        SDT.Cards.TABLETOP10.map(canonicalTabletopSnapshot).filter(Boolean).forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...d }; else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(TT10_KEY, '1');
      } catch { /* 隐私模式等场景静默跳过 */ }
    },
    // TT10 基地材料规则回填：按稳定 id 从 TABLETOP10 定义取 rules，只补旧档规则字段。
    ensureTT10BaseMaterialRules() {
      const ids = ['tt3-wood-bundle', 'tt3-ration-double'];
      const definitions = new Map(
        SDT.Cards.TABLETOP10
          .filter(card => ids.includes(card.id) && card.rules?.base?.material)
          .map(card => [card.id, { rules: card.rules }]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt10-base-material-v1-seeded',
        ids,
        definitions,
        domains: ['base'],
      });
    },
    // 第一批资源卡的定版材料数量：旧卡库保留玩家文案，只按稳定 id 补规则。
    ensureTT1BaseMaterialRules() {
      const ids = ['tt-keys-bunch', 'tt-key', 'tt-key-one', 'tt-wood', 'tt-wood-lots', 'tt-rations'];
      const definitions = new Map(SDT.Cards.TABLETOP
        .filter(card => ids.includes(card.id) && card.rules?.base?.material)
        .map(card => [card.id, card]));
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt1-base-material-v1-seeded',
        ids,
        definitions,
        domains: ['base'],
      });
    },
    // TT10 旧档即时效果规则回填：只迁稳定 id，从定版字段补足规则引用值。
    ensureTT10OnPlayRules() {
      const ids = ['tt3-bandage', 'tt3-hold-fast'];
      const definitions = new Map(
        SDT.Cards.TABLETOP10
          .filter(card => ids.includes(card.id) && card.rules?.triggers?.onPlay)
          .map(card => [card.id, card]),
      );
      if (definitions.size !== ids.length) {
        console.error('[cards] TT10 onPlay migration definitions missing:', ids.filter(id => !definitions.has(id)));
        return;
      }
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt10-onplay-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
      });
    },
    ensureTT7MultiHitRules() {
      const ids = ['tt7-thundergrudge', 'tt7-meteorrain', 'tt7-sneak'];
      const definitions = new Map(
        SDT.Cards.TABLETOP10
          .filter(card => ids.includes(card.id) && card.rules?.triggers?.onPlay)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt7-multihit-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
        canonicalFieldsById: {
          'tt7-thundergrudge': ['dmg', 'dmgType'],
          'tt7-meteorrain': ['dmg', 'dmgType'],
          'tt7-sneak': ['dmg', 'dmgType'],
        },
      });
    },
    ensureTT7StatusRules() {
      const ids = ['tt7-frozenight'];
      const definitions = new Map(
        SDT.Cards.TABLETOP10
          .filter(card => ids.includes(card.id) && card.rules?.triggers?.onPlay)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt7-status-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
      });
    },
    // 背包道具效果规则：定版真源来自原始 TABLETOP / TABLETOP3 定义，
    // TABLETOP10 的 cards-sync 字符串引用保持不变。
    ensureBagUseRules() {
      const ids = ['tt-crystal', 'tt3-savior-elixir', 'cmtn6bge52qt'];
      const sourceDefinitions = [...SDT.Cards.TABLETOP, ...SDT.Cards.TABLETOP3, ...SDT.Cards.TABLETOP11];
      const definitions = new Map(
        sourceDefinitions
          .filter(card => ids.includes(card.id) && card.rules?.bag?.use)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-bag-use-v2-seeded',
        ids,
        definitions,
        domains: ['bag'],
      });
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
          if (RETIRE_TT11.includes(cards[i].id) || cardsSyncRetired.has(cards[i].id) || cards[i].name === '新兵操典') cards.splice(i, 1);
        }
        SDT.Cards.TABLETOP11.map(canonicalTabletopSnapshot).filter(Boolean).forEach(d => {
          const i = cards.findIndex(c => c.id === d.id);
          if (i >= 0) cards[i] = { ...d }; else cards.push({ ...d });
        });
        SDT.Cards.saveAll(cards);
        localStorage.setItem(TT11_KEY, '1');
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

// ===== 实机定版覆盖批次（数据真源：game/data/cards-sync.json）=====
    // 网页版卡牌库的修改同步进定版数据（老板 2026-09-09 拍板的机制）——
    // 数据由 scripts/sync-cards-from-live.mjs 生成写入 JSON，本文件只负责播种。
    // 沿用 TABLETOP10/11 模式：按 id 整卡覆盖 + 缺失补种 + RETIRE 退役；KEY 变更让旧环境重播。
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
      } catch { /* 隐私模式等场景静默跳过 */ }
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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },
    // TT12 出牌前规则字段回填：只补指定定版 id 的 rules，保留旧档自定义文案与其他字段。
    ensureTT12PreplayRules() {
      const ids = ['tt12-barriermend', 'tt12-backupcell'];
      const definitions = new Map(
        SDT.Cards.TABLETOP12
          .filter(card => ids.includes(card.id) && card.rules && card.rules.battle)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-preplay-v1-seeded',
        ids,
        definitions,
        domains: ['battle'],
      });
      this.ensureTT12OnPlayRules();
    },
    // 独立版本标记，确保已完成 preplay-v1 的旧档也补到即时效果规则。
    ensureTT12OnPlayRules() {
      const ids = ['tt12-barriermend', 'tt12-firecracker'];
      const definitions = new Map(
        SDT.Cards.TABLETOP12
          .filter(card => ids.includes(card.id) && card.rules?.triggers?.onPlay)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-onplay-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
        extraFieldsById: { 'tt12-firecracker': ['dmgType'] },
      });
    },
    ensureTT12DiscoverRules() {
      const ids = ['tt12-hitechrd'];
      const definitions = new Map(
        SDT.Cards.TABLETOP12
          .filter(card => ids.includes(card.id) && card.rules?.triggers?.onPlay)
          .map(card => [card.id, card]),
      );
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-discover-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
      });
    },
    // 指定道具定名迁移：保留稳定 id 与存档引用，只更新展示名；
    // 旧内置金疮药并入正式 tt-jinchuangyao，避免仓库里继续存在两个定义。
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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 播入桌游手绘卡（第一批资源·道具 + 第二批装备/武术 + 第三批全套 + 第四/五批新设计）

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
      } catch { /* 隐私模式等场景静默跳过 */ }
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
          // 降临者：受缚之残影（原授印者英雄改归，2026-09-16 定版重做前名「邪渊主宰」）/ 充能火山（原降临者）
          'tt8-hero-descender': '降临者', 'tt8-hero-sealer': '降临者',
        };
        // ① id → 定版更名（与设计者实机卡库的最新命名对齐）
        const CC_RENAME = {
          'tt7-thundergrudge': '快意恩仇', 'tt7-swordimmortal': '剑仙形态', 'tt7-bloodpotion': '噬血术',
          'tt7-marchrush': '急行军', 'tt7-stratagem': '法师锦囊', 'tt7-bladebloom': '永恒绽放',
          'tt7-burnharvest': '爆燃火球', 'tt7-twinfireball': '三重火球', 'tt7-meteorstrong': '星陨之力',
          'tt8-hero-warlock': '禁术解放', 'tt8-hero-summoner': '花开两面', 'tt8-hero-warrior': '青龙化身',
          'tt8-hero-sealer': '受缚之残影', // 2026-09-16 定版重做（原 邪渊主宰·妲莉薇特，sync v21 起定版）
        };
        // ①" 定版重写描述（2026-09-16 定版重做：深海封印；对齐 cards-sync，防 CC key 升版重播退回旧描述）
        const CC_DESC = { 'tt8-hero-sealer': '深海封印：对战开始时，将本牌与四张「封印肢体」洗入牌库；手牌中集齐这 5 张封印之牌后破除封印，化为深渊主宰·妲莉薇特。无法打出。' };
        // ② 制作坊自建卡按卡名收编 → 职业（cls 从第七批同名定义反查）
        const CC_CONVERT = ['盗宝', '花瓣法阵', '千变万化', '厄运', '黑暗形态', '充能火球', '火焰形态', '致命射线', '风暴火球'];
        // ④ 退役（未入列旧职业卡 + 印记衍生牌×4；受缚之残影已改归降临者，不再退役；
        //    奥术残卷→法师、黑暗吊坠→降临者 2026-09-09 老板改判收编，从退役表移除；
        //    法力补给同批移除——09-09 已拍板白塔专属，留在表里会在 v3 重播时误删其 cls；
        //    圣光之源→牧师 2026-09-20 老板拍板星月专属，同理由移除；
        //    封印肢体1-4 同批移除——2026-09-16 定版重做后为活卡（受缚之残影封印衍生），
        //    留在表里会在 CC 升版重播时误伤，同法力补给先例）
        const CC_RETIRE = ['tt7-drunksong', 'tt7-naturestaff',
          'tt7-talisman', 'tt7-ironcharge', 'tt7-bloodthirst',
          'tt7-imitate', 'tt7-bloodblade'];
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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡查询（第八批）：heroOf(职业) 返回该职业的能力卡；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡，随机抽 1 张（如侠客：妄/云阳/云风）

    // 能力卡查询（第八批）：heroOf(职业) 返回该职业的能力卡；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡，随机抽 1 张（如侠客：妄/云阳/云风）
    heroOf(cls) {
      const heroes = SDT.Cards.all().filter(c => c.hero && c.cls === cls);
      return heroes.length ? heroes[Math.floor(Random.random('card') * heroes.length)] : null;
    },

    // 能力卡字段回填：早期制作坊保存会丢掉 cls/hero，导致专属立绘与 heroOf 失效。
    // 只按 id 补缺失的 cls / hero / tokenOf / unrandom，不覆盖玩家改过的名字与描述。
    // 另：任何 hero:true 但缺 cls 的卡（如旧对局存档里的副本来源），按 id/名称从能力卡定义表回填。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡术语迁移（设计者 2026-09-08 定版）：类型「英雄卡」整体更名「能力卡」。
    // 幂等（改完即无目标，无需 key 标记）：卡库由 ensureAbilityRename 处理，
    // 存档内的整卡副本（ownedCards / 仓库 stash / 消耗口袋 pocket）由读档路径调用本函数。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },


    ensureAbilityRename() {
      try {
        const cards = SDT.Cards.all();
        if (SDT.Cards.applyAbilityRename(cards)) SDT.Cards.saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡补种（2026-09-09）：老档卡库可能从未播入第八批能力卡本体（TT8_KEY 标记
    // 已存在时 seedBatch 整批跳过，卡库缺卡不再自愈）。每次启动幂等补种：
    // 按 id 缺失则补入定义，已存在但类型还是旧「英雄卡」则就地修正。
    // 只动 11 张能力卡本体，不碰衍生牌与玩家自建卡。

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
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // A3 卡牌规则迁移第一批（2026-09-25 老板令开工）：B1 纯伤害 / B2 多段与重复 /
    // B3 治疗护甲吸血，共 23 张文本路径/专支卡改结构化 rules（docs/card-rules-v2-taxonomy-2026-09-25.md
    // §3 逐卡表筛选；解释器 v2 分支已接线——battle.resolution.js castSegment 段生成器）。
    // definitions 内联手写（cc-* 纯实机卡与 tt7-ironcharge 无代码常量定义，定版在
    // cards-sync.json——生成物勿手改，故统一走 ensure 回填而非卡表内联）。
    // 排除项：cc-demon / tt2-forestarrow（damage+自益组合的 battle.target 契约矛盾，
    // v2 schema 缺口记 A1 文档待补）；双版效果不一致卡只迁 A1 口径副本。
    ensureA3BattleRules() {
      const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
      const ENEMY_ONE = { target: { side: 'enemy', area: false } };
      const ENEMY_ALL = { target: { side: 'enemy', area: true } };
      const SELF = { target: { side: 'self', area: false } };
      const dmgOne = extra => R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', ...extra }]);
      const definitions = new Map([
        // —— B1 伤害直结 ——
        ['tt2-shoot', dmgOne({})],
        ['tt3-execute', dmgOne({ cond: { foeHpBelow: 9 } })],   // 9 血以下才有伤害（伤害门）
        ['tt7-whirlwind', R(ENEMY_ALL, [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }])],
        ['tt3-arrow-rain', R(ENEMY_ALL, [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }])],
        ['tt3-reshot', dmgOne({})],
        ['tt7-smite', dmgOne({ bonus: { pct: 50, if: { foeHpHalf: true } } })],   // 全员受 10，半血受 15（bonus 非伤害门）
        ['cmtna0nb1yxt', dmgOne({})],
        ['tt3-fireball', dmgOne({})],   // 衍生牌；consumeFireball 等施放链走专支不经 onPlay，无波及
        ['cc-double-boom', R(ENEMY_ALL, [{ op: 'damage', amountField: 'dmg', target: 'allEnemies' }])],
        ['tt12-unstableray', { dmgType: 'spell', ...R(ENEMY_ONE, [{ op: 'damage', range: [4, 6], target: 'chosenEnemy' }]) }],
        // —— B2 多段与重复 ——
        ['tt3-double-shot', dmgOne({ hitCount: 3 })],
        ['tt3-chain-lightning', dmgOne({ hitCount: 2 })],
        ['cc-ember-burst', R(ENEMY_ALL, [{ op: 'damage', amountField: 'dmg', target: 'allEnemies', recast: { on: 'kill', times: 1 } }])],
        ['tt12-saturate', dmgOne({ recast: { on: 'kill', times: 1 } })],
        ['tt12-elemburst', { dmgType: 'spell', ...R(ENEMY_ONE, [{ op: 'damage', amount: 2, target: 'randomEnemy', hits: { range: [4, 5] } }]) }],
        // —— B3 治疗/护甲 ——
        ['tt2-bloodblade', dmgOne({ lifesteal: true })],
        ['tt7-bloodpotion', dmgOne({ lifesteal: true })],
        ['tt7-holyglow', R(SELF, [{ op: 'heal', upTo: 12 }])],
        ['cc-unmoved', R(SELF, [{ op: 'armor', amount: 4, guard: true }])],
        ['tt7-ironcharge', R(SELF, [{ op: 'armor', amountField: 'armor' }, { op: 'draw', amountField: 'draw' }])],
        ['tt7-bulwark', R(SELF, [{ op: 'armor', amountField: 'armor', decayAtTurnEnd: 4 }])],
        ['tt2-block', R(SELF, [{ op: 'armor', guard: true }])],
        ['tt3-holy-shield', R({ target: { side: 'self', area: false }, costModifiers: [{ kind: 'armorZeroFree' }] },
          [{ op: 'armor', amountField: 'armor' }])],
      ]);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-a3-battle-rules-v1-seeded',
        ids: [...definitions.keys()],
        definitions,
        domains: ['battle', 'triggers'],
        extraFieldsById: { 'tt12-unstableray': ['dmgType'], 'tt12-elemburst': ['dmgType'] },
      });
    },
};
