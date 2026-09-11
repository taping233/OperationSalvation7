#!/usr/bin/env node
/**
 * Export the original game's content into deterministic, UTF-8 JSON for the
 * Godot port.
 *
 * The browser modules are intentionally evaluated in a small VM sandbox. This
 * keeps the export independent from DOM/localStorage while still using the
 * original definitions and its migration/derivation rules. No .tmp or
 * sts2-reverse path is ever accepted as an input.
 *
 * 2026-09-11 架构批次适配：非卡牌数据外置到 搜打撤/game/data/*.json，模块经
 * data-loader.js 的中央 DATA 常量读取。沙箱按同一构造求值 data-loader.js
 * （JSON import 就地内联），并向被剥离 import 的模块注入等价垫片：
 *   - DATA            （cards.js 消费 DATA.cardsSync 播种实机定版卡库）
 *   - sdtDefine       （sdt-facade.js 的挂载函数；rules.js/mapData.js 使用）
 *   - cardHTML 等     （cards.view.js 视图函数，导出流程不渲染，给空实现）
 *
 * 地图（mapData.js）自 09-10 四层定版起只承载静态表（物品/怪物/遭遇/祭坛），
 * 几何由 map-generator.js 按种子在运行期生成，源码不再有 makeRing/分层 cells。
 * 因此 Godot map.json 只导出静态表本体；三环几何仍由 C# RunMap 硬编码承载，
 * 四层地图进运行时属于后续批次。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const GODOT_DIR = path.resolve(TOOL_DIR, '..');
const WORKSPACE_DIR = path.resolve(GODOT_DIR, '..');
const SOURCE_DIR = path.resolve(WORKSPACE_DIR, '搜打撤', 'game', 'src');
const GAME_DATA_DIR = path.resolve(WORKSPACE_DIR, '搜打撤', 'game', 'data');
const OUTPUT_DIR = path.resolve(GODOT_DIR, 'data');

const SOURCE_FILES = {
  cards: 'cards.js',
  characters: 'characters.js',
  rules: 'rules.js',
  map: 'mapData.js',
};

function fail(message) {
  throw new Error(`[export-data] ${message}`);
}

function assertSafeSource(filePath) {
  const resolved = path.resolve(filePath);
  const inSrc = (() => { const rel = path.relative(SOURCE_DIR, resolved); return !rel.startsWith('..') && !path.isAbsolute(rel); })();
  const inData = (() => { const rel = path.relative(GAME_DATA_DIR, resolved); return !rel.startsWith('..') && !path.isAbsolute(rel); })();
  if (!inSrc && !inData) fail(`source is outside original game/src|game/data: ${resolved}`);
  if (/\.tmp|sts2-reverse/i.test(resolved)) fail(`reverse-engineering input is forbidden: ${resolved}`);
  if (!fs.existsSync(resolved)) fail(`missing source: ${resolved}`);
  return resolved;
}

function readSource(name) {
  return fs.readFileSync(assertSafeSource(path.join(SOURCE_DIR, SOURCE_FILES[name])), 'utf8');
}

function sourceHash(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function makeStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
    setItem: (key, value) => values.set(String(key), String(value)),
    removeItem: key => values.delete(String(key)),
    clear: () => values.clear(),
  };
}

// ensureStarters mints ids for id-less STARTERS entries via
// `Date.now().toString(36)`; pinning the clock keeps the export byte-stable.
const FixedDate = class extends Date {
  static now() { return 0; }
  constructor(...args) { super(...(args.length ? args : [0])); }
};

/**
 * Evaluate a browser module in a VM sandbox. Imports/exports are removed only
 * for this isolated adapter; the original files remain untouched and are still
 * the sole source of content. `extra` injects shims for identifiers whose
 * import statements were stripped (DATA, view helpers, ...). sdtDefine is
 * always provided because sdt-facade.js is the namespace mounting mechanism.
 */
function evaluate(source, setup = '', label = 'source', extra = {}) {
  const body = source
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s*\{[^}]+\};?\s*$/gm, '');
  const sandbox = {
    console,
    window: { SDT: { Icons: { img: name => `[[icon:${name}]]`, TYPE_ART: {} } } },
    localStorage: makeStorage(),
    Random: { random: () => 0.5 },
    characterName: value => value || '未选择人物',
    sdtDefine: (name, value) => { sandbox.window.SDT[name] = value; return value; },
    Date: FixedDate,
    setTimeout,
    clearTimeout,
    ...extra,
  };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(`${body}\n${setup}`, sandbox, { filename: label, timeout: 10000 });
  } catch (error) {
    fail(`could not evaluate ${label}: ${error.message}`);
  }
  return sandbox;
}

/**
 * Build the central DATA constant by evaluating the original data-loader.js
 * (2026-09-11 架构批次 2): its `import x from '../data/*.json'` lines are
 * inlined verbatim from game/data/*.json, so the freeze/assembly logic stays
 * sourced from the web file instead of being re-implemented here.
 */
function loadDataContext() {
  const loaderPath = path.join(SOURCE_DIR, 'data-loader.js');
  const source = fs.readFileSync(assertSafeSource(loaderPath), 'utf8');
  const hash = sourceHash(source);
  const inlined = source.replace(
    /^\s*import\s+(\w+)\s+from\s+['"][^'"]*?\/([\w-]+)\.json['"];?\s*$/gm,
    (_, name, file) => {
      const jsonPath = assertSafeSource(path.join(GAME_DATA_DIR, `${file}.json`));
      return `const ${name} = ${fs.readFileSync(jsonPath, 'utf8')};`;
    },
  ).replace(/^(\s*)export\s+const\s+DATA\b/m, '$1const DATA');
  if (inlined.includes("from '../data/")) fail('data-loader.js has JSON imports that were not inlined');
  const sandbox = evaluate(inlined, 'globalThis.__DATA = DATA;', 'data-loader.js');
  if (!sandbox.__DATA || !sandbox.__DATA.cardsSync) fail('data-loader.js did not produce DATA.cardsSync');
  return { data: sandbox.__DATA, hash };
}

/** Manifest dep entry for a consumed web-side file (path relative to workspace). */
function depHash(relativePath) {
  return { path: relativePath, sha256: sourceHash(fs.readFileSync(path.join(WORKSPACE_DIR, relativePath), 'utf8')) };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
}

function writeJson(fileName, value) {
  const filePath = path.join(OUTPUT_DIR, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(canonical(value), null, 2)}\n`, 'utf8');
}

function exportCharacters() {
  const source = readSource('characters');
  const sandbox = evaluate(source, 'globalThis.__characters = { CHARACTERS, LEGACY };', 'characters.js');
  return { characters: sandbox.__characters.CHARACTERS, legacy: sandbox.__characters.LEGACY, _hash: sourceHash(source) };
}

function exportRules() {
  const source = readSource('rules');
  const sandbox = evaluate(source, 'globalThis.__rules = RULES;', 'rules.js');
  return { rules: sandbox.__rules, _hash: sourceHash(source) };
}

function exportCards(data) {
  const source = readSource('cards');
  const noView = () => '';
  const sandbox = evaluate(
    source,
    'globalThis.__cards = window.SDT.Cards;',
    'cards.js',
    { DATA: data, cardHTML: noView, cardBackHTML: noView },
  );
  const cards = sandbox.__cards;
  if (!cards) fail('cards.js did not initialize SDT.Cards');

  // Simulate a clean browser profile exactly like game.boot.js does
  // (ensureStarters → ensureSha → ensureTabletop → ensureDmgTypes →
  // ensureEffectFields), so all first-party tabletop batches, the migrations
  // and the live cards-sync seeding (game/data/cards-sync.json via DATA) are
  // represented. No user storage or network is read by this adapter.
  for (const method of ['ensureStarters', 'ensureSha', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields', 'ensureDmgValues']) {
    if (typeof cards[method] === 'function') cards[method]();
  }
  const all = typeof cards.all === 'function' ? cards.all() : [];
  const serializable = JSON.parse(JSON.stringify(all));
  // IDs are ASCII; use code-unit comparison rather than localeCompare so the
  // byte output is identical on machines with different ICU locales.
  serializable.sort((a, b) => String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
  if (!serializable.length) fail('clean source export produced no cards');
  return {
    schemaVersion: 1,
    rarities: cards.RARITIES,
    types: cards.TYPES,
    classes: cards.CLASSES,
    damageTypes: cards.DMG_TYPE_ORDER,
    price: cards.PRICE,
    shopWeights: cards.SHOP_WEIGHTS,
    dropWeights: cards.DROP_WEIGHTS,
    dropDiscountTypes: cards.DROP_DISCOUNT_TYPES,
    dropTypes: cards.DROP_TYPES,
    cards: serializable,
    // STARTERS entries without a source id get deterministic adapter ids
    // (the browser mints Date-based ids for those); entries that gained real
    // source ids keep them so Godot stays aligned with the web seeding.
    starterCards: (cards.STARTERS || []).map((card, index) => ({
      id: ['starter-recruit-drill', 'starter-emergency-bandage', 'starter-ration-kit'][index] || `starter-${index + 1}`,
      ...JSON.parse(JSON.stringify(card)),
    })),
    _hash: sourceHash(source),
  };
}

function exportMap(rules) {
  const source = readSource('map');
  const mapJson = fs.readFileSync(assertSafeSource(path.join(GAME_DATA_DIR, 'map.json')), 'utf8');
  const adapted = source
    .replace(/^\s*import\s+\{\s*RULES\s*\}\s+from\s+['"]\.\/rules\.js['"];?\s*$/m, `const RULES = ${JSON.stringify(rules)};`)
    .replace(/^\s*import\s+mapData\s+from\s+['"][^']*map\.json['"];?\s*$/m, `const mapData = ${mapJson};`);
  const sandbox = evaluate(adapted, 'globalThis.__map = window.SDT.MAP;', 'mapData.js');
  const map = sandbox.__map;
  if (!map) fail('mapData.js did not initialize SDT.MAP');
  // Geometry is seeded/generated at runtime by map-generator.js since the
  // 2026-09-10 four-layer revision; mapData.js only carries the static tables.
  // Export those verbatim (functions such as rollCount are dropped by JSON).
  return {
    schemaVersion: 1,
    map: JSON.parse(JSON.stringify(map)),
    _hash: sourceHash(source),
    _mapJsonHash: sourceHash(mapJson),
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const loader = loadDataContext();
  const chars = exportCharacters();
  const rules = exportRules();
  const cards = exportCards(loader.data);
  const map = exportMap(rules.rules);

  const manifest = {
    schemaVersion: 1,
    source: '搜打撤/game/src + 搜打撤/game/data',
    encoding: 'UTF-8',
    generatedBy: 'SoudacheGodot/tools/export_data.mjs',
    files: {
      cards: {
        path: 'cards.json', source: 'cards.js', sha256: cards._hash,
        count: cards.cards.length, starterCount: cards.starterCards.length,
        deps: [depHash('搜打撤/game/src/data-loader.js'), depHash('搜打撤/game/data/cards-sync.json')],
      },
      characters: { path: 'characters.json', source: 'characters.js', sha256: chars._hash, count: chars.characters.length },
      rules: { path: 'rules.json', source: 'rules.js', sha256: rules._hash, deps: [depHash('搜打撤/game/src/sdt-facade.js')] },
      map: { path: 'map.json', source: 'mapData.js', sha256: map._hash, deps: [depHash('搜打撤/game/data/map.json')] },
    },
  };
  delete cards._hash;
  delete chars._hash;
  delete rules._hash;
  delete map._hash;
  delete map._mapJsonHash;
  writeJson('cards.json', cards);
  writeJson('characters.json', chars);
  writeJson('rules.json', rules);
  writeJson('map.json', map);
  writeJson('manifest.json', manifest);
  console.log(`[export-data] wrote ${cards.cards.length} cards, ${chars.characters.length} characters, map static tables v${map.map.version}`);
}

main();
