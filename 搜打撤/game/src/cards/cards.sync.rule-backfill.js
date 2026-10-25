import { onPlayDefinition as R } from './card-rule-definitions.js';
import { KEY } from './cards.consts.js';
import { validateCardRules } from './card-rules.schema.js';
import { clone } from '../core/shared.js';
import { sameCardSnapshot as sameSnapshot } from './card-snapshot.js';

function selectRuleDefinitions(source, ids, accept) {
  return new Map(source.filter(card => ids.includes(card.id) && accept(card)).map(card => [card.id, card]));
}

/** Validate structured rule backfills before persisting; preserve explicit fields.
 * library/storage are lazy ports so callers may replace their active store. */
export function createCardRuleBackfillMigrations({ library, storage }) {
  function backfillStructuredRuleDefinitions({ markerKey, ids, definitions, domains, extraFieldsById = {}, canonicalFieldsById = {}, onlyMissingOnPlay = false }) {
    try {
      if (definitions.size !== ids.length) {
        console.error('[cards] Structured rule migration definitions missing:', ids.filter(id => !definitions.has(id)));
        return;
      }
      const marked = storage().getItem(markerKey) === '1';
      const cards = library().all();
      const foundIds = new Set();
      let dirty = false;
      const nextCards = cards.map(card => {
        const definition = definitions.get(card.id);
        if (!definition) return card;
        foundIds.add(card.id);
        if (onlyMissingOnPlay && Object.hasOwn(card.rules?.triggers || {}, 'onPlay')) return card;
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
        // M3 收编：运行时注入字段不参与深相等——ensureEffectFields 会给缺失的 dmg/heal/armor/draw
        // 补 0 占位，这类注入值随运行顺序出现/消失，若参与 JSON 比较会让迁移器每轮误判 dirty。
        // 结构性豁免：比较前把四字段的 0 值归一化剔除（非 0 真实字段仍参与比较）。
        const normalizeForCompare = obj => {
          const copy = clone(obj);   // 权威深拷贝（core/shared.js，2026-09-28 收敛时修复局部绑定）
          for (const field of ['dmg', 'heal', 'armor', 'draw']) {
            if (copy[field] === 0) delete copy[field];
          }
          return copy;
        };
        if (JSON.stringify(normalizeForCompare(card)) !== JSON.stringify(normalizeForCompare(nextCard))) dirty = true;
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
        try { saved = library().saveAll(nextCards); }
        catch (error) {
          console.error('[cards] Structured rule migration save failed; marker was not written:', error);
          return;
        }
        if (!saved) {
          console.error('[cards] Structured rule migration save returned false; marker was not written.');
          return;
        }
      }
      if (!marked) storage().setItem(markerKey, '1');
    } catch (error) {
      console.error('[cards] Structured rule migration failed; marker was not written:', error && error.message ? error.message : error);
    }
  }
  return {

    // E8：只给完整匹配当前定版的三张治疗卡添加地图背包规则，不改旧副本或玩家编辑。
    ensureE8FixedHealRules() {
      const markerKey = 'sdt-cards-e8-fixed-heal-bag-rules-v1-seeded';
      try {
        if (storage().getItem(markerKey) !== null) return;

        // all() 在读失败时可能降级并缓存 []；独立证明非空原库有效，避免把降级当成功。
        // 空库/缺库保持未标记，不补种。热缓存也必须与原库一致，不能迁移未保存的修改。
        const raw = storage().getItem(KEY);
        if (raw == null) return;
        const storedCards = JSON.parse(raw);
        if (!Array.isArray(storedCards) || storedCards.length === 0) return;
        if (storedCards.some(card => !card || typeof card !== 'object' || Array.isArray(card)
          || typeof card.id !== 'string' || !card.id)) return;
        if (new Set(storedCards.map(card => card.id)).size !== storedCards.length) return;
        const cards = library().all();
        if (!sameSnapshot(cards, storedCards)) return;

        // 数值与完整卡面取实际 TABLETOP 定义，不另存一份可漂移的数值表。
        const sources = [
          ['tt-jinchuangyao', library().TABLETOP10],
          ['tt4-woodify', library().TABLETOP10],
          ['starter-emergency-bandage', library().TABLETOP11],
        ];
        const definitions = new Map(sources.map(([id, source]) => [id, source.find(card => card.id === id)]));
        if ([...definitions.values()].some(definition => !definition)) return;
        let dirty = false;
        const nextCards = cards.map(card => {
          const definition = definitions.get(card.id);
          if (!definition || Object.prototype.hasOwnProperty.call(card, 'rules')
            || !sameSnapshot(card, definition)) return card;
          const nextCard = {
            ...card,
            rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } },
          };
          const validation = validateCardRules(nextCard);
          if (!validation.ok) throw new Error(`Invalid E8 fixed-heal rules for ${card.id}`);
          dirty = true;
          return nextCard;
        });

        // 构造/校验完成才单次保存，原 saveAll 继续负责拒绝并发库替换及损坏库写回。
        // 不原地改缓存；保存 false/抛错都不盖章。盖章前复读确认没有异常替换库串。
        if (dirty) {
          if (!library().saveAll(nextCards)) return;
          if (storage().getItem(KEY) !== JSON.stringify(nextCards)) return;
        } else if (storage().getItem(KEY) !== raw) return;
        storage().setItem(markerKey, '1');
      } catch (error) {
        console.error('[cards] E8 fixed-heal bag rule migration failed; marker was not written:', error);
      }
    },
    // TT10 基地材料规则回填：按稳定 id 从 TABLETOP10 定义取 rules，只补旧档规则字段。
    ensureTT10BaseMaterialRules() {
      const ids = ['tt3-wood-bundle', 'tt3-ration-double'];
      const definitions = new Map(
        library().TABLETOP10
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
      const definitions = new Map(library().TABLETOP
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
      const definitions = selectRuleDefinitions(library().TABLETOP10, ids, card => card.rules?.triggers?.onPlay);
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
      const definitions = selectRuleDefinitions(library().TABLETOP10, ids, card => card.rules?.triggers?.onPlay);
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
      const definitions = selectRuleDefinitions(library().TABLETOP10, ids, card => card.rules?.triggers?.onPlay);
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
      const sourceDefinitions = [...library().TABLETOP, ...library().TABLETOP3, ...library().TABLETOP11];
      const definitions = selectRuleDefinitions(sourceDefinitions, ids, card => card.rules?.bag?.use);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-bag-use-v2-seeded',
        ids,
        definitions,
        domains: ['bag'],
      });
      // 仅修正定版旧说明；自定义卡文保留，live-sync/旧批次重播后也可重试。
      try {
        const cards = library().all();
        const descriptionDefinitions = new Map([...definitions, ['tt3-mystery-potion', library().TABLETOP10.find(card => card.id === 'tt3-mystery-potion')]]);
        const legacy = new Map([
          ['tt-crystal', new Set(['在背包中才能使用，可以复原最多 3 张卡牌。', '复活最多 3 张卡牌。'])],
          ['cmtn6bge52qt', new Set(['在背包中才能使用，复原最多两张卡牌'])],
          ['tt3-mystery-potion', new Set(['随机神秘效果。', '回合开始时：变成1张随机招式卡牌，使其费用为0。'])],
        ]);
        const needsRevision = card => legacy.get(card.id)?.has(card.desc);
        if (cards.some(needsRevision)) {
          const saved = library().saveAll(cards.map(card => needsRevision(card)
            ? { ...card, desc: descriptionDefinitions.get(card.id).desc } : card));
          if (!saved) console.error('[cards] Restoration item description migration save returned false; will retry.');
        }
      } catch (error) {
        console.error('[cards] Restoration item description migration failed; will retry:', error);
      }

    },
    // TT12 出牌前规则字段回填：只补指定定版 id 的 rules，保留旧档自定义文案与其他字段。
    ensureTT12PreplayRules() {
      const ids = ['tt12-barriermend', 'tt12-backupcell'];
      const definitions = selectRuleDefinitions(library().TABLETOP12, ids, card => card.rules && card.rules.battle);
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
      const definitions = selectRuleDefinitions(library().TABLETOP12, ids, card => card.rules?.triggers?.onPlay);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-onplay-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
        extraFieldsById: { 'tt12-firecracker': ['dmgType'] },
      });
      const backupCell = library().TABLETOP12.find(card => card.id === 'tt12-backupcell');
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-backupcell-onplay-v1-seeded',
        ids: ['tt12-backupcell'],
        definitions: new Map(backupCell ? [[backupCell.id, backupCell]] : []),
        domains: ['battle', 'triggers'],
        onlyMissingOnPlay: true,
      });
    },
    ensureTT12DiscoverRules() {
      const ids = ['tt12-hitechrd'];
      const definitions = selectRuleDefinitions(library().TABLETOP12, ids, card => card.rules?.triggers?.onPlay);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-tt12-discover-v1-seeded',
        ids,
        definitions,
        domains: ['battle', 'triggers'],
      });
    },

    // A3 卡牌规则迁移第一批（2026-09-25 老板令开工）：B1 纯伤害 / B2 多段与重复 /
    // B3 治疗护甲吸血，共 23 张文本路径/专支卡改结构化 rules（docs/cards/card-rules-v2-taxonomy-2026-09-25.md
    // §3 逐卡表筛选；解释器 v2 分支已接线——battle.resolution.js castSegment 段生成器）。
    // definitions 内联手写（cc-* 纯实机卡与 tt7-ironcharge 无代码常量定义，定版在
    // cards-sync.json——生成物勿手改，故统一走 ensure 回填而非卡表内联）。
    // 排除项：cc-demon / tt2-forestarrow（damage+自益组合的 battle.target 契约矛盾，
    // v2 schema 缺口记 A1 文档待补）；双版效果不一致卡只迁 A1 口径副本。
    ensureA3BattleRules() {
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

    // A3 第二批（B5 诅咒族，2026-09-25）：8 张可结构化诅咒卡迁移（curse op 解释分支已
    // 接线——battle.resolution.js resolveCurseOperation，底层走 combat.addCurse 与文本
    // 路径同一状态袋）。排除 15 张：混合目标契约缺口 5（破浪斩 noDrawNext/坚冰结界+
    // 抽牌/孢子城墙+护甲/毒药+抽牌/深渊诅咒条件抽牌/禁言术+抽牌）、G13 禁咒系 4
    // （抽到即施放无时点键）、H 白名单 2（诅咒之刃手牌聚合/腐化之种死亡转移）、
    // schema 表达力 3（毒爆纯引爆无载体/花鸩 double 强制 stacks 语义差/冰封千里已结构化）。
    ensureA3CurseRules() {
      const ENEMY_ONE = { target: { side: 'enemy', area: false } };
      const ENEMY_ALL = { target: { side: 'enemy', area: true } };
      const dmgOne = extra => R(ENEMY_ONE, [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        ...extra,
      ]);
      const definitions = new Map([
        ['tt3-venom-arrow', dmgOne([{ op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' }])],
        ['tt3-armor-rush', dmgOne([{ op: 'curse', curse: 'bleed', stacks: 2, target: 'chosenEnemy' }])],
        ['tt3-blood-arrow', dmgOne([{ op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy' }])],
        ['tt3-frost-slash', dmgOne([
          { op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' },
          { op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' },
        ])],
        ['tt3-ice-spike', dmgOne([{ op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy' }])],
        ['tt12-infectray', dmgOne([{ op: 'curse', randomKinds: 1, target: 'chosenEnemy' }])],
        ['tt3-nuke-ray', dmgOne([{ op: 'curse', randomKinds: 3, target: 'chosenEnemy' }])],
        ['tt3-thornfield', R(ENEMY_ALL, [
          { op: 'curse', curse: 'poison', stacks: 2, burst: 1, target: 'allEnemies' },
        ])],
      ]);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-a3-curse-rules-v1-seeded',
        ids: [...definitions.keys()],
        definitions,
        domains: ['battle', 'triggers'],
      });
    },

    // A3 第三/四批（B6 卡牌获取 + B7 增益能量，2026-09-25 深夜）：16 张迁移
    // （acquire 12 + blessing/energy 4；解释分支已接线——resolveAcquireOperation/
    // resolveBlessingOperation，pool 谓词走 parsePoolNoun 与文本路径同源）。
    // 排除记账：挖宝 priceArmor/武装 deckDraw/破进展三段费用无键、灵能召唤"注能卡"
    // 池名词不支持（parsePoolNoun 需扩）、满月形态 V（natureForm 形态旗标耦合）、
    // 净化无 purify 键、割蚀/影噬为敌方 atk 操作（blessing 无 target 键）、
    // 剑仙形态 G13、邪能护体注能门高危（N1 明星卡，注能白嫖风险）、H 白名单 3。
    // schema 交叉点：铁甲阵 armor 与潜匿 draw 用字面量 amount（field-anchored 不得
    // 与 pending op 混排——amount 与字段值一致仍满足 declaresField 契约）。
    ensureA3AcquireBlessingRules() {
      const ENEMY_ONE = { target: { side: 'enemy', area: false } };
      const SELF = { target: { side: 'self', area: false } };
      const acquire = (n, kind, dest, act) => ({ op: 'acquire', n, pool: { kind }, dest, ...(act ? { act } : {}) });
      const dmgOne = extra => R(ENEMY_ONE, [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        ...extra,
      ]);
      const definitions = new Map([
        // —— B6 卡牌获取 ——
        ['cc-dual-wield', R(SELF, [acquire(1, '招式', 'discover', 'dup')])],
        ['tt3-flux-slash', dmgOne([
          { op: 'curse', curse: 'bleed', stacks: 2, target: 'chosenEnemy' },
          acquire(1, '流光照影', 'deck'),
        ])],
        ['tt3-life-arrow', dmgOne([acquire(1, '随机', 'hand')])],
        ['cmtn1i64j7y7', R(SELF, [acquire(1, '装备', 'discover')])],
        ['tt7-ironphalanx', R(SELF, [
          { op: 'armor', amount: 10 },
          acquire(5, '随机', 'deck', 'costMinusOne'),
        ])],
        ['tt7-twinfireball', dmgOne([acquire(2, '火球', 'hand')])],
        ['cmtn1gfhczzj', R(SELF, [acquire(1, '能施加诅咒的招式', 'hand')])],
        ['tt12-basicdev', R(SELF, [acquire(2, '0费招式', 'hand')])],
        ['tt3-treasure-hunt', dmgOne([acquire(1, '随机', 'discover')])],
        ['cc-lava-blast', dmgOne([acquire(1, '二次爆炸', 'hand')])],
        ['cmtn125e1nk0', R(SELF, [acquire(1, '传说', 'discover')])],
        ['tt12-magicfind', R(SELF, [acquire(1, '1费招式', 'discover', 'zeroCost')])],
        // —— B7 增益·祝福·能量 ——
        ['tt7-stealth', R(SELF, [
          { op: 'blessing', key: 'stealth', duration: 1 },
          { op: 'draw', amount: 1 },
        ])],
        ['cmtn1ntxzoc4', R(SELF, [{ op: 'blessing', key: 'spellUp' }])],
        ['tt7-energize', R(SELF, [{ op: 'energy', n: 1 }])],
        ['tt3sp-dodge', R(SELF, [{ op: 'blessing', key: 'dodge' }])],
      ]);
      backfillStructuredRuleDefinitions({
        markerKey: 'sdt-cards-a3-acquire-bless-rules-v1-seeded',
        ids: [...definitions.keys()],
        definitions,
        domains: ['battle', 'triggers'],
      });
    },
  };
}
