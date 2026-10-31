import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const game = path.resolve(directory, '../../../../搜打撤/game');
const { createBaseEconomy } = await import(pathToFileURL(path.join(game, 'src/hub/base-economy.js')).href);
const { previewCollectionConversion } = await import(pathToFileURL(path.join(game, 'src/hub/collection-conversion.js')).href);
const catalog = JSON.parse(readFileSync(path.resolve(directory, '../battle/current-catalog.json'), 'utf8'));
const profession = catalog.cards.find(card => card.rarity === '职业' && card.cls === '侠客');
const ability = catalog.cards.find(card => card.type === '能力卡' && card.cls === '侠客');
const purchases = [];
for (const scenario of [
  { name: 'poor-material', coins: 3, room: 9, input: { material: 'wood', price: 4 } },
  { name: 'material-success', coins: 4, room: 0, input: { material: 'wood', price: 4 } },
  { name: 'full-card', coins: 6, room: 0, input: { card: profession, price: 6 } },
  { name: 'card-success', coins: 6, room: 1, input: { card: profession, price: 6 } },
]) {
  const state = { coins: scenario.coins, wood: 0, rations: 0, keys: 0, stash: [] };
  const economy = createBaseEconomy({ read: () => state, room: () => scenario.room,
    mutate: prepare => prepare(state), appendCards: (draft, cards) => draft.stash.push(...cards) });
  purchases.push({ name: scenario.name, before: { coins: scenario.coins, room: scenario.room }, input: scenario.input,
    result: economy.purchase(scenario.input), after: state });
}
const conversions = [];
for (const scenario of [
  { name: 'first-profession', card: profession, lv: 1, xp: 0, count: 1, available: 3 },
  { name: 'last-card-overflow', card: profession, lv: 9, xp: 369, count: 1, available: 3 },
  { name: 'bulk-exceeds-remaining', card: profession, lv: 9, xp: 369, count: 2, available: 3 },
  { name: 'ability-gain', card: ability, lv: 1, xp: 0, count: 1, available: 1 },
  { name: 'maxed-register-only', card: profession, lv: 10, xp: 0, count: 1, available: 2 },
  { name: 'maxed-already-registered', card: profession, lv: 10, xp: 0, count: 1, available: 2, registered: true },
  { name: 'protected', card: profession, lv: 1, xp: 0, count: 1, available: 2, registered: true, protected: true },
]) {
  const base = { characters: { wu: { lv: scenario.lv, xp: scenario.xp } }, collection: {} };
  if (scenario.registered) base.collection[scenario.card.id] = { protected: scenario.protected === true };
  const input = { baseSnapshot: base, card: scenario.card, count: scenario.count, availableCount: scenario.available };
  conversions.push({ name: scenario.name, input, expected: previewCollectionConversion(input) });
}
writeFileSync(path.join(directory, 'hub-reference-vectors.json'), JSON.stringify({ purchases, conversions }, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, purchases: purchases.length, conversions: conversions.length }));
