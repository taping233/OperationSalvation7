import { TT7_KEY_V2, ITEM_RENAME_KEY, CC_KEY, CLASSES } from './cards.consts.js';
import { createCardMigrationMarker } from './cards.sync.persistence.js';
import { MIGAO_FEN_ID, MIGAO_FEN_NAME } from '../core/creature-identity.js';

/** Historical terminology, class ownership and hero identity migrations.
 * library/storage are lazy ports so callers may replace their active store. */
export function createCardRenameMigrations({ library, storage, random }) {
  const markCardMigration = createCardMigrationMarker(storage);
  return {

    // 敌人图鉴同步（2026-09-09 老板定版：新世界观命名 + 五层分布）。
    // foe-* 卡名与描述派生自 mapData.js 怪物表（非玩家自制内容），按 id 从 BESTIARY
    // 同步 name/desc 并补种缺失条目（新增能力者白鸦/烛火/静默/回声），每次启动幂等执行
    // （沿用 ensureShieldToArmor 惯例），保证老存档也拿到新文案与新图鉴；
    // 其他字段与玩家在制作坊的改动不受影响。
    ensureFoeRename() {
      try {
        const cards = library().all();
        let dirty = false;
        library().BESTIARY.forEach(src => {
          const i = cards.findIndex(c => c.id === src.id);
          if (i < 0) { cards.push({ ...src }); dirty = true; return; }
          if (cards[i].name !== src.name || cards[i].desc !== src.desc) {
            cards[i].name = src.name;
            cards[i].desc = src.desc;
            dirty = true;
          }
        });
        if (dirty) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 护盾→护甲术语迁移（设计者 2026-09-04 定版：护盾与护甲同义，统一为护甲；
    // 战后护甲清零）。每次启动把卡牌描述里的「护盾」改写为「护甲」，幂等。
    ensureShieldToArmor() {
      try {
        const cards = library().all();
        let dirty = false;
        cards.forEach(c => {
          if (c.desc && String(c.desc).includes('护盾')) { c.desc = String(c.desc).replace(/护盾/g, '护甲'); dirty = true; }
        });
        if (dirty) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 「杀」→「初始攻击」术语迁移（2026-09-09 老板定版：效果文本统一写作「初始攻击」，
    // 卡池无「杀」类型，选牌/释放按卡名匹配）。每次启动幂等改写存量卡面描述。
    ensureShaToStarterAttack() {
      try {
        const cards = library().all();
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
        if (dirty) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },
    // 指定道具定名迁移：保留稳定 id 与存档引用，只更新展示名；
    // 旧内置金疮药并入正式 tt-jinchuangyao，避免仓库里继续存在两个定义。
    ensureItemRenames() {
      try {
        if (storage().getItem(ITEM_RENAME_KEY)) return;
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
        const cards = library().all();
        let dirty = false;
        for (let i = cards.length - 1; i >= 0; i--) {
          if (cards[i].id === 'builtin-jinchuangyao') { cards.splice(i, 1); dirty = true; continue; }
          const name = Object.hasOwn(names, cards[i].id) ? names[cards[i].id] : undefined;
          if (name && cards[i].name !== name) { cards[i].name = name; dirty = true; }
        }
        if (dirty && !library().saveAll(cards)) return;
        markCardMigration(ITEM_RENAME_KEY, cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 播入桌游手绘卡（第一批资源·道具 + 第二批装备/武术 + 第三批全套 + 第四/五批新设计）

    // 职业稀有度迁移（设计者 2026-09-04 定版）：老档里第七批职业卡（tt7- 前缀）
    // 还带着 初始/古朴/稀有 旧稀有度，一次性统一改为「职业」（黑棱形）。
    // 只改 rarity 字段，不覆盖玩家在制作坊改过的名字与描述；一次性运行，
    // 之后玩家手动改稀有度不再被纠正。
    ensureClassRarity() {
      try {
        if (storage().getItem(TT7_KEY_V2)) return;
        const defs = library().TABLETOP7;
        const cards = library().all();
        let dirty = false;
        cards.forEach((c) => {
          if (!defs.some(d => d.id === c.id)) return;
          if (c.rarity !== '职业') { c.rarity = '职业'; dirty = true; }
        });
        if (dirty && !library().saveAll(cards)) return;
        markCardMigration(TT7_KEY_V2, cards);
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
    ensureClassConsolidation() {
      try {
        if (storage().getItem(CC_KEY)) return;
        const cards = library().all();
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
        library().TABLETOP7.forEach(d => { if (d.cls) defByName[d.name] = d; });
        let dirty = false;
        // ① 按 id 改归属 / 更名 / 统一职业卡形态
        cards.forEach(c => {
          const cls = Object.hasOwn(CC_REASSIGN, c.id) ? CC_REASSIGN[c.id] : undefined;
          if (cls) {
            if (c.cls !== cls) { c.cls = cls; dirty = true; }
            if (c.rarity !== '职业') { c.rarity = '职业'; dirty = true; }
            if (!c.unrandom) { c.unrandom = true; dirty = true; }
          }
          const heroCls = Object.hasOwn(CC_HERO_REASSIGN, c.id) ? CC_HERO_REASSIGN[c.id] : undefined;
          if (heroCls && c.cls !== heroCls) { c.cls = heroCls; dirty = true; }
          const name = Object.hasOwn(CC_RENAME, c.id) ? CC_RENAME[c.id] : undefined;
          if (name && c.name !== name) { c.name = name; dirty = true; }
          const desc = Object.hasOwn(CC_DESC, c.id) ? CC_DESC[c.id] : undefined;
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
        const ccDefs = library().TABLETOP7.concat(library().TABLETOP8).filter(d => String(d.id || '').startsWith('cc-'));
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
        if (dirty && !library().saveAll(cards)) return;
        markCardMigration(CC_KEY, cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡查询（第八批）：heroOf(职业) 返回该职业的能力卡；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡，随机抽 1 张（如侠客：妄/云阳/云风）
    heroOf(cls) {
      const heroes = library().all().filter(c => c.hero && c.cls === cls);
      return heroes.length ? heroes[Math.floor(random.random('card', 'reward') * heroes.length)] : null;
    },

    // 能力卡字段回填：早期制作坊保存会丢掉 cls/hero，导致专属立绘与 heroOf 失效。
    // 只按 id 补缺失的 cls / hero / tokenOf / unrandom，不覆盖玩家改过的名字与描述。
    // 另：任何 hero:true 但缺 cls 的卡（如旧对局存档里的副本来源），按 id/名称从能力卡定义表回填。
    ensureHeroFields() {
      try {
        const defs = library().TABLETOP8;
        const cards = library().all();
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
        if (dirty) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡术语迁移（设计者 2026-09-08 定版）：类型「英雄卡」整体更名「能力卡」。
    // 幂等（改完即无目标，无需 key 标记）：卡库由 ensureAbilityRename 处理，
    // 存档内的整卡副本（ownedCards / 仓库 stash / 消耗区 pocket）由读档路径调用本函数。
    applyAbilityRename(cards) {
      let dirty = false;
      (Array.isArray(cards) ? cards : []).forEach(c => {
        if (c && c.type === '英雄卡') { c.type = '能力卡'; dirty = true; }
      });
      return dirty;
    },

    // 现役卡定名：同名不同效果追加「-改」；点名角色按稳定 id 更新身份。
    // 按稳定 id 迁移，避免名称本身再次参与身份判断；每次启动幂等执行，防止后续同步覆盖回旧名。
    applyDuplicateRenames(cards) {
      const names = { 'tt7-imitate': '不变应万变-改', 'cmtn1wnhhym': '江湖救急-改', 'cmtn28jv33wx': '搜索军用保险柜', [MIGAO_FEN_ID]: MIGAO_FEN_NAME };
      let dirty = false;
      (Array.isArray(cards) ? cards : []).forEach(card => {
        const name = card && Object.hasOwn(names, card.id) ? names[card.id] : undefined;
        if (name && card.name !== name) { card.name = name; dirty = true; }
      });
      return dirty;
    },


    ensureDuplicateRenames() {
      try {
        const cards = library().all();
        if (library().applyDuplicateRenames(cards)) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },


    ensureAbilityRename() {
      try {
        const cards = library().all();
        if (library().applyAbilityRename(cards)) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },

    // 能力卡补种（2026-09-09）：老档卡库可能从未播入第八批能力卡本体（TT8_KEY 标记
    // 已存在时 seedBatch 整批跳过，卡库缺卡不再自愈）。每次启动幂等补种：
    // 按 id 缺失则补入定义，已存在但类型还是旧「英雄卡」则就地修正。
    // 只动 11 张能力卡本体，不碰衍生牌与玩家自建卡。
    ensureAbilityCards() {
      try {
        const cards = library().all();
        let dirty = false;
        library().TABLETOP8.forEach(d => {
          if (!d.hero) return;
          const i = cards.findIndex(c => c.id === d.id);
          if (i < 0) { cards.push({ ...d }); dirty = true; }
          else if (cards[i].type !== '能力卡') { cards[i].type = '能力卡'; dirty = true; }
        });
        if (dirty) library().saveAll(cards);
      } catch { /* 隐私模式等场景静默跳过 */ }
    },
  };
}
