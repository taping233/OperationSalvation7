import SDT from './sdt-facade.js';
import { characterFor, CHARACTERS } from './characters.js';

  'use strict';
import { assetUrl } from './asset-url.js';
import { DATA } from './data-loader.js';
import ART_MANIFEST from '../generated/art-manifest.js';
import THUMB_MANIFEST from '../generated/thumb-manifest.js';
import { PERFORMANCE_BUDGETS } from './performance-budgets.js';

  
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
  // 龙巢敌人（2026-09-16 新增）暂无专属立绘，暂借同主题家族图：
  // 专属美术出图后，把对应 webp 放进 portraits/enemies/ 并把 id 加入 art-mapping.json monsterIds 即可接管
  const NEST_MONSTER_ALIASES = {
    'nest-dark-elem': 'water_el',      // 黑暗元素 → 水元素（深色系）
    'nest-sand-elem': 'grass_el',      // 沙暴元素 → 草元素（土系）
    'nest-dragon': 'dragon',           // 巨龙
    'nest-evil-dragon': 'dragon',      // 恶龙
    'nest-envoy': 'esper_crow',        // 黑暗使者 → 异能者·鸦
    'nest-ancient-dragon': 'dragon',   // 远古龙尊
    'nest-elem-lord': 'boss_elem',     // 完全形态·元素领主
    'nest-storm-hand': 'boss_elem',    // 风暴之手
  };
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
  const prefetchedUrls = new Set();
  // 持有已预热 Image 的引用：不持有时浏览器可能把刚解码完的位图回收，
  // 首次渲染又要重解码。池子上限兜底，超出按 FIFO 淘汰最早一批。
  // 2026-09-13 卡牌库卡顿排查：原上限 800 大于全量清单（496 张），等于把整份美术的
  // 解码位图全部钉死在内存里（实测渲染进程工作集 612MB→775MB，卡面一族解码后就要 918MB），
  // 浏览器解码缓存被挤到反复驱逐，滚动到新卡就得重新解码——这正是库页掉帧的主因。
  // 上限压到 128：预热仍把文件拉进 HTTP/磁盘缓存，但不再要求全部常驻解码位图。
  const warmPool = [];
  const WARM_POOL_CAP = PERFORMANCE_BUDGETS.retainedImageCountMax;
  // 解码位图字节预算：只按张数封顶挡不住大图——CSS 补热的 75 张 1080p 级场景图
  // 恰好落在预热尾声顶掉早期小图，128 张口径理论上可钉住数百 MB。按解码字节数
  // （naturalWidth×naturalHeight×4）双保险封顶，超预算从最旧开始淘汰。
  const WARM_POOL_BYTES = PERFORMANCE_BUDGETS.retainedImageBytesMax;
  let warmPoolBytes = 0;
  function releaseWarmedHead() {
    const im = warmPool.shift();
    if (!im) return;
    im.__released = true;
    warmPoolBytes -= im.__bytes || 0;
  }
  function retainWarmed(im) {
    warmPool.push(im);
    if (warmPool.length > WARM_POOL_CAP) releaseWarmedHead();
    // load 异步到账后才拿得到尺寸：到账时若已被淘汰（__released）则不再计账
    im.addEventListener('load', () => {
      if (im.__released) return;
      im.__bytes = (im.naturalWidth || 0) * (im.naturalHeight || 0) * 4;
      warmPoolBytes += im.__bytes;
      while (warmPool.length > 1 && (warmPoolBytes > WARM_POOL_BYTES || warmPool.length > WARM_POOL_CAP)) {
        releaseWarmedHead();
      }
    }, { once: true });
  }
  function warm(urls, options = true) {
    const retain = typeof options === 'object' ? options.retain !== false : options !== false;
    for (let u of urls) {
      if (!u || warmedUrls.has(u)) continue;
      warmedUrls.add(u);
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { try { im.decode?.()?.catch?.(() => { /* 解码失败：图已显示，忽略 */ }); } catch { /* decode 不可用：预热仅求提前缓存 */ } };
      // 加载失败立即出池（迭代评审 09-20 D-P3）：404 图曾永居预热池上限且无字节记账，
      // 资产缺失场景下预热池容量被无声侵占（字节尚未记账，无需扣减）
      im.onerror = () => {
        warmedUrls.delete(u);
        const at = warmPool.indexOf(im);
        if (at >= 0) { warmPool.splice(at, 1); im.__released = true; }
      };
      im.src = u;
      if (retain) retainWarmed(im);
    }
  }
  // 卡面缩略图（assets/thumbs/**，离线烘焙见 game/tools/bake-card-thumbs.cjs）：
  // 卡牌库网格的插画区被 CSS 钉死在 ≤215×165 CSS px，原图 896~1792 宽等于 4~17 倍过采样，
  // 解码时间与解码位图内存都白花（245 张卡面 = 918MB）。低倍率场景改取同相对路径的
  // 448 宽缩略图；放大看卡面（#cardZoom）、战斗与立绘仍走原图。
  // 清单里没有的图直接回退原图，保证新素材不改 art.js 也不会 404。
  const THUMBS = new Set(THUMB_MANIFEST);
  function image(src, cls, alt, key, style, low, defer) {
    // 缩略图统一使用 WebP；PNG/JPEG 源图的派生文件改为 .webp，避免扩展名与编码不匹配。
    const thumb = low && THUMBS.has(src.split('?')[0]);
    const thumbSrc = thumb ? src.replace(/\.(?:png|jpe?g)(?=\?|$)/i, '.webp') : src;
    const rel = thumb ? `thumbs/${thumbSrc}` : src;
    const url = assetUrl(ROOT + rel);
    const source = defer ? ` data-lib-src="${esc(url)}"` : ` src="${url}"`;
    return `<img class="${esc(cls)}"${source} alt="${esc(alt)}" data-asset-key="${esc(key)}"${style ? ` style="${esc(style)}"` : ''} draggable="false" loading="lazy" decoding="async">`;
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
      const url = assetUrl(src);
      if (warmedUrls.has(url)) { schedule(next); return; }
      warmedUrls.add(url);
      const im = new Image();
      im.decoding = 'async';
      // 敌人预解码也必须进入统一 LRU/字节预算；旧实现用独立 Map 永久钉住约 28.5MiB，
      // 导致 retainedImageBytesMax 并不是实际图片常驻上限。
      retainWarmed(im);
      im.src = url;
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
  wu: 'portraits/full/wu.webp',
  changwuyu: 'portraits/full/changwuyu.webp',
  baita: 'portraits/full/baita.webp',
  heixiang: 'portraits/full/heixiang.webp',
  xingyue: 'portraits/full/xingyue.webp',
});
// 皮肤立绘（2026-09-19 老板令）：角色 id → 备选皮肤立绘。
const SKIN_FULL_ART = Object.freeze({
  wu: Object.freeze([
    { id: 'casual', name: '春日·机车', file: 'portraits/full/wu-casual.webp' },
    { id: 'spring', name: '新春·旗袍', file: 'portraits/full/wu-spring.webp' },
    { id: 'beach', name: '盛夏·水枪', file: 'portraits/full/wu-beach.webp' },
  ]),
});
const activeSkins = {};   // classId -> skin id（未设置的用 default 主立绘）
function setActiveSkin(classId, skinId) {
  const c = characterFor(classId);
  if (!c) return false;
  if (!skinId || skinId === 'default') {
    delete activeSkins[c.id];
    return true;
  }
  if (!(SKIN_FULL_ART[c.id] || []).some(s => s.id === skinId)) return false;
  activeSkins[c.id] = skinId;
  return true;
}
function hydrateSelectedSkins(selectedSkins) {
  Object.keys(activeSkins).forEach(id => { delete activeSkins[id]; });
  Object.entries(selectedSkins || {}).forEach(([characterId, skinId]) => { setActiveSkin(characterId, skinId); });
  return Object.freeze({ ...activeSkins });
}
function activeFigureFile(c) {
  const skins = SKIN_FULL_ART[c.id];
  const want = skins && activeSkins[c.id];
  if (skins && want) {
    const hit = skins.find(s => s.id === want);
    if (hit) return hit.file;
  }
  return FIGURE_FULL_ART[c.id];
}
// 个别角色配 Q 版战斗头像（portraits/avatars/<角色id>.webp）：局内下边栏人物面板用
const AVATAR_ART = Object.freeze({
  wu: 'portraits/avatars/wu.webp',
  changwuyu: 'portraits/avatars/changwuyu.webp',
  baita: 'portraits/avatars/baita.webp',
  heixiang: 'portraits/avatars/heixiang.webp',
  xingyue: 'portraits/avatars/xingyue.webp',
});
// 战斗场景专用全身立绘：与角色选择页/档案立绘分开，保留战斗姿态和朝向。
const BATTLE_ART = Object.freeze({
  wu: 'portraits/battle/wu.webp',
  changwuyu: 'portraits/battle/changwuyu.webp',
  baita: 'portraits/battle/baita.webp',
  heixiang: 'portraits/battle/heixiang.webp',
  xingyue: 'portraits/battle/xingyue.webp',
});
function characterArt(value, full=false, useDefault=false) {
 const c=characterFor(value); if(!c)return null;
 // useDefault=true：强制用标准主立绘（如选人页底部头像条不跟随皮肤）
 const figure = useDefault ? FIGURE_FULL_ART[c.id] : activeFigureFile(c);
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
    // 提前预载/解码位图（传 <img> 同款最终 URL），翻页/切页前调用可消掉首帧解码卡顿。
    // opts.retain（默认 true）：把解码位图钉进预热池；CSS 背景图传 false——浏览器对
    // CSS background 有自己的图片缓存，JS 持引用帮不到它，只会白占内存。
    warm(urls, opts) { return warm(urls, !opts || opts.retain !== false); },
    // 性能探针只读口径：确认所有预解码图片都受同一张数/字节预算约束。
    warmStats() { return Object.freeze({ count: warmPool.length, bytes: warmPoolBytes, maxCount: WARM_POOL_CAP, maxBytes: WARM_POOL_BYTES }); },
    // 选人页五张 full 立绘预热（2026-09-19 走查 B8）：黑像/星月是 4K 横版图，
    // 首开现场解码慢，头像条/大立绘会先露底色（白/黑）几秒，观感像坏图。
    // openClassChoice 打开选人页前调用，与卡面预热同一解码池。
    warmClassRoster() { warm(Object.values(FIGURE_FULL_ART).map(p => assetUrl(ROOT + p))); },
    // 皮肤系统（2026-09-19）：列出某角色的皮肤；setSkin 切换后选人页立绘即时更换
    listSkins(classId) { const c = characterFor(classId); return (c && SKIN_FULL_ART[c.id]) || []; },
    setSkin(classId, skinId) { return setActiveSkin(classId, skinId); },
    getSkin(classId) { const c = characterFor(classId); return (c && activeSkins[c.id]) || 'default'; },
    hydrateSelectedSkins,
    skinUrl(classId, skinId) {
      const c = characterFor(classId);
      if (!c) return '';
      const hit = (SKIN_FULL_ART[c.id] || []).find(s => s.id === skinId);
      return hit ? assetUrl(ROOT + hit.file) : assetUrl(ROOT + FIGURE_FULL_ART[c.id]);
    },
    // 就地预解码某块 DOM 里已渲染的 <img>（卡牌库开页后补热用）：
    // 启动的全量预热清单补的是原图，库里显示的是 assets/thumbs/ 缩略图，不补这一步
    // 首轮滚动就要现场解码——实测首轮滚动 32~35fps → 44~45fps，长帧减半。
    // decode() 在解码线程上跑，不占主线程；lazy 的视口外图先改 eager 才会真的开始加载，
    // 否则 decode() 永远挂着。图已解码时 decode() 立即兑现，重复调用无副作用。
    // 2026-09-19 黑窗修复：战斗手牌冷启动时多图并发解码排队，img 加载完成后合成层
    // 仍可能缓存空栅格不失效（实测 complete=true 却持续黑窗，直到下一次布局变化才显形）。
    // decode() 兑现后微抖 opacity 强制该 img 重绘，把"位图就绪"同步成"像素上屏"。
    // 注意 decode() 对尚未开始加载的 img 会立即 reject（EncodingError），必须等 load
    // 事件后再 decode，否则挂载瞬间的首次调用全部静默落空。
    decodeIn(root) {
      const scope = root || document;
      if (!scope || !scope.querySelectorAll) return;
      scope.querySelectorAll('img[src]').forEach(im => {
        im.loading = 'eager';
        const shine = () => {
          if (!im.isConnected) return;
          // visibility 是 paint 属性：强制该 img 所在合成层失效重新光栅化。
          // opacity/transform 是合成器属性，抖动它们不会触发重绘（实测无效）。
          im.style.visibility = 'hidden';
          requestAnimationFrame(() => { im.style.visibility = ''; });
        };
        const kick = () => {
          try {
            const p = im.decode && im.decode();
            if (p && typeof p.then === 'function') p.then(shine).catch(() => { /* 解码失败：图片照常展示 */ });
          } catch { /* decode 抛错：高亮只是增强，跳过 */ }
        };
        if (im.complete && im.naturalWidth > 0) kick();
        else im.addEventListener('load', kick, { once: true });
      });
    },
    classArt(className, useDefault=false) {
      if(characterFor(className)) return characterArt(className, false, useDefault);
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
      const fid = NEST_MONSTER_ALIASES[id] || id;
      if (!MONSTER_IDS.has(fid)) return fallback('enemy', id, id || '未知敌人');
      return image(`portraits/enemies/${fid}.webp`, 'art-portrait art-hostile', id, `enemy-${fid}`);
    },
    has(id) { return Boolean(resolveClass(id)) || MONSTER_IDS.has(id) || !!NEST_MONSTER_ALIASES[id]; },
    // 全量卡面美术预热（2026-09-07 老板：能首次离线进内存的就不在用时计算）。
    // 复用渲染端同款生成器抽取最终 URL（含 ?v= 构建号），与 <img> 实际 src 完全一致，
    // 保证命中浏览器 HTTP/解码缓存。
    collectCardAssets(cards) {
      const urls = [];
      const push = (html) => { const m = /src="([^"]+)"/.exec(html || ''); if (m) urls.push(m[1]); };
      // 立绘优先（2026-09-13 老板：立绘加载卡顿）——战斗首屏的敌人/角色立绘排在卡面前面
      for (const id of MONSTER_IDS) { try { push(this.monsterArt(id)); } catch { /* 无此立绘：跳过该资产 */ } }
      for (const name of Object.values(CLASS_NAMES)) {
        try { push(this.classFullArt(name)); } catch { /* 无此立绘：跳过该资产 */ }
        try { push(this.classAvatarArt(name)); } catch { /* 无此立绘：跳过该资产 */ }
        try { push(this.battleArt(name)); } catch { /* 无此立绘：跳过该资产 */ }
      }
      if (Array.isArray(cards)) for (const c of cards) { try { push(this.cardIcon(c)); } catch { /* 无此卡面：跳过该资产 */ } }
      return urls;
    },
    // 全量清单补热（art-manifest.js 由 vite.config 构建期扫描 RUNTIME 资产目录生成）：
    // 覆盖序列帧（portraits/frames）、战场剪裁图（portraits/cut）等运行时零散引用的图。
    // URL 一律走 assetUrl 与 <img>/Pixi Assets 同键（含 ?v= 构建号），预热即命中缓存；
    // 与 collectCardAssets 的重合项由 warmBatched 内部去重。顺序按战斗相关度排。
    collectManifestAssets() {
      const rank = (p) => {
        const groups = ['portraits', 'scenes', 'cards', 'icons', 'ui/'];
        const i = groups.findIndex(g => p === g || p.startsWith(g));
        return i < 0 ? groups.length : i;
      };
      return [...ART_MANIFEST].sort((a, b) => rank(a) - rank(b)).map(p => assetUrl(`assets/${p}`));
    },
    // 卡牌库使用的 448px 缩略图不在原图清单内，启动总预热时单独并入。
    collectThumbnailAssets() {
      return THUMB_MANIFEST.map(p => assetUrl(`assets/thumbs/${p}`));
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
        const scheduleNext = () => {
          const run = () => {
            if (document.body?.classList.contains('cardlib-open')) {
              setTimeout(scheduleNext, 160);
              return;
            }
            next();
          };
          if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 400 });
          else setTimeout(run, 32);
        };
        const next = () => {
          if (i >= list.length) { resolve(); return; }
          const slice = list.slice(i, i + batch);
          i += slice.length;
          let left = slice.length;
          const one = () => { done++; if (onProgress) onProgress(done, grand); if (!--left) scheduleNext(); };
          for (const u of slice) {
            warmedUrls.add(u);
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => {
              let decoded;
              try { decoded = im.decode?.(); } catch { /* decode 不可用：Promise.resolve(undefined) 兜底 */ }
              Promise.resolve(decoded).catch(() => {}).then(one);
            };
            im.onerror = one;
            retainWarmed(im);
            im.src = u;
          }
        };
        next();
      });
    },
    // 全量美术只拉入浏览器 HTTP 缓存，不创建 Image、不解码、不占解码位图池。
    // 启动时仍覆盖完整清单；可见场景与卡库按需解码，避免 888 项解码挤占渲染。
    prefetchBatched(urls, onProgress, batch = 8) {
      const list = [];
      const seen = new Set();
      for (const u of urls || []) {
        if (u && !seen.has(u) && !prefetchedUrls.has(u)) { seen.add(u); list.push(u); }
      }
      const grand = (urls || []).length;
      let done = grand - list.length;
      if (onProgress && grand) onProgress(done, grand);
      let i = 0;
      return new Promise((resolve) => {
        const scheduleNext = () => {
          const run = () => {
            if (document.body?.classList.contains('cardlib-open')) {
              setTimeout(scheduleNext, 160);
              return;
            }
            next();
          };
          if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 1200 });
          else setTimeout(run, 48);
        };
        const next = () => {
          if (i >= list.length) { resolve(); return; }
          const slice = list.slice(i, i + batch);
          i += slice.length;
          Promise.all(slice.map(async (url) => {
            try {
              const response = await fetch(url, { cache: 'force-cache' });
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              await response.arrayBuffer();
              prefetchedUrls.add(url);
            } catch (error) {
              console.warn('[warmup] 美术资源预取失败', url, error);
            } finally {
              done++;
              if (onProgress) onProgress(done, grand);
            }
          })).then(scheduleNext);
        };
        scheduleNext();
      });
    },
    // opts.low：低倍率场景（卡牌库网格 / 悬停预览）取缩略图；opts.defer 仅供分页卡库在接近视口时赋 src。
    // 缺省 = 原图（战斗、放大看卡面等）
    cardIcon(card, opts) {
      const low = !!(opts && opts.low);
      const defer = !!(opts && opts.defer);
      const cardId = String(card && card.id || '');
      const revision = DATA.art.cardArtRevisions?.[cardId];
      const art = (src, cls, alt, key, style) => image(revision ? `${src}?art=${revision}` : src, cls, alt, key, style, low, defer);
      const illustration = DATA.art.cardArtOverrides?.[cardId];
      if (illustration) return art(illustration, 'art-card-image art-hero-fit', card?.name || cardId, `card-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      // 职业专属法术卡面（spell-<id>.webp，2026-09-09 配图批次）：优先于一切通用家族图，cover 填满
      if (SPELL_CARD_ART.has(cardId)) {
        return art(`cards/spell-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-spell-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 武术专属卡面（martial-<id>.webp，2026-09-09 批次）：侠客「无」出镜，cover 填满
      if (MARTIAL_CARD_ART.has(cardId)) {
        return art(`cards/martial-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-martial-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 装备专属卡面（equip-<id>.webp，2026-09-09 批次）：物件特写，cover 填满
      if (EQUIP_CARD_ART.has(cardId)) {
        return art(`cards/equip-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-equip-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 生物专属卡面（creature-<id>.webp，2026-09-09 补图批次）：无敌人立绘的图鉴生物，cover 填满
      if (CREATURE_CARD_ART.has(cardId)) {
        return art(`cards/creature-${cardId}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-creature-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      // 事件专属卡面（event-<id>.webp，2026-09-09 补图批次）：全屏场景大图（assets/scenes/），cover 填满
      const eventArt = EVENT_CARD_ART[cardId];
      if (eventArt) {
        return art(`scenes/${eventArt}.webp`, 'art-card-image art-hero-fit', card && card.name || cardId, `card-event-${cardId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      const itemKey = ITEM_ART[cardId] || '';
      if (itemKey) return art(`cards/items/${itemKey}.webp`, 'art-card-image', card && card.name || itemKey, `card-item-${itemKey}`, 'width:100%;height:100%;object-fit:contain;display:block');
      const resourceKey = RESOURCE_ART[cardId] || '';
      if (resourceKey) return art(`cards/resources/${resourceKey}.webp`, 'art-card-image', card && card.name || resourceKey, `card-${resourceKey}`, 'width:100%;height:100%;object-fit:cover;display:block');
      const family = cardFamily(card);
      if (!CARD_FAMILIES.has(family)) {
        // 生物图鉴卡：用敌人战场立绘（art 字段指向 MONSTER_IDS），无映射时回退爪印图标
        if (family === 'creature') {
          const artId = card && card.art;
          if (artId && MONSTER_IDS.has(artId)) {
            return art(`portraits/enemies/${artId}.webp`, 'art-card-image', card && card.name || artId, `card-foe-${artId}`, 'width:100%;height:100%;object-fit:cover;display:block');
          }
          return SDT.Icons.img('paw');
        }
        return fallback('card', family, card && card.name || '未知卡牌');
      }
      // 能力卡：优先按稳定卡 id 取专属卡面；其次按职业取专属立绘（assets/cards/hero-<职业id>.webp），缺失回退通用 hero.webp
      // art-hero-fit：卡面插画一律 cover 填满插画区（2026-09-09 老板要求装满；方图居中构图，裁切只裁背景色块）
      if (family === 'hero') {
        const heroArtKey = HERO_CARD_ART[cardId];
        if (heroArtKey) return art(`cards/${heroArtKey}.webp`, 'art-card-image art-hero-fit', card && card.name || heroArtKey, `card-${heroArtKey}`, 'width:100%;height:100%;object-fit:cover;display:block');
        let clsId = resolveClass(card && card.cls);
        // 实例副本可能丢失 cls（旧对局存档/旧版制作坊）：从卡牌库按 id、名称找回职业，
        // 保证每张能力卡始终使用各自专属的卡面（而非黄黑通用剪影）
        if (!clsId && window.SDT && SDT.Cards && SDT.Cards.all) {
          try {
            const src = SDT.Cards.all().find(c => c.id === card.id || c.name === card.name);
            if (src) clsId = resolveClass(src.cls);
          } catch { /* 卡牌库不可用时静默回退 */ }
        }
        if (clsId) return art(`cards/hero-${clsId}.webp`, 'art-card-image art-hero-fit', card && card.name || clsId, `card-hero-${clsId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      return art(`cards/${family}.webp`, 'art-card-image', card && card.name || family, `card-${family}`, 'width:100%;height:100%;object-fit:cover;display:block');
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

export { ROOT, SDT, esc, missingKeys, reportMissing, SKIN_FULL_ART, setActiveSkin, hydrateSelectedSkins };
