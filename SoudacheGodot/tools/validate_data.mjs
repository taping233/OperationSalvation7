#!/usr/bin/env node
/** Validate the generated Godot JSON contract without loading browser code. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const GODOT_DIR = path.resolve(TOOL_DIR, '..');
const ROOT_DIR = path.resolve(GODOT_DIR, '..');
const DATA_DIR = path.join(GODOT_DIR, 'data');
const SOURCE_DIR = path.join(ROOT_DIR, '搜打撤', 'game', 'src');
// 2026-09-11 架构批次 2 后的实际口径（干净环境 C.all()）：
// 245 张卡；「英雄卡」已定版更名「能力卡」；TT11 退役与 cards-sync 定版覆盖均已生效。
const EXPECTED = {
  cards: 245,
  characters: 5,
  cardTypes: { '武术': 64, '法术': 61, '生物': 25, '资源': 15, '道具': 23, '装备': 36, '事件': 10, '能力卡': 11 },
};

const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const fail = message => { throw new Error(message); };

function load(name) {
  const filePath = path.join(DATA_DIR, name);
  check(fs.existsSync(filePath), `missing data file: ${name}`);
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (error) { errors.push(`invalid UTF-8 JSON ${name}: ${error.message}`); return {}; }
}

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items || []) {
    check(item && typeof item.id === 'string' && item.id.length > 0, `${label} has missing id`);
    if (!item?.id) continue;
    check(!ids.has(item.id), `${label} duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function validateManifest(manifest) {
  check(manifest.schemaVersion === 1, 'manifest schemaVersion must be 1');
  check(manifest.encoding === 'UTF-8', 'manifest encoding must be UTF-8');
  for (const [key, info] of Object.entries(manifest.files || {})) {
    const filePath = path.join(DATA_DIR, info.path || '');
    check(fs.existsSync(filePath), `manifest ${key} points to missing file: ${info.path}`);
    if (fs.existsSync(filePath) && info.sha256) check(hash(path.join(SOURCE_DIR, info.source)) === info.sha256, `source hash drift for ${info.source}; rerun export_data.mjs`);
    // 依赖的网页版文件（game/data/*.json 与垫片宿主）同样做哈希漂移检查。
    for (const dep of info.deps || []) {
      const depPath = path.join(ROOT_DIR, dep.path);
      check(fs.existsSync(depPath), `manifest ${key} dep is missing: ${dep.path}`);
      if (fs.existsSync(depPath) && dep.sha256) check(hash(depPath) === dep.sha256, `dep hash drift for ${dep.path}; rerun export_data.mjs`);
    }
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== 'object') return value;
  return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(stableJson(value[key]))])));
}

function validateCards(cardsData, charactersData) {
  const cards = cardsData.cards || [];
  const ids = uniqueIds(cards, 'cards');
  // STARTERS 自 09-11 定版起携带源 id，可能就是主卡库里的同一张牌
  // （网页版 ensureStarters 只是确保存在）；因此只要求起始卡之间不重 id。
  const starterIds = uniqueIds(cardsData.starterCards || [], 'starter cards');
  check((cardsData.starterCards || []).length === 3, `starter card count ${cardsData.starterCards?.length} != expected 3`);
  check(cards.length === EXPECTED.cards, `card count ${cards.length} != expected ${EXPECTED.cards}`);
  const classes = new Set(cardsData.classes || []);
  const types = new Set(cardsData.types || []);
  const rarities = new Set(cardsData.rarities || []);
  check(classes.size === 5, `card class table should have 5 classes, got ${classes.size}`);
  check(types.size === 8, `card type table should have 8 types, got ${types.size}`);
  check(rarities.size === 8, `card rarity table should have 8 rarities, got ${rarities.size}`);
  check(types.has('能力卡') && !types.has('英雄卡'), 'type table must use the renamed 能力卡 (no legacy 英雄卡)');
  for (const card of cards) {
    check(types.has(card.type), `card ${card.id} has unknown type ${card.type}`);
    check(rarities.has(card.rarity), `card ${card.id} has unknown rarity ${card.rarity}`);
    if (card.cls) check(classes.has(card.cls), `card ${card.id} has unknown class ${card.cls}`);
    if (card.tokenOf) check(ids.has(card.tokenOf), `card ${card.id} tokenOf missing card ${card.tokenOf}`);
    if (card.dmgType) check((cardsData.damageTypes || []).includes(card.dmgType), `card ${card.id} has unknown damage type ${card.dmgType}`);
    for (const key of ['cost', 'dmg', 'draw', 'infuse', 'heal', 'armor', 'value']) {
      if (card[key] !== undefined) check(Number.isFinite(card[key]), `card ${card.id} field ${key} must be numeric`);
    }
  }
  for (const card of cardsData.starterCards || []) {
    check(types.has(card.type), `starter card ${card.id} has unknown type ${card.type}`);
    check(rarities.has(card.rarity), `starter card ${card.id} has unknown rarity ${card.rarity}`);
  }
  const actualTypes = cards.reduce((out, card) => {
    out[card.type] = (out[card.type] || 0) + 1;
    return out;
  }, {});
  check(stableJson(actualTypes) === stableJson(EXPECTED.cardTypes), `card type counts changed: ${JSON.stringify(actualTypes)}`);
  check((charactersData.characters || []).length === EXPECTED.characters, `character count ${charactersData.characters?.length} != expected ${EXPECTED.characters}`);
}

function validateRules(rulesData) {
  const rules = rulesData.rules || {};
  const expected = {
    diceSides: 3, stepMs: 340, emergencyExitCost: 10, fireHeal: 8,
    fireClassCardChance: 0.3, staminaMax: 60, staminaWarn: 10,
    playerMaxHp: 30, playerAtk: 4, bagSize: 16, bagMax: 30,
    safeStart: 2, safeMax: 6, stashStart: 25, stashMax: 49,
    battleEnergy: 2, battleStartDraw: 5, battleTurnDraw: 1,
    battleHandMax: 8, bossDeckSize: 15, starterSha: 5,
  };
  for (const [key, value] of Object.entries(expected)) check(rules[key] === value, `rule ${key} expected ${value}, got ${rules[key]}`);
}

function validateMap(mapData, rulesData) {
  const map = mapData.map || {};
  // 09-10 四层定版后地图几何由 map-generator.js 运行期按种子生成，mapData.js
  // 只承载静态表；三环拓扑暂由 C# RunMap 承载（见 tests/Run），故本文件不再
  // 含 rings/layers，只校验静态表自身的完整性与引用。
  check(map.version === '0.3', `map version expected 0.3, got ${map.version}`);
  check(map.boardId === 'B1', `map boardId expected B1, got ${map.boardId}`);
  check(map.cols === 30 && map.rows === 30 && map.tile === 48, 'map dimensions must remain 30x30 tiles at 48px');

  const monsterIds = uniqueIds(Object.values(map.monsters || {}), 'map monsters');
  const chestIds = new Set(Object.keys(map.chestKinds || {}));
  const bossIds = uniqueIds(map.altar?.bosses || [], 'altar bosses');
  for (const encounter of map.encounters || []) {
    for (const entry of encounter.entries || []) check(monsterIds.has(entry.id), `encounter references missing monster ${entry.id}`);
    for (const id of encounter.elite?.pool || []) check(monsterIds.has(id), `elite encounter references missing monster ${id}`);
  }
  for (const event of map.eventEnemies || []) check(monsterIds.has(event.id), `event enemy references missing monster ${event.id}`);
  for (const enemy of map.enemyPool || []) check(monsterIds.has(enemy.id), `enemy pool references missing monster ${enemy.id}`);
  for (const event of map.randomEvents || []) if (event.item) check(event.item === 'chest' || event.item in map.items, `random event references missing item ${event.item}`);
  for (const layer of map.layerChests || []) for (const weighted of layer.types || []) check(chestIds.has(weighted.k), `layer chest references missing chest kind ${weighted.k}`);
  check(bossIds.size === 3, `altar boss count ${bossIds.size} != 3`);
  check(map.rules?.diceSides === rulesData.rules?.diceSides, 'map rules do not match rules.json');
}

function main() {
  const manifest = load('manifest.json');
  const cards = load('cards.json');
  const characters = load('characters.json');
  const rules = load('rules.json');
  const map = load('map.json');
  validateManifest(manifest);
  validateCards(cards, characters);
  validateRules(rules);
  validateMap(map, rules);
  if (errors.length) {
    for (const message of errors) console.error(`[validate-data] FAIL: ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[validate-data] OK: ${cards.cards.length} cards, ${characters.characters.length} characters, map static tables v${map.map.version}; ids/references/rules verified`);
}

main();
