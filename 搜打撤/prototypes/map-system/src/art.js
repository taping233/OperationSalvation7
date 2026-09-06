import { characterFor, CHARACTERS } from './characters.js';

  'use strict';
import { BUILD_VERSION, assetUrl } from './asset-url.js';

  const SDT = window.SDT = window.SDT || {};
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
  const MONSTER_IDS = new Set(['infantry','archer','bandit','cavalry','orc_jav','orc_axe','wolf_rider','fire_el','water_el','grass_el','dragon','boss_general','boss_orc','boss_elem']);
  const CARD_FAMILIES = new Set(['hero','event','martial-ranged','martial-melee','healing','spell','equipment-armor','equipment-weapon','equipment-utility','resource-key','resource-valuables','resource-material','consumable','unknown']);
  // 资源卡专属立绘（assets/cards/resources/<key>.png），按卡名精确匹配；
  // 未命中时回退到 resource-key/valuables/material 家族图
  const RESOURCE_ART = Object.freeze({
    '制式口粮': 'ration-std',
    '口粮': 'ration',
    '双份口粮': 'ration-double',
    '钥匙': 'key',
    '一串钥匙': 'keys-bunch',
    '一把钥匙': 'key-one',
    '木材': 'wood',
    '大量木材': 'wood-lots',
    '一捆木材': 'wood-bundle',
    '石榴石弹珠': 'garnet-marble',
    '经济卡包': 'econpack',
    '钻石': 'diamond',
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
  function image(src, cls, alt, key, style) {
    return `<img class="${esc(cls)}" src="${assetUrl(ROOT + src)}" alt="${esc(alt)}" data-asset-key="${esc(key)}"${style ? ` style="${esc(style)}"` : ''} draggable="false" loading="eager">`;
  }
  function fallback(kind, key, alt) {
    reportMissing(kind, key);
    return image(FALLBACK, 'art-missing', alt || '美术资源缺失', `missing-${kind}-${key || 'empty'}`);
  }
  function cardFamily(card) {
    const name = String(card && card.name || '');
    const type = String(card && card.type || '');
    if (type === '英雄卡') return 'hero';
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
    if (type === '道具') return /药|绷带|医疗|治伤/.test(name) ? 'healing' : 'consumable';
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
    // img.src 形如 "assets/portraits/<组>/<名>.png"（image() 会补 assets/ 前缀）
    const m = /^assets\/portraits\/(classes|enemies)\/([^/]+)$/.exec(String(src || ''));
    return m ? `assets/portraits/cut/${m[1]}/${m[2]}` : null;
  };
  { // 逐张空闲预解码，避免 25 张图片同时解码/上传造成启动长帧
    const groups = { classes: Object.values(CLASS_IDS), enemies: Array.from(MONSTER_IDS) };
    const queue = Object.keys(groups).flatMap(group => groups[group].map(id => `assets/portraits/cut/${group}/${id}.png`));
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


const rosterUrl = new URL('../assets/portraits/expedition-roster.png', import.meta.url).href;
function characterArt(value, full=false) {
 const c=characterFor(value); if(!c)return null;
 const ranges=[[0,355],[338,672],[655,1010],[991,1397],[1380,1672]];
 const [left,right]=ranges[CHARACTERS.indexOf(c)],width=right-left;
 const position=left/(1672-width)*100;
 return `<span role="img" aria-label="${c.name}" class="roster-portrait ${full?'art-full':'art-portrait'}" style="background-image:url('${rosterUrl}');background-size:${1672/width*100}% 100%;background-position:${position}% center;--portrait-ratio:${width}/941;--roster-size:${1672/width*100}% 100%;--roster-position:${position}% center"></span>`;
}

  SDT.Art = {
    classArt(className) {
      if(characterFor(className)) return characterArt(className);
      const id = resolveClass(className);
      if (!id) return fallback('class', className, className || '未知职业');
      return image(`portraits/classes/${id}.png`, 'art-portrait', CLASS_NAMES[id], `class-${id}`);
    },
    // 角色选择页大幅立绘：全身像 portraits/full/<id>.png（1038×1516 全身立绘烘焙版，688×1012）；
    // 缺失时回退半身像 portraits/classes/<id>.png
    classFullArt(className) {
      if(characterFor(className)) return characterArt(className,true);
      const id = resolveClass(className);
      if (!id) return image('cards/hero.png', 'art-full', className || '未知角色', `class-full-${className || 'unknown'}`);
      return image(`portraits/full/${id}.png`, 'art-full', CLASS_NAMES[id], `class-full-${id}`);
    },
    monsterArt(id) {
      if (!MONSTER_IDS.has(id)) return fallback('enemy', id, id || '未知敌人');
      return image(`portraits/enemies/${id}.png`, 'art-portrait art-hostile', id, `enemy-${id}`);
    },
    has(id) { return Boolean(resolveClass(id)) || MONSTER_IDS.has(id); },
    cardIcon(card) {
      const family = cardFamily(card);
      if (!CARD_FAMILIES.has(family)) {
        // 生物图鉴卡：用敌人战场立绘（art 字段指向 MONSTER_IDS），无映射时回退爪印图标
        if (family === 'creature') {
          const artId = card && card.art;
          if (artId && MONSTER_IDS.has(artId)) {
            return image(`portraits/enemies/${artId}.png`, 'art-card-image', card && card.name || artId, `card-foe-${artId}`, 'width:100%;height:100%;object-fit:cover;display:block');
          }
          return SDT.Icons.img('paw');
        }
        return fallback('card', family, card && card.name || '未知卡牌');
      }
      const resourceKey = family === 'resource-key' || family === 'resource-valuables' || family === 'resource-material'
        ? RESOURCE_ART[String(card && card.name || '')] : '';
      if (resourceKey) return image(`cards/resources/${resourceKey}.png`, 'art-card-image', card && card.name || resourceKey, `card-${resourceKey}`, 'width:100%;height:100%;object-fit:cover;display:block');
      // 英雄卡：按职业取专属立绘（assets/cards/hero-<职业id>.png），缺失回退通用 hero.png
      if (family === 'hero') {
        let clsId = resolveClass(card && card.cls);
        // 实例副本可能丢失 cls（旧对局存档/旧版制作坊）：从卡牌库按 id、名称找回职业，
        // 保证每张英雄卡始终使用各自专属的卡面（而非黄黑通用剪影）
        if (!clsId && window.SDT && SDT.Cards && SDT.Cards.all) {
          try {
            const src = SDT.Cards.all().find(c => c.id === card.id || c.name === card.name);
            if (src) clsId = resolveClass(src.cls);
          } catch (e) { /* 卡牌库不可用时静默回退 */ }
        }
        if (clsId) return image(`cards/hero-${clsId}.png`, 'art-card-image', card && card.name || clsId, `card-hero-${clsId}`, 'width:100%;height:100%;object-fit:cover;display:block');
      }
      return image(`cards/${family}.png`, 'art-card-image', card && card.name || family, `card-${family}`, 'width:100%;height:100%;object-fit:cover;display:block');
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
      classes: Object.freeze(Object.values(CLASS_IDS).map(id => `portraits/classes/${id}.png`)),
      enemies: Object.freeze(Array.from(MONSTER_IDS, id => `portraits/enemies/${id}.png`)),
      cards: Object.freeze(Array.from(CARD_FAMILIES, id => `cards/${id}.png`))
    }),
    missingKeys
  };

export { ROOT, SDT, esc, missingKeys, reportMissing };
