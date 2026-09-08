#!/usr/bin/env node
/**
 * Offline converter for an explicit Web/Electron localStorage export.
 *
 * Usage: node tools/import-localstorage.mjs --input export.json --output saves
 * The tool never discovers, opens, or walks a browser profile/private storage
 * directory. The input must be a regular JSON file supplied by the user.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const GODOT_DIR = path.resolve(TOOL_DIR, '..');
const CURRENT_VERSION = 3;
const SLOT_COUNT = 5;

function fail(message) { throw new Error(`[import-localstorage] ${message}`); }
function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }
function parseJson(value, label) {
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (error) { fail(`${label} is not valid JSON: ${error.message}`); }
  }
  return value;
}
function object(value, label) {
  const out = parseJson(value, label);
  if (!out || typeof out !== 'object' || Array.isArray(out)) fail(`${label} must be a JSON object`);
  return out;
}
function integer(value, fallback = 0) {
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : fallback;
}
function array(value) { return Array.isArray(value) ? value : []; }
function defaultsBase(raw = {}) {
  const base = {
    wood: integer(raw.wood), rations: integer(raw.rations), keys: integer(raw.keys),
    bagUp: integer(raw.bagUp), safeUp: integer(raw.safeUp), stashUp: integer(raw.stashUp), coins: integer(raw.coins),
    stash: array(raw.stash), pocket: array(raw.pocket), collection: raw.collection && typeof raw.collection === 'object' && !Array.isArray(raw.collection) ? raw.collection : {},
    selMode: ['standard', 'elite', 'casual'].includes(raw.selMode) ? raw.selMode : 'standard',
    classes: raw.classes && typeof raw.classes === 'object' && !Array.isArray(raw.classes) ? raw.classes : {},
    stats: raw.stats && typeof raw.stats === 'object' && !Array.isArray(raw.stats) ? raw.stats : {},
    achClaimed: raw.achClaimed && typeof raw.achClaimed === 'object' && !Array.isArray(raw.achClaimed) ? raw.achClaimed : {},
    backs: raw.backs && typeof raw.backs === 'object' && !Array.isArray(raw.backs) ? { ...raw.backs, classic: true } : { classic: true },
    backSel: raw.backSel || 'classic',
  };
  if (!base.backs[base.backSel]) base.backSel = 'classic';
  base.stats = {
    extracts: integer(base.stats.extracts), deaths: integer(base.stats.deaths), kills: integer(base.stats.kills), actions: integer(base.stats.actions),
    playSeconds: Number.isFinite(Number(base.stats.playSeconds)) ? Number(base.stats.playSeconds) : 0,
    bossKills: array(base.stats.bossKills), bestRunCoins: integer(base.stats.bestRunCoins), stashTotal: integer(base.stats.stashTotal),
  };
  return base;
}
function defaultsRun(raw = {}, slot) {
  const rng = raw.rngState;
  const streams = rng && typeof rng === 'object' && !Array.isArray(rng) ? rng : (raw.rngStreams || {});
  const numericRng = Number.isSafeInteger(Number(rng)) ? Number(rng) : integer(raw.rngState);
  const savedAtNumber = Number(raw.savedAt);
  const savedAtUtc = Number.isFinite(savedAtNumber) ? new Date(savedAtNumber).toISOString() : (typeof raw.savedAtUtc === 'string' ? raw.savedAtUtc : '');
  return {
    version: CURRENT_VERSION, slot, savedAtUtc,
    runActive: raw.runActive !== false, seed: integer(raw.seed), rngState: numericRng,
    rngStreams: Object.fromEntries(Object.entries(streams).filter(([, v]) => Number.isSafeInteger(Number(v))).map(([k, v]) => [k, Number(v)])),
    layerIdx: integer(raw.layerIdx), trackPos: integer(raw.trackPos), hp: integer(raw.hp, 30), maxHp: integer(raw.maxHp, 30), coins: integer(raw.coins),
    turn: integer(raw.turn, 1), atk: integer(raw.atk, 4), mode: ['standard', 'elite', 'casual'].includes(raw.mode) ? raw.mode : 'standard',
    myClass: raw.myClass ?? null, characterId: raw.characterId ?? null, inventory: array(raw.inventory), ownedCards: array(raw.ownedCards), cardOrder: array(raw.cardOrder), usedPocket: array(raw.usedPocket),
    eventLog: array(raw.eventLog), discovered: array(raw.discovered), diceHistory: array(raw.diceHistory), elapsed: Number.isFinite(Number(raw.elapsed)) ? Number(raw.elapsed) : 0, stamina: integer(raw.stamina, 60),
    deck: raw.deck && typeof raw.deck === 'object' && !Array.isArray(raw.deck) ? raw.deck : { cards: [] }, combat: raw.combat ?? null, flags: raw.flags && typeof raw.flags === 'object' && !Array.isArray(raw.flags) ? raw.flags : {},
  };
}
function normalizeEntries(input) {
  const source = object(input, 'export root');
  const nested = source.localStorage ?? source.storage ?? source.values ?? source;
  if (Array.isArray(nested)) return Object.fromEntries(nested.map(entry => [entry.key, entry.value]));
  return object(nested, 'localStorage export');
}
function readSlot(entries, prefix, slot) { return entries[`${prefix}${slot}`] == null ? null : object(entries[`${prefix}${slot}`], `${prefix}${slot}`); }
function checkSourceVersion(raw, label) {
  const version = raw?.version == null ? 0 : integer(raw.version, NaN);
  if (!Number.isInteger(version) || version < 0) fail(`${label} has an invalid version`);
  // The browser contract currently publishes v1. A future source shape must
  // be handled by a deliberate migration, never guessed into a Godot save.
  if (version > 1) fail(`${label} version ${version} is newer than importer support (1)`);
}
function validate(save) {
  if (!Number.isInteger(save.slot) || save.slot < 0 || save.slot >= SLOT_COUNT) fail(`invalid output slot ${save.slot}`);
  if (save.hp < 0 || save.maxHp <= 0 || save.hp > save.maxHp || save.coins < 0 || save.stamina < 0) fail(`invalid run values in slot ${save.slot + 1}`);
  for (const stack of [...save.base.stash, ...save.base.pocket]) if (!stack || !stack.card || !Number.isInteger(stack.count) || stack.count <= 0) fail(`invalid base card stack in slot ${save.slot + 1}`);
}
export function assertInputPath(inputPath) {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) fail('input must be an existing regular JSON file');
  if (/(?:[/\\](?:User Data|Local Storage|IndexedDB)[/\\])/i.test(resolved)) fail('browser profile/private storage paths are refused; export localStorage to a standalone JSON file first');
  return resolved;
}
export function convertEntries(input, output) {
  const entries = normalizeEntries(input);
  if (entries['sdt-save-v1'] != null && entries['sdt-save-v2-slot1'] == null) entries['sdt-save-v2-slot1'] = entries['sdt-save-v1'];
  if (entries['sdt-base-v1'] != null && entries['sdt-base-v2-slot1'] == null) entries['sdt-base-v2-slot1'] = entries['sdt-base-v1'];
  const outputPath = path.resolve(output);
  fs.mkdirSync(outputPath, { recursive: true });
  const written = [];
  for (let sourceSlot = 1; sourceSlot <= SLOT_COUNT; sourceSlot++) {
    const run = readSlot(entries, 'sdt-save-v2-slot', sourceSlot); const base = readSlot(entries, 'sdt-base-v2-slot', sourceSlot);
    if (!run && !base) continue;
    if (run) checkSourceVersion(run, `run slot ${sourceSlot}`);
    if (base) checkSourceVersion(base, `base slot ${sourceSlot}`);
    const save = defaultsRun(run || {}, sourceSlot - 1); save.runActive = !!run; save.base = defaultsBase(base || {}); validate(save);
    const file = `save_${sourceSlot - 1}.json`;
    fs.writeFileSync(path.join(outputPath, file), `${JSON.stringify(save, null, 2)}\n`, 'utf8'); written.push(file);
  }
  fs.writeFileSync(path.join(outputPath, 'import-manifest.json'), `${JSON.stringify({ schemaVersion: CURRENT_VERSION, source: 'localStorage-export', sourceSlots: SLOT_COUNT, files: written }, null, 2)}\n`, 'utf8');
  return written;
}
function main() {
  const argv = process.argv.slice(2);
  const input = arg('--input', argv); const output = arg('--output', argv);
  if (!input || !output || argv.includes('--help')) { console.error('Usage: node tools/import-localstorage.mjs --input <export.json> --output <save-directory>'); process.exitCode = input || output ? 1 : 0; return; }
  const inputPath = assertInputPath(input);
  const written = convertEntries(JSON.parse(fs.readFileSync(inputPath, 'utf8')), output);
  console.log(`[import-localstorage] wrote ${written.length} slot(s) to ${path.resolve(output)}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
