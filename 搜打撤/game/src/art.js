import SDT from './sdt-facade.js';
import { characterFor, CHARACTERS } from './characters.js';

  'use strict';
import { BUILD_VERSION, assetUrl } from './asset-url.js';

  
  const ROOT = 'assets/';
  const FALLBACK = 'ui/icons/question.png';
  const CLASS_IDS = Object.freeze({
    // 现役 5 职业（2026-09-05 职业整合）：侠客沿用剑客立绘
    '侠客':'sword','战士':'warrior','牧师':'priest','法师':'mage','降临者':'descend',
    // 旧职业名保留映射（老存档/图鉴兼容）：刺客→assassin 等
    '刺客':'assassin','剑客':'sword','术士':'warlock','授印者':'sealer',
    '召唤师':'summoner','守卫':'guard','游侠':'ranger'
  });
  const CLASS_NAMES = Object.freeze(Object.fromEntries(Object.entries(CLASS_IDS).map(([name, id]) => [id, name])));
  const MONSTER_IDS = new Set(['infantry','archer','bandit','cavalry','orc_jav','orc_axe','wolf_rider','fire_el','water_el','grass_el','dragon','esper_crow','esper_candle','esper_silence','esper_echo','boss_general','boss_orc','boss_elem']);
  const CARD_FAMILIES = new Set(['hero','event','martial-ranged','martial-melee','healing','spell','equipment-armor','equipment-weapon','equipment-utility','resource-key','resource-valuables','resource-material','consumable','unknown']);
  // 资源卡专属立绘（assets/cards/resources/<key>.webp），按稳定卡牌 id 绑定；
  // 卡牌名称允许在制作坊修改，但不能影响原始卡面资源。
  const RESOURCE_ART = Object.freeze({
    'starter-ration': 'ration-std',
    'tt-keys-bunch': 'keys-bunch',
    'tt-rations': 'ration',
    'tt-econpack': 'econpack',
    'tt-key': 'key',
    'tt-key-one': 'key-one',
    'tt-wood': 'wood',
    'tt-wood-lots': 'wood-lots',
    'tt-copper': 'coin-copper',
    'tt-silver': 'coin-silver',
    'tt-gold': 'coin-gold',
    'tt3-diamond': 'diamond',
    'tt3-garnet-marble': 'garnet-marble',
    'tt3-wood-bundle': 'wood-bundle',
    'tt3-ration-double': 'ration-double',
  });
  // 能力卡专属卡面（按稳定卡 id 绑定，优先于职业共用卡面；卡名可在制作坊修改，不影响映射）
  const HERO_CARD_ART = Object.freeze({
    'tt8-hero-summoner': 'hero-summoner', // 花开两面（法师）：与博览者的狂语同职业，需独立卡面
    'tt8-hero-assassin': 'wu-void',        // 遁入虚空（侠客·无）：卡名走实机同步，映射按 id 绑定
    'tt8-hero-sword': 'wu-myriadswords',   // 万剑归宗（侠客·无）
    'tt8-hero-ranger': 'wu-heavensword',   // 天剑诛魔（侠客·无）
  });
  // 职业专属法术卡面（2026-09-09 配图批次）：按稳定卡 id 绑定 assets/cards/spell-<id>.webp；
  // 命中即用专属插画（法师=白塔 / 降临者=常无欲出镜），未命中的法术仍走通用 spell/healing 家族图。
  // 降临者 6 张 id 按实机制作坊重做后的新 id 绑定（2026-09-09 老板实机定版）
  // 2026-09-09 晚：非角色专属的通用法术 24 张也全部配图实装（老板指令"全部实装"），
  // 至此卡牌库所有 type=法术 卡均有专属卡面，通用 spell.webp/healing.webp 仅作兜底
  const SPELL_CARD_ART = new Set([
    'cc-manasupply', 'cc-thousand', 'tt3-firm-barrier', 'tt7-arcanebolt',
    'tt7-bladebloom', 'tt7-elementstorm', 'tt7-energize', 'tt7-frozenight', 'tt7-recruit',
    'tt7-stratagem', 'tt3sp-shadowshot', 'tt7-abysscurse', 'tt7-burnharvest', 'tt7-meteorstrong',
    'tt7-twinfireball', 'tt3-flame-storm', 'tt3-nuke-ray',
    'cmtn1gfhczzj', 'cmtn1lbhbqi4', 'cmtn1ntxzoc4', 'cmtn1r10xnl1',
    'cmtn125e1nk0', 'cmtn1epgt20j', 'cmtn28jv33wx', 'cmtna0nb1yxt',
    'tt3-chain-lightning', 'tt3-fireball', 'tt3-grope', 'tt3-holy-water', 'tt3-ice-spike',
    'tt3-magic-lamp', 'tt3-nature-form', 'tt3-thornfield', 'tt3-thunderblast', 'tt3-toxin',
    'tt3-treasure-hunt', 'tt3sp-bloodstorm', 'tt3sp-dodge', 'tt3sp-flowerzhen', 'tt3sp-magicoil',
    'tt3sp-silverthorn', 'tt5-galaxy-voyage', 'tt7-drunksong', 'tt7-livingwater', 'tt7-maxsupply',
    'cmtn1p9vb5au', // 千变万化实机定版 id（cc-thousand 已退役，图同一张，2026-09-09）
    'tt8-curse1', 'tt8-curse2', 'tt8-curse3', 'tt8-curse4', // 禁咒 I-IV（牧师·修罗衍生牌，2026-09-09 同 seed 白塔念咒仅换背景色）
  ]);
  // 武术专属卡面（2026-09-09 批次）：按卡 id 绑定 assets/cards/martial-<id>.webp，侠客「无」出镜
  const MARTIAL_CARD_ART = new Set([
    'builtin-sha', // 初始攻击（全职业初始牌，2026-09-09 老板指定补卡面）
    'tt7-throwblade', 'tt7-goldencicada', 'tt7-sneak', 'tt7-ghostblade', 'tt7-thundergrudge',
    'tt7-meteorrain', 'tt7-stealth', 'tt7-swordimmortal', 'cmtn1i64j7y7', 'cmtn1wnhhym',
    // 通用武术补图批次（2026-09-09 晚，招式效果意象无人物；玄砾/灯葵未实装，其专属 10 张不做）
    'tt2-jianghu', 'tt2-swiftarrow', 'tt2-block', 'tt2-comboarrow', 'tt2-piercearrow', 'tt2-shoot',
    'tt2-turtlearmor', 'tt2-bloodblade', 'tt2-forestarrow',
    'tt3-blood-arrow', 'tt3-fatal-pierce', 'tt3-fly-arrowhawk', 'tt3-frost-slash', 'tt3-noon-duel',
    'tt3-armor-rush', 'tt3-double-shot', 'tt3-bandage', 'tt3-purify-arrow', 'tt3-arrow-rain',
    'tt3-wave-slash', 'tt3-qi-wave', 'tt3-hold-fast', 'tt3-life-arrow', 'tt3-dig-treasure',
    'tt3-reshot', 'tt3-venom-arrow', 'tt3-frostfall', 'tt3wu-shike', 'tt3-skewer',
    'tt3sp-shadowbug', 'tt3-flux-slash', 'tt3-execute',
    'cmtn0pbkmnvc', 'cmtn233trmeg', 'cmtn2jc142dj', 'cmtn0xt0zr7',
    'tt7-ironcharge', 'tt7-imitate', // 退役同名卡（图鉴展示用，招式意象通用版）
  ]);
  // 生物专属卡面（2026-09-09 补图批次）：按卡 id 绑定 assets/cards/creature-<id>.webp，
  // 覆盖无敌人立绘的图鉴生物（foe-* 14 张已有 portraits/enemies 立绘，不走此映射）
  const CREATURE_CARD_ART = new Set([
    'cmtn6ulm4boj', 'cmtn79743r2n', 'cmtn7err0a7',
    'tt8-healplus', 'tt8-energycap', 'tt8-nofocus', 'tt8-curseimmune',
  ]);
  // 事件专属卡面（2026-09-09 补图批次）：按卡 id 绑定 assets/scenes/event-<id>.webp 全屏场景大图
  // （2026-09-09 老板定向：事件图画成全屏大图，触发时整屏显示，牌库 cover 裁切显示同一张）；
  // 盗匪横行用既有 event-bandits-anime-v2.webp（更早批次专属图），不重生成
  const EVENT_CARD_ART = {
    'tt6-demondeal': 'event-tt6-demondeal', 'tt6-bandits': 'event-bandits-anime-v2',
    'tt6-mystery': 'event-tt6-mystery', 'tt6-goldmine': 'event-tt6-goldmine', 'tt6-goldhammer': 'event-tt6-goldhammer',
    'tt6-relief': 'event-tt6-relief', 'tt6-airdrop': 'event-tt6-airdrop', 'tt6-chestdraw': 'event-tt6-chestdraw',
    'tt6-systemsupply': 'event-tt6-systemsupply', 'cmtn7qttxqo4': 'event-cmtn7qttxqo4',
  };
  // 装备专属卡面（2026-09-09 批次）：按卡 id 绑定 assets/cards/equip-<id>.webp，物件特写
  const EQUIP_CARD_ART = new Set([
    'tt2-apollo', 'tt2-pearlbox', 'tt2-wreck', 'tt2-treasuremap', 'tt2-venomstaff', 'tt2-frostsword',
    'tt3-immortal-blade', 'tt3-master-staff', 'tt3-chaos-eye', 'tt3-silver-runesword', 'tt3-azure-sword',
    'tt3-deep-seal', 'tt3-fate-wheel', 'tt3-crimson-pouch', 'tt3-holy-staff', 'tt3-staff', 'tt3-dark-blade',
    'tt3-wolf-bow', 'tt3-sapper-bomb', 'tt3-twinwater-mail', 'tt3-grass-armor', 'tt3-blooddrinker',
    'tt3-longsword', 'tt3-element-seal', 'tt3-light-mail', 'tt3-reverse-bow', 'tt3-deep-diary',
    'tt3eq-boiler', 'tt3eq-mistbox', 'tt8-demonslay', 'tt8-archdemon', 'tt8-heavensword',
    'tt7-naturestaff', 'tt7-darkfort', 'tt7-arcanescroll', 'tt7-talisman',
  ]);
  const ITEM_ART = Object.freeze({
    'builtin-fuyuanyao': 'builtin-fuyuanyao',
    'starter-emergency-bandage': 'starter-emergency-bandage',
    'tt-crystal': 'tt-crystal',
    'tt-jinchuangyao': 'tt-jinchuangyao',
    'tt-medneedle': 'tt-medneedle',
    'tt-token-color': 'tt-token-color',
    'tt-token-gold': 'tt-token-gold',
    'tt3-blue-potion': 'tt3-blue-potion',
    'tt3-demon-potion': 'tt3-demon-potion',
    'tt3-houyi-potion': 'tt3-houyi-potion',
    'tt3-iceheart-potion': 'tt3-iceheart-potion',
    'tt3-mind-potion': 'tt3-mind-potion',
    'tt3-mixed-potion': 'tt3-mixed-potion',
    'tt3-mystery-potion': 'tt3-mystery-potion',
    'tt3-python-potion': 'tt3-python-potion',
    'tt3-savior-elixir': 'tt3-savior-elixir',
    'tt3-turnabout-potion': 'tt3-turnabout-potion',
    'tt3sp-doom': 'tt3sp-doom',
    'tt4-shine-token': 'tt4-shine-token',
    'tt4-smoke-bomb': 'tt4-smoke-bomb',
    'tt4-woodify': 'tt4-woodify',
    'cmtmvq6ss84l': 'cmtmvq6ss84l',       // 彩色令牌（2026-09-09 补图批次）
    'cmtn6bge52qt': 'builtin-fuyuanyao',  // 复原药水实机同卡：复用内置复原药水物件图
  });
  const missingKeys = new Set();
  const esc = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function reportMissing(kind, key) {
    const label = `${kind}:${String(key || '(empty)')}`;
    if (!missingKeys.has(label)) {
      missingKeys.add(label);
      console.error(`[SDT.Art] missing asset mapping: ${label}`);
    }
  }
  // 位图预解码池（用空间换时间）：warm(url) 把文件拉进缓存并提前解码，
  // 之后 <img> 首次渲染零解码延迟。重复 warm 同一地址直接跳过。
  const warmedUrls = new Set();
  function warm(urls) {
    for (let u of urls) {
      if (!u || warmedUrls.has(u)) continue;
      warmedUrls.add(u);
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { try { im.decode?.()?.catch?.(() => {}); } catch (_) {} };
      im.src = u;
    }
  }
  function image(src, cls, alt, key, style) {
    return `<img class="${esc(cls)}" src="${assetUrl(ROOT + src)}" alt="${esc(alt)}" data-asset-key="${esc(key)}"${style ? ` style="${esc(style)}"` : ''} draggable="false" loading="lazy" decoding="async">`;
  }
  function fallback(kind, key, alt) {
    reportMissing(kind, key);
    return image(FALLBACK, 'art-missing', alt || '美术资源缺失', `missing-${kind}-${key || 'empty'}`);
  }
  function cardFamily(card) {
    const name = String(card && card.name || '');
    const type = String(card && card.type || '');
    if (type === '能力卡') return 'hero';
    if (type === '生物') return 'creature';   // 敌人图鉴卡：按 art 字段取战场立绘
    if (type === '事件') return 'event';
    if (type === '武术') return /箭|射|弓/.test(name) ? 'martial-ranged' : 'martial-melee';
    if (type === '法术') return /治|愈|疗|回复/.test(name) ? 'healing' : 'spell';
    if (type === '装备') {
      if (/甲|盾|堡垒|龟/.test(name)) return 'equipment-armor';
      if (/剑|刃|刀|弓|箭|杖/.test(name)) return 'equipment-weapon';
      return 'equipment-utility';
    }
    if (type === '资源') {
      if (/钥匙/.test(name)) return 'resource-key';
      if (/币|钻石|令牌|水晶|弹珠/.test(name)) return 'resource-valuables';
      return 'resource-material';
    }
    if (type === '道具') return /药|绷带|医疗|急救|合剂|治伤/.test(name) ? 'healing' : 'consumable';
    return 'unknown';
  }
  function resolveClass(value) {
    if (CLASS_IDS[value]) return CLASS_IDS[value];
    if (CLASS_NAMES[value]) return value;
    return '';
  }

  // ---------- 战场立绘抠图：离线预烘，运行时只做路径映射 ----------
  // 预烘素材在 assets/portraits/cut/{classes,enemies}/（与源图同名），
  // 由 tools/bake-cutouts.js 生成（等比降采样 + 洪泛去纸色背景）；
  // 素材更新后重跑一次脚本即可。运行时零图像处理，预烘缺失时回退原图。
  const cutoutSrcFor = (src) => {
    // img.src 形如 "assets/portraits/<组>/<名>.webp"（image() 会补 assets/ 前缀）
    const m = /^assets\/portraits\/(classes|enemies)\/([^/]+)$/.exec(String(src || ''));
    return m ? `assets/portraits/cut/${m[1]}/${m[2]}` : null;
  };
  { // 逐张空闲预解码，避免 25 张图片同时解码/上传造成启动长帧
    const groups = { classes: Object.values(CLASS_IDS), enemies: Array.from(MONSTER_IDS) };
    const queue = Object.keys(groups).flatMap(group => groups[group].map(id => `assets/portraits/cut/${group}/${id}.webp`));
    const decoded = new Map(); // 持有引用，避免刚预解码完就被回收
    const schedule = (task) => {
      if (globalThis.scheduler && typeof globalThis.scheduler.postTask === 'function') {
        globalThis.scheduler.postTask(task, { priority: 'background' }).catch(() => setTimeout(task, 50));
      } else if (typeof requestIdleCallback === 'function') requestIdleCallback(task, { timeout: 3000 });
      else setTimeout(task, 50);
    };
    const next = () => {
      const src = queue.shift();
      if (!src) return;
      if (typeof Image === 'undefined') return;   // 非浏览器环境（单测等）直接放弃预解码，避免定时器报错
      const im = new Image();
      im.decoding = 'async';
      decoded.set(src, im);
      im.src = src;
      const ready = typeof im.decode === 'function'
        ? im.decode().catch(() => {})
        : new Promise(resolve => { im.onload = im.onerror = resolve; });
      ready.finally(() => schedule(next));
    };
    schedule(next);
  }


// 走运行时拷贝路径（portraits 在 RUNTIME_ASSET_DIRS），避免 new URL 哈希版与拷贝版双打包
const rosterUrl = assetUrl('assets/portraits/expedition-roster.webp');
// 个别角色配独立宽幅立绘（portraits/full/<角色id>.webp）：整张原图全图展示，不切远征队合影
const FIGURE_FULL_ART = Object.freeze({
  shuangling: 'portraits/full/shuangling.webp',
  baiqi: 'portraits/full/baiqi.webp',
  lituan: 'portraits/full/baita.webp',
});
// 个别角色配 Q 版战斗头像（portraits/avatars/<角色id>.webp）：局内下边栏人物面板用
const AVATAR_ART = Object.freeze({
  shuangling: 'portraits/avatars/shuangling.webp',
  baiqi: 'portraits/avatars/baiqi.webp',
  lituan: 'portraits/avatars/lituan.webp',
});
// 战斗场景专用全身立绘：与角色选择页/档案立绘分开，保留战斗姿态和朝向。
const BATTLE_ART = Object.freeze({
  shuangling: 'portraits/battle/shuangling.webp',
  baiqi: 'portraits/battle/baiqi.webp',
  lituan: 'portraits/battle/lituan.webp',
});
function characterArt(value, full=false) {
 const c=characterFor(value); if(!c)return null;
 const figure = FIGURE_FULL_ART[c.id];
 if (figure && full) {
   // 选人页大幅位：主体层铺满 + 同图模糊延伸层填满左侧空区（各图用自身色调向左晕开）
   const back = image(figure, 'art-figure-back', '', `figure-back-${c.id}`);
   const main = image(figure, 'art-figure', c.name, `figure-${c.id}`);
   return `<span class="art-figure-wrap figure-${c.id}">${back}${main}</span>`;
 }
 if (figure) return image(figure, 'art-figure', c.name, `figure-${c.id}`);
 const ranges=[[0,355],[338,672],[655,1010],[991,1397],[1380,1672]];
 const [left,right]=ranges[CHARACTERS.indexOf(c)],width=right-left;
 const position=left/(1672-width)*100;
 return `<span role="img" aria-label="${c.name}" class="roster-portrait ${full?'art-full':'art-portrait'}" style="background-image:url('${rosterUrl}');background-size:${1672/width*100}% 100%;background-position:${position}% center;--portrait-ratio:${width}/941;--roster-size:${1672/width*100}% 100%;--roster-position:${position}% center"></span>`;
}

  SDT.Art = {
    // 提前预载/解码位图（传 <img> 同款最终 URL），翻页/切页前调用可消掉首帧解码卡顿
    warm,
    classArt(className) {
      if(characterFor(className)) return characterArt(className);
      const id = resolveClass(className);
      if (!id) return fallback('class', className, className || '未知职业');
      return image(`portraits/classes/${id}.webp`, 'art-portrait', CLASS_NAMES[id], `class-${id}`);
    },
    // 角色选择页大幅立绘：全身像 portraits/full/<id>.webp（1038×1516 全身立绘烘焙版，688×1012）；
    // 缺失时回退半身像 portraits/classes/<id>.webp
    classFullArt(className) {
      if(characterFor(className)) return characterArt(className,true);
      const id = resolveClass(className);
      if (!id) return image('cards/hero.webp', 'art-full', className || '未知角色', `class-full-${className || 'unknown'}`);
      return image(`portraits/full/${id}.webp`, 'art-full', CLASS_NAMES[id], `class-full-${id}`);
    },
    // Q 版战斗头像：局内下边栏人物面板；未配置 Q 版的角色回退常规立绘
    classAvatarArt(className) {
      const c = characterFor(className);
      if (c && AVATAR_ART[c.id]) return image(AVATAR_ART[c.id], 'art-avatar', c.name, `avatar-${c.id}`);
      return this.classArt(className);
    },
    // 战斗场景全身立绘：缺失时回退角色常规立绘，避免旧角色/旧存档出现空位。
    battleArt(className) {
      const c = characterFor(className);
      if (c && BATTLE_ART[c.id]) return image(BATTLE_ART[c.id], 'art-portrait art-battle', c.name, `battle-${c.id}`);
      return this.classArt(className);
    },
    monsterArt(id) {
      if (!MONSTER_IDS.has(id)) return fallback('enemy', id, id || '未知敌人');
      return image(`portraits/enemies/${id}.webp`, 'art-portrait art-hostile', id, `enemy-${id}`);
    },
    has(id) { return Boolean(resolveClass(id)) || MONSTER_IDS.has(id); },
    // 全量卡面美术预热（2026-09-07 老板：能首次离线进内存的就不在用时计算）。
    // 复用渲染端同款生成器抽取最终 URL（含 ?v= 构建号），与 <img> 实际 src 完全一致，
    // 保证命中浏览器 HTTP/解码缓存。
    collectCardAssets(cards) {
      const urls = [];
      const push = (html) => { const m = /src="([^"]+)"/.exec(html || ''); if (m) urls.push(m[1]); };
      if (Array.isArray(cards)) for (const c of cards) { try { push(this.cardIcon(c)); } catch (_) {} }
      for (const id of MONSTER_IDS) { try { push(this.monsterArt(id)); } catch (_) {} }
      for (const name of Object.values(CLASS_NAMES)) {
        try { push(this.classFullArt(name)); } catch (_) {}
        try { push(this.classAvatarArt(name)); } catch (_) {}
        try { push(this.battleArt(name)); } catch (_) {}
      }
      return urls;
    },
    // 2026-09-08 老板：预热改启动时强制进行并显示进度。分小批加载+解码（decode 离线），
    // 每张完成即回调 onProgress(done,total)；已预热过的 URL 直接计入完成。
    warmBatched(urls, onProgress, batch = 6) {
      const list = [];
      const seen = new Set();
      for (const u of urls || []) {
        if (u && !seen.has(u) && !warmedUrls.has(u)) { seen.add(u); list.push(u); }
      }
      // 进度总数 = 待加载 + 已预热（调用方传去重前全量，done/grand 口径一致）
      const grand = (urls || []).length;
      let done = grand - list.length;   // 已预热过的先计入完成
      if (onProgress && grand) onProgress(done, grand);
      let i = 0;
      return new Promise((resolve) => {
        const next = () => {
          if (i >= list.length) { resolve(); return; }
          const slice = list.slice(i, i + batch);
          i += slice.length;
          let left = slice.length;
          const one = () => { done++; if (onProgress) onProgress(done, grand); if (!--left) next(); };
          for (const u of slice) {
            warmedUrls.add(u);
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => { try { im.decode?.()?.catch?.(() => {}); } catch (_) {} one(); };
            im.onerror = one;
            im.src = u;
          }
        };
        next();
      });
    },
    cardIcon(card) {
      const cardId = String(card && card.id || '');
      // 职业专属法术卡面（spell-<id>.webp，2026-09-09 配图批次）：优先于一切通用家族图，cover 填满
      if (SPELL_CARD_ART.has(cardId)) {
        return image(`cards/spell-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-spell-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 武术专属卡面（martial-<id>.webp，2026-09-09 批次）：侠客「无」出镜，cover 填满
      if (MARTIAL_CARD_ART.has(cardId)) {
        return image(`cards/martial-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-martial-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 装备专属卡面（equip-<id>.webp，2026-09-09 批次）：物件特写，cover 填满
      if (EQUIP_CARD_ART.has(cardId)) {
        return image(`cards/equip-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-equip-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 生物专属卡面（creature-<id>.webp，2026-09-09 补图批次）：无敌人立绘的图鉴生物，cover 填满
      if (CREATURE_CARD_ART.has(cardId)) {
        return image(`cards/creature-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-creature-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 事件专属卡面（event-<id>.webp，2026-09-09 补图批次）：全屏场景大图（assets/scenes/），cover 填满
      const eventArt = EVENT_CARD_ART[cardId];
      if (eventArt) {
        return image(`scenes/${eventArt}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-event-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      const itemKey = ITEM_ART[cardId] || '';
      if (itemKey) return image(`cards/items/${itemKey}.webp`, 'art-card-image', card && card.name || itemKey, `card-item-${itemKey}`, 'width:100%;height:100%;object-fit:contain;display:block');
      const resourceKey = RESOURCE_ART[cardId] || '';
      if (resourceKey) return image(`cards/resources/${resourceKey}.webp`, 'art-card-image', card && card.name || resourceKey, `card-${resourceKey}`, 'width:100%;height:100%;object-fit:cover;display:block');
      const family = cardFamily(card);
      if (!CARD_FAMILIES.has(family)) {
        // 生物图鉴卡：用敌人战场立绘（art 字段指向 MONSTER_IDS），无映射时回退爪印图标
        if (family === 'creature') {
          const artId = card && card.art;
          if (artId && MONSTER_IDS.has(artId)) {
            return image(`portraits/enemies/${artId}.webp`, 'art-card-image', card && card.name || artId, `card-foe-${artId}`, 'width:100%;height:100%;object-fit:cover;display:block');
          }
          return SDT.Icons.img('paw');
        }
        return fallback('card', family, card && card.name || '未知卡牌');
      }
      // 能力卡：优先按稳定卡 id 取专属卡面；其次按职业取专属立绘（assets/cards/hero-<职业id>.webp），缺失回退通用 hero.webp
      // art-hero-fit：卡面插画一律 cover 填满插画区（2026-09-09 老板要求装满；方图居中构图，裁切只裁背景色块）
      if (family === 'hero') {
        const heroArtKey = HERO_CARD_ART[cardId];
        if (heroArtKey) return image(`cards/${heroArtKey}.webp`, 'art-card-image art-hero-fit', card && card.name || heroArtKey, `card-${heroArtKey}`, 'width:100%;height:100%;object-fit:cover;display:block');
        let clsId = resolveClass(card && card.cls);
        // 实例副本可能丢失 cls（旧对局存档/旧版制作坊）：从卡牌库按 id、名称找回职业，
        // 保证每张能力卡始终使用各自专属的卡面（而非黄黑通用剪影）
        if (!clsId && window.SDT && SDT.Cards && SDT.Cards.all) {
          try {
            const src = SDT.Cards.all().find(c => c.id === card.id || c.name === card.name);
            if (src) clsId = resolveClass(src.cls);
          } catch (e) { /* 卡牌库不可用时静默回退 */ }
        }
        if (clsId) return image(`cards/hero-${clsId}.webp`, 'art-card-image art-hero-fit', card && card.name || clsId, `card-hero-${clsId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      return image(`cards/${family}.webp`, 'art-card-image', card && card.name || family, `card-${family}`, 'width:100%;height:100%;object-fit:cover;display:block');
    },
    gateIcon(ready) {
      const state = ready ? 'unlock' : 'lock';
      return image(`ui/icons/${state}.png`, 'art-gate-image', ready ? '宝藏大门可开启' : '宝藏大门未解锁', `gate-${state}`, 'width:100%;height:auto;display:block');
    },
    el(id, kind, cls) {
      return `<span class="art ${esc(cls || '')}">${kind === 'class' ? this.classArt(id) : this.monsterArt(id)}</span>`;
    },
    // ---------- 战场立绘：直接换用预烘抠图（缺失时回退原图，零主线程开销） ----------
    cutoutFigures(root) {
      (root || document).querySelectorAll('.sts-figure img').forEach(img => {
        const cut = cutoutSrcFor(img.getAttribute('src'));
        if (!cut || img.dataset.cut === cut) return;
        img.dataset.cut = cut;
        const orig = img.getAttribute('src');
        img.onerror = () => {   // 预烘图缺失/损坏：回退原图
          img.onerror = null;
          if (img.getAttribute('src') === cut) img.src = orig;
        };
        img.src = cut;
      });
    },
    cardFamily,
    manifest: Object.freeze({
      classes: Object.freeze(Object.values(CLASS_IDS).map(id => `portraits/classes/${id}.webp`)),
      enemies: Object.freeze(Array.from(MONSTER_IDS, id => `portraits/enemies/${id}.webp`)),
      cards: Object.freeze(Array.from(CARD_FAMILIES, id => `cards/${id}.webp`))
    }),
    missingKeys
  };

export { ROOT, SDT, esc, missingKeys, reportMissing };
