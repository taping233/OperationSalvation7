#!/usr/bin/env node
/**
 * Export the original game's content into deterministic, UTF-8 JSON for the
 * Godot port.
 *
 * The browser modules are intentionally evaluated in a small VM sandbox. This
 * keeps the export independent from DOM/localStorage while still using the
 * original definitions and its migration/derivation rules. No .tmp or
 * sts2-reverse path is ever accepted as an input.
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
  const rel = path.relative(SOURCE_DIR, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) fail(`source is outside original game/src: ${resolved}`);
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

function evaluate(source, setup = '', label = 'source') {
  // Imports/exports are removed only for this isolated adapter. The original
  // files remain untouched and are still the sole source of content.
  const body = source
    .replace(/^\s*import\s+[^;]+;\s*$/gm, '')
    .replace(/^\s*export\s*\{[^}]+\};?\s*$/gm, '');
  const sandbox = {
    console,
    window: { SDT: { Icons: { img: name => `[[icon:${name}]]`, TYPE_ART: {} } } },
    localStorage: makeStorage(),
    Random: { random: () => 0.5 },
    characterName: value => value || '未选择人物',
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;
  try {
    vm.runInNewContext(`${body}\n${setup}`, sandbox, { filename: label, timeout: 3000 });
  } catch (error) {
    fail(`could not evaluate ${label}: ${error.message}`);
  }
  return sandbox;
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

function exportCards() {
  const source = readSource('cards');
  const sandbox = evaluate(source, 'globalThis.__cards = window.SDT.Cards;', 'cards.js');
  const cards = sandbox.__cards;
  if (!cards) fail('cards.js did not initialize SDT.Cards');

  // Simulate a clean browser profile so all first-party tabletop batches and
  // the source's id/class/derived-field migrations are represented. No user
  // storage or network is read by this adapter.
  for (const method of ['ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields', 'ensureDmgValues']) {
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
    // STARTERS has no source IDs; the browser creates Date-based IDs when the
    // fallback is used. Keep it as a separate deterministic table with stable
    // adapter IDs so a Godot save never depends on wall-clock time.
    starterCards: (cards.STARTERS || []).map((card, index) => ({
      id: ['starter-recruit-drill', 'starter-emergency-bandage', 'starter-ration-kit'][index] || `starter-${index + 1}`,
      ...JSON.parse(JSON.stringify(card)),
    })),
    _hash: sourceHash(source),
  };
}

function exportMap(rules) {
  const source = readSource('map');
  const adapted = source.replace(/^\s*import\s+\{\s*RULES\s*\}\s+from\s+['"]\.\/rules\.js['"];?\s*$/m, `const RULES = ${JSON.stringify(rules)};`);
  const sandbox = evaluate(adapted, 'globalThis.__map = window.SDT.MAP;', 'mapData.js');
  const map = sandbox.__map;
  if (!map) fail('mapData.js did not initialize SDT.MAP');
  const rings = [0, 1, 2].map(inset => map.makeRing(inset));
  // A layer's logical ring includes entrance/door cells even when those cells
  // have no explicit `cells` event entry. Keep the topology count, not the
  // event-entry count, for deterministic node layout.
  const logicalCounts = rings.map(ring => ring.length);
  return {
    schemaVersion: 1,
    map: JSON.parse(JSON.stringify(map)),
    rings,
    logicalCounts,
    nodePositions: map.buildNodePositions(logicalCounts),
    _hash: sourceHash(source),
  };
}

function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const chars = exportCharacters();
  const rules = exportRules();
  const cards = exportCards();
  const map = exportMap(rules.rules);

  const manifest = {
    schemaVersion: 1,
    source: '搜打撤/game/src',
    encoding: 'UTF-8',
    generatedBy: 'SoudacheGodot/tools/export_data.mjs',
    files: {
      cards: { path: 'cards.json', source: 'cards.js', sha256: cards._hash, count: cards.cards.length, starterCount: cards.starterCards.length },
      characters: { path: 'characters.json', source: 'characters.js', sha256: chars._hash, count: chars.characters.length },
      rules: { path: 'rules.json', source: 'rules.js', sha256: rules._hash },
      map: { path: 'map.json', source: 'mapData.js', sha256: map._hash, layers: map.map.layers.length },
    },
  };
  delete cards._hash;
  delete chars._hash;
  delete rules._hash;
  delete map._hash;
  writeJson('cards.json', cards);
  writeJson('characters.json', chars);
  writeJson('rules.json', rules);
  writeJson('map.json', map);
  writeJson('manifest.json', manifest);
  console.log(`[export-data] wrote ${cards.cards.length} cards, ${chars.characters.length} characters, ${map.map.layers.length} map layers`);
}

main();
