import SDT from './sdt-facade.js';
import { characterFor, CHARACTERS } from './characters.js';

  'use strict';
import { BUILD_VERSION, assetUrl } from './asset-url.js';
import { DATA } from './data-loader.js';

  
  const ROOT = 'assets/';
  const FALLBACK = 'ui/icons/question.png';
  // 映射数据外置 game/data/art-mapping.json（2026-09-11 架构批次 2）：
  // classIds/monsterIds/cardFamilies/resourceArt/heroCardArt/spellCardArt/martialCardArt/
  // creatureCardArt/equipCardArt/eventCardArt/itemArt 全部改由 data-loader 供给；
  // 关键口径注释：「千变万化」=cmtn1p9vb5au（实机定版 id）；降临者 6 张按实机制作坊新 id；
  // 盗匪横行用既有 event-bandits-anime-v2.webp；creature 映射只覆盖 foe-* 立绘外的图鉴生物。
  const CLASS_IDS = Object.freeze({ ...DATA.art.classIds });
  const CLASS_NAMES = Object.freeze(Object.fromEntries(Object.entries(CLASS_IDS).map(([name, id]) => [id, name])));
  const MONSTER_IDS = new Set(DATA.art.monsterIds);
  const CARD_FAMILIES = new Set(DATA.art.cardFamilies);
  const RESOURCE_ART = Object.freeze({ ...DATA.art.resourceArt });
  const HERO_CARD_ART = Object.freeze({ ...DATA.art.heroCardArt });
  const SPELL_CARD_ART = new Set(DATA.art.spellCardArt);
  const MARTIAL_CARD_ART = new Set(DATA.art.martialCardArt);
  const CREATURE_CARD_ART = new Set(DATA.art.creatureCardArt);
  const EVENT_CARD_ART = { ...DATA.art.eventCardArt };
  const EQUIP_CARD_ART = new Set(DATA.art.equipCardArt);
  const ITEM_ART = Object.freeze({ ...DATA.art.itemArt });
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
  { // 逐张空闲预解码，避免 18 张图片同时解码/上传造成启动长帧
    const groups = { enemies: Array.from(MONSTER_IDS) };
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
  xuanli: 'portraits/full/xuanli.webp',
  dengkui: 'portraits/full/dengkui.webp',
});
// 个别角色配 Q 版战斗头像（portraits/avatars/<角色id>.webp）：局内下边栏人物面板用
const AVATAR_ART = Object.freeze({
  shuangling: 'portraits/avatars/shuangling.webp',
  baiqi: 'portraits/avatars/baiqi.webp',
  lituan: 'portraits/avatars/lituan.webp',
  xuanli: 'portraits/avatars/xuanli.webp',
  dengkui: 'portraits/avatars/dengkui.webp',
});
// 战斗场景专用全身立绘：与角色选择页/档案立绘分开，保留战斗姿态和朝向。
const BATTLE_ART = Object.freeze({
  shuangling: 'portraits/battle/shuangling.webp',
  baiqi: 'portraits/battle/baiqi.webp',
  lituan: 'portraits/battle/lituan.webp',
  xuanli: 'portraits/battle/xuanli.webp',
  dengkui: 'portraits/battle/dengkui.webp',
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
      // 旧 11 职业立绘已随「以立绘为基准」清理下线，无法解析的历史职业一律走占位图
      return fallback('class', className, className || '未知职业');
    },
    // 角色选择页大幅立绘：全身像 portraits/full/<角色id>.webp，由 characterArt 供给
    classFullArt(className) {
      if(characterFor(className)) return characterArt(className,true);
      const id = resolveClass(className);
      if (!id) return image('cards/hero.webp', 'art-full', className || '未知角色', `class-full-${className || 'unknown'}`);
      return image('cards/hero.webp', 'art-full', CLASS_NAMES[id], `class-full-${id}`);
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
      const illustration = DATA.art.cardArtOverrides?.[cardId];
      if (illustration) return image(illustration, 'art-card-image art-hero-fit', card?.name || cardId, `card-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
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
      enemies: Object.freeze(Array.from(MONSTER_IDS, id => `portraits/enemies/${id}.webp`)),
      cards: Object.freeze(Array.from(CARD_FAMILIES, id => `cards/${id}.webp`))
    }),
    missingKeys
  };

export { ROOT, SDT, esc, missingKeys, reportMissing };
