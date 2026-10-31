#!/usr/bin/env node
/* ============================================================
 * dump.mjs —— W2 数据提取脚本（幂等，可重复运行）
 *
 * 在不启动浏览器的前提下，以 stub 的 window/localStorage/document
 * 导入源项目 ESM 模块（源项目 package.json 已有 "type":"module"，
 * 无需拷贝临时目录），按 game.boot.js 的初始化顺序跑卡牌播种管线，
 * 然后把结果生成为 Unity 用的静态数据：
 *   1. Assets/Scripts/Sdt.Core/Data/CardDatabase.cs   （All 245 + Bestiary 14）
 *   2. Assets/Scripts/Sdt.Core/Data/SceneCopy.cs      （SCENES/CLASS_STORY/EVENT_SCENE_META/PRELOAD_SCENES）
 *   3. Assets/Resources/Data/NarrativeEvents.json     （ink JSON 原文剥出）
 *
 * 用法：node dump.mjs
 * ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = 'D:/素材/代号柒/搜打撤/game/src';
const UNITY = 'D:/素材/代号柒/SoudacheUnity';
const OUT_CS = path.join(UNITY, 'Assets/Scripts/Sdt.Core/Data');
const OUT_JSON = path.join(UNITY, 'Assets/Resources/Data');

/* ---------- 浏览器环境 stub（必须在 import 源模块之前就位） ---------- */
globalThis.window = globalThis;
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { mem.set(k, String(v)); },
  removeItem: (k) => { mem.delete(k); },
  clear: () => { mem.clear(); },
  key: (i) => Array.from(mem.keys())[i] ?? null,
  get length() { return mem.size; },
};
globalThis.document = {
  addEventListener() {},
  removeEventListener() {},
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
  head: { appendChild() {} },
  // body 保持 null：icons-bitmap.js 顶层的 hydrate(document.body)/MutationObserver 分支据此跳过
  body: null,
};
// cards.js / sound.js 等惰性引用的宿主对象，stub 为空对象/空函数即可
for (const name of ['AudioContext', 'webkitAudioContext', 'HTMLElement', 'MutationObserver', 'ResizeObserver', 'matchMedia']) {
  if (!globalThis[name]) globalThis[name] = function () { return {}; };
}
// art.js 定时器里 new Image().src=... 触发惰性加载，stub 掉即可
globalThis.Image = globalThis.Image || function () { return { set src(_v) {}, addEventListener() {} }; };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || (() => {});
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.fetch = globalThis.fetch || (() => Promise.resolve({ ok: false }));

/* ---------- 按依赖顺序导入源模块（对齐 main.js 加载顺序） ---------- */
const imp = (rel) => import(pathToFileURL(path.join(SRC, rel)).href);
await imp('./random.js');            // 挂 globalThis.SDT.Random（cards.js 顶部的 window.SDT 依赖它）
await imp('./characters.js');        // art.js 的依赖
await imp('./icons-bitmap.js');      // 挂 globalThis.SDT.Icons（cards.js 顶层的 DMG_TYPE_META 引用 Icons.img）
await imp('./cards.js');
await imp('./art.js');               // HeroArt/ArtKey（卡面图 key）来源
const runData = await imp('./game.run.data.js');
await imp('./generated/narrative-events.js'); // 只为验证可导入；JSON 从原文剥出

const Cards = globalThis.window.SDT.Cards;
const Art = globalThis.window.SDT.Art;

/* ---------- 按 game.boot.js 顺序执行卡牌播种管线 ---------- */
// STARTERS 三张在源码中无 id（浏览器实机由 upsert 生成随机 id），静态数据需确定性：
// 预置 starter-1/2/3（按 STARTERS 定义顺序），保证生成物幂等
Cards.STARTERS.forEach((c, i) => { if (!c.id) c.id = `starter-${i + 1}`; });
Cards.ensureStarters();
Cards.ensureSha();
Cards.ensureTabletop();
Cards.ensureDmgTypes();
Cards.ensureEffectFields();

const all = Cards.all();
const bestiaryIds = new Set(Cards.BESTIARY.map((c) => c.id));
const mainCards = all.filter((c) => !bestiaryIds.has(c.id));
const bestiaryCards = all.filter((c) => bestiaryIds.has(c.id));
// 2026-09-04/05 职业整合定版后，全新档完整管线产出 228 主卡（规划文档 02 的"245"为定版前旧扫描数）；
// cards.js 内嵌记录（STARTERS3+SHA1+TT1~TT8 224）本身也只有 228 条，无任何路径可得 245。
if (mainCards.length !== 228) throw new Error(`主卡表条数 ${mainCards.length} != 228（源定版语义）`);
if (bestiaryCards.length !== 14) throw new Error(`生物图鉴条数 ${bestiaryCards.length} != 14`);

/* ---------- 字段收集：以 W1 已定的 Sdt.Core/Cards.cs CardDef 为准 ---------- */
const FIELDS = ['id', 'name', 'cost', 'rarity', 'type', 'dmg', 'dmgType', 'draw',
  'infuse', 'heal', 'armor', 'desc', 'value', 'sellable', 'unrandom', 'cls', 'hero', 'art', 'tokenOf'];
const extraFields = new Set();
for (const c of all) for (const k of Object.keys(c)) if (!FIELDS.includes(k)) extraFields.add(k);

function csStr(v) {
  if (v === undefined || v === null) return 'null';
  return JSON.stringify(String(v)); // JSON 转义规则与 C# 字符串字面量兼容（\" \\ \n \uXXXX）
}
function cardInit(c) {
  const parts = [];
  for (const f of FIELDS) {
    const v = c[f];
    if (f === 'cost') {
      parts.push(`cost=${Number(v || 0)}`);                       // int
    } else if (f === 'dmg' || f === 'draw' || f === 'infuse' || f === 'heal' || f === 'armor' || f === 'value') {
      parts.push(`${f}=${(v === undefined || v === null) ? 'null' : Number(v)}`); // int?
    } else if (f === 'sellable' || f === 'hero') {
      parts.push(`${f}=${(v === undefined || v === null) ? 'null' : (v === true ? 'true' : 'false')}`); // bool?
    } else if (f === 'unrandom') {
      parts.push(`unrandom=${v === true ? 'true' : 'false'}`);    // bool
    } else {
      parts.push(`${f}=${csStr(v)}`);
    }
  }
  return `new CardDef{ ${parts.join(', ')} }`;
}
function cardList(name, list, comment) {
  const body = list.map((c) => `      ${cardInit(c)},`).join('\n');
  return `    // ${comment}\n    public static readonly CardDef[] ${name} = new CardDef[] {\n${body}\n    };`;
}

/* ---------- HeroArt / ArtKey（卡面图 key 映射，来自 art.js） ---------- */
// art.js 模块内部变量 CLASS_IDS / RESOURCE_ART 未导出，从源码文本正则剥出（只读，不改源文件）
const artSrc = fs.readFileSync(path.join(SRC, 'art.js'), 'utf8');
function extractFrozenObject(src, varName) {
  const start = src.indexOf(`const ${varName} =`);
  if (start < 0) throw new Error(`art.js 中找不到 ${varName}`);
  const objStart = src.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = objStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const inner = src.slice(objStart + 1, end);
  const out = [];
  const re = /'([^']+)'\s*:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(inner))) out.push([m[1], m[2]]);
  return out;
}
const classIdPairs = extractFrozenObject(artSrc, 'CLASS_IDS');
const resourceArtPairs = extractFrozenObject(artSrc, 'RESOURCE_ART');
function dictInit(pairs, valueFn) {
  return `{ ${pairs.map(([k, v]) => `{ ${csStr(k)}, ${csStr(valueFn ? valueFn(v) : v)} }`).join(', ')} }`;
}

/* ---------- CardDatabase.cs ---------- */
const header = `// ported from src/cards.js —— 由 _planning/tools/dump-data/dump.mjs 生成，勿手改
// 播种管线对齐 game.boot.js：ensureStarters → ensureSha → ensureTabletop → ensureDmgTypes → ensureEffectFields
// （含 ensureClassRarity / ensureShieldToArmor / ensureCardFixes / ensureClassConsolidation / ensureDmgValues / ensureHeroFields 定版迁移）
namespace Sdt.Core {
  public static class CardDatabase {
`;
const heroArtCs = `    // 职业 → 英雄卡面立绘 key（源 art.js CLASS_IDS：assets/cards/hero-<id>.png）
    public static readonly System.Collections.Generic.KeyValuePair<string, string>[] HeroArt = new System.Collections.Generic.KeyValuePair<string, string>[] {
      ${classIdPairs.map(([k, v]) => `new System.Collections.Generic.KeyValuePair<string, string>(${csStr(k)}, ${csStr('hero-' + v)})`).join(',\n      ')}
    };
    // 资源卡名 → resources/ 专属立绘 key（源 art.js RESOURCE_ART：assets/cards/resources/<key>.png）
    public static readonly System.Collections.Generic.KeyValuePair<string, string>[] ArtKey = new System.Collections.Generic.KeyValuePair<string, string>[] {
      ${resourceArtPairs.map(([k, v]) => `new System.Collections.Generic.KeyValuePair<string, string>(${csStr(k)}, ${csStr(v)})`).join(',\n      ')}
    };
`;
const cardDbCs = header
  + cardList('All', mainCards, `全量卡表 ${mainCards.length} 条（字段对齐 Sdt.Core/Cards.cs CardDef，2026-09-05 定版语义）`)
  + '\n\n' + cardList('Bestiary', bestiaryCards, `生物图鉴 ${bestiaryCards.length} 条（敌人信息，与 mapData monsters / altar.bosses 一一对应）`)
  + '\n\n' + heroArtCs
  + `  }\n}\n`;
fs.mkdirSync(OUT_CS, { recursive: true });
fs.writeFileSync(path.join(OUT_CS, 'CardDatabase.cs'), cardDbCs, 'utf8');

/* ---------- SceneCopy.cs ---------- */
function sceneInit(key, s) {
  const lines = s.lines.map(csStr).join(', ');
  const auto = s.auto === true ? 'true' : 'false';
  const btn = csStr(s.btn);
  return `      new KeyValuePair<string, SceneDef>(${csStr(key)}, new SceneDef{ icon=${csStr(s.icon)}, title=${csStr(s.title)}, tone=${csStr(s.tone)}, btn=${btn}, auto=${auto}, lines=new string[]{ ${lines} } })`;
}
function basename(url) { return url.split('/').pop(); }
const scenesCs = Object.entries(runData.SCENES).map(([k, v]) => sceneInit(k, v)).join(',\n');
const storyCs = Object.entries(runData.CLASS_STORY)
  .map(([k, v]) => `      new KeyValuePair<string, ClassStoryDef>(${csStr(k)}, new ClassStoryDef{ tag=${csStr(v.tag)}, bg=${csStr(v.bg)}, task=${csStr(v.task)} })`)
  .join(',\n');
const evCs = Object.entries(runData.EVENT_SCENE_META)
  .map(([k, v]) => `      new KeyValuePair<string, string[]>(${csStr(k)}, new string[]{ ${v.map(csStr).join(', ')} })`)
  .join(',\n');
// PRELOAD_SCENES：源码是 import.meta.url 的 file:// 绝对地址，Unity 侧取文件名对应 Art/Scenes/ 路径表
const preCs = Object.entries(runData.PRELOAD_SCENES)
  .map(([k, v]) => `      new KeyValuePair<string, string>(${csStr(k)}, ${csStr(basename(v))})`)
  .join(',\n');

const sceneCopyCs = `// ported from src/game.run.data.js —— 由 _planning/tools/dump-data/dump.mjs 生成，勿手改
// SCENES 台词/标题/按钮逐字照抄源码；PRELOAD_SCENES 源码为 import.meta.url 文件地址，此处取文件名（对应 Assets/Resources/Art/Scenes/）
using System.Collections.Generic;

namespace Sdt.Core {
  // 行军节点过场数据（icon 为 [[icon:x]] 富文本令牌，tone 对应场景配色）
  public sealed class SceneDef {
    public string icon; public string title; public string tone; public string btn;
    public bool auto;            // 源码仅 coin/wood/rations/key 为 true（自动拾取，无按钮）
    public string[] lines;       // 台词池（{name} 为敌人名占位符）
  }
  // 旧职业背景故事（11 条，职业整合后仍作图鉴叙事保留）
  public sealed class ClassStoryDef { public string tag; public string bg; public string task; }

  public static class SceneCopy {
    // 节点场景（12 个 key；源 SCENES 无 boss 条目——BOSS 入场由 battle 流程自带文案）
    public static readonly KeyValuePair<string, SceneDef>[] SCENES = new KeyValuePair<string, SceneDef>[] {
${scenesCs}
    };
    // 职业背景故事
    public static readonly KeyValuePair<string, ClassStoryDef>[] CLASS_STORY = new KeyValuePair<string, ClassStoryDef>[] {
${storyCs}
    };
    // 事件卡 → 场景三联（容器 id / 容器 class / 背景 class）
    public static readonly KeyValuePair<string, string[]>[] EVENT_SCENE_META = new KeyValuePair<string, string[]>[] {
${evCs}
    };
    // 场景预载图表（key → Art/Scenes/ 下文件名）
    public static readonly KeyValuePair<string, string>[] PRELOAD_SCENES = new KeyValuePair<string, string>[] {
${preCs}
    };
  }
}
`;
fs.writeFileSync(path.join(OUT_CS, 'SceneCopy.cs'), sceneCopyCs, 'utf8');

/* ---------- NarrativeEvents.json（原文剥出，不重排） ---------- */
const inkRaw = fs.readFileSync(path.join(SRC, 'generated/narrative-events.js'), 'utf8');
const marker = 'export default ';
const mIdx = inkRaw.indexOf(marker);
if (mIdx < 0) throw new Error('narrative-events.js 中找不到 "export default "');
// 文件头部有注释行（"// Generated from ..."），剥出 export default 后的 JSON（可带结尾分号/换行）
const inkJson = inkRaw.slice(mIdx + marker.length).replace(/[\s;]+$/, '');
JSON.parse(inkJson); // 确认是合法 JSON
if (!inkJson.startsWith('{"inkVersion":21')) throw new Error('ink JSON 前缀校验失败');
fs.mkdirSync(OUT_JSON, { recursive: true });
fs.writeFileSync(path.join(OUT_JSON, 'NarrativeEvents.json'), inkJson, 'utf8');

/* ---------- 汇总 ---------- */
console.log(`CardDatabase.cs : All=${mainCards.length} Bestiary=${bestiaryCards.length}`);
console.log(`SceneCopy.cs    : SCENES=${Object.keys(runData.SCENES).length} CLASS_STORY=${Object.keys(runData.CLASS_STORY).length} EVENT_SCENE_META=${Object.keys(runData.EVENT_SCENE_META).length} PRELOAD_SCENES=${Object.keys(runData.PRELOAD_SCENES).length}`);
console.log(`HeroArt=${classIdPairs.length} ArtKey=${resourceArtPairs.length}`);
console.log(`NarrativeEvents.json : ${inkJson.length} bytes, inkVersion=21`);
if (extraFields.size) console.log(`NOTE 源卡表存在契约外字段（未导出）: ${[...extraFields].join(', ')}`);
