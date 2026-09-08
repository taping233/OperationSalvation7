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
const EXPECTED = {
  cards: 243,
  characters: 5,
  layers: 3,
  ringLengths: [28, 20, 12],
  eventEntryCounts: [20, 20, 12],
  cardTypes: { '武术': 61, '法术': 74, '生物': 17, '资源': 14, '道具': 19, '装备': 37, '事件': 10, '英雄卡': 11 },
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
  }
}

function validateCards(cardsData, charactersData) {
  const cards = cardsData.cards || [];
  const ids = uniqueIds(cards, 'cards');
  const starterIds = uniqueIds(cardsData.starterCards || [], 'starter cards');
  for (const id of starterIds) check(!ids.has(id), `starter card id collides with card id: ${id}`);
  check((cardsData.starterCards || []).length === 3, `starter card count ${cardsData.starterCards?.length} != expected 3`);
  check(cards.length === EXPECTED.cards, `card count ${cards.length} != expected ${EXPECTED.cards}`);
  const classes = new Set(cardsData.classes || []);
  const types = new Set(cardsData.types || []);
  const rarities = new Set(cardsData.rarities || []);
  check(classes.size === 5, `card class table should have 5 classes, got ${classes.size}`);
  check(types.size === 8, `card type table should have 8 types, got ${types.size}`);
  check(rarities.size === 8, `card rarity table should have 8 rarities, got ${rarities.size}`);
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
  check(JSON.stringify(actualTypes) === JSON.stringify(EXPECTED.cardTypes), `card type counts changed: ${JSON.stringify(actualTypes)}`);
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
  check(map.version === '0.3', `map version expected 0.3, got ${map.version}`);
  check(map.boardId === 'B1', `map boardId expected B1, got ${map.boardId}`);
  check(map.cols === 30 && map.rows === 30 && map.tile === 48, 'map dimensions must remain 30x30 tiles at 48px');
  check(JSON.stringify(mapData.logicalCounts) === JSON.stringify(EXPECTED.ringLengths), `ring topology changed: ${JSON.stringify(mapData.logicalCounts)}`);
  check(JSON.stringify((mapData.rings || []).map(ring => ring.length)) === JSON.stringify(EXPECTED.ringLengths), 'ring coordinate counts do not match topology');
  check((map.layers || []).length === EXPECTED.layers, `map layer count ${map.layers?.length} != expected ${EXPECTED.layers}`);
  check(JSON.stringify((map.layers || []).map(layer => Object.keys(layer.cells || {}).length)) === JSON.stringify(EXPECTED.eventEntryCounts), 'map event entry counts changed');

  const monsterIds = uniqueIds(Object.values(map.monsters || {}), 'map monsters');
  const chestIds = new Set(Object.keys(map.chestKinds || {}));
  const bossIds = uniqueIds(map.altar?.bosses || [], 'altar bosses');
  for (const encounter of map.encounters || []) {
    for (const id of encounter.pool || []) check(monsterIds.has(id), `encounter references missing monster ${id}`);
    for (const id of encounter.elite?.pool || []) check(monsterIds.has(id), `elite encounter references missing monster ${id}`);
  }
  for (const event of map.eventEnemies || []) check(monsterIds.has(event.id), `event enemy references missing monster ${event.id}`);
  for (const event of map.randomEvents || []) if (event.item) check(event.item === 'chest' || event.item in map.items, `random event references missing item ${event.item}`);
  for (const layer of map.layers || []) {
    for (const door of layer.doors || []) check(Number.isInteger(door.toLayer) && door.toLayer >= 1 && door.toLayer < map.layers.length, `door ${door.pair} has invalid toLayer ${door.toLayer}`);
    for (const cell of Object.values(layer.cells || {})) check(typeof cell.type === 'string', `layer ${layer.id} has cell without type`);
  }
  for (const options of map.layerChests || []) for (const group of options) for (const drop of group) check(chestIds.has(drop.k), `layer chest references missing chest kind ${drop.k}`);
  check(bossIds.size === 3, `altar boss count ${bossIds.size} != 3`);
  check((map.center || []).filter(cell => cell.type === 'boss').length === 3, 'center must contain 3 boss cells');
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
  console.log(`[validate-data] OK: ${cards.cards.length} cards, ${characters.characters.length} characters, ${map.map.layers.length} layers; ids/references/rules verified`);
}

main();
