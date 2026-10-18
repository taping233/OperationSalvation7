import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const require = createRequire(path.join(root, 'package.json'));
const { parse } = require('acorn');
const { esc, escAttr } = await import(pathToFileURL(path.join(root, 'game/src/core/shared.js')));
const { bagUseStatus, bagUseLocation } = await import(pathToFileURL(path.join(root, 'game/src/hub/game.bag.rules.js')));
const { stackCapOf } = await import(pathToFileURL(path.join(root, 'game/src/core/card-capacity.js')));
const bag = fs.readFileSync(path.join(root, 'game/src/hub/game.bag.js'), 'utf8');
const baseline = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'baseline/game.bag.js.txt'), 'utf8');
const session = fs.readFileSync(path.join(root, 'game/src/run/game.session.bag.js'), 'utf8');
const view = fs.readFileSync(path.join(root, 'game/src/hub/game.bag.view2.js'), 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export (?=function )/g, '');
function fn(text, name) {
  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  for (let n of ast.body) {
    if (n.type === 'ExportNamedDeclaration') n = n.declaration;
    if (n?.type === 'FunctionDeclaration' && n.id.name === name) return text.slice(n.start, n.end);
  }
  throw new Error(`missing ${name}`);
}
const stacks = fn(session, 'cardStacks').replace('{', '{ stats.groupings++; stats.visits += game.ownedCards.length;');
function harness(game, zone, filter, optimized) {
  let model, html;
  const stats = { groupings: 0, visits: 0 };
  const noop = () => {};
  const deps = {
    game, stats, initialZone: zone,
    UI: { log: noop, helpBtn: () => '<button>?</button>', el: { overlay: { hidden: false } }, registerHelp: noop, showOverlay: (_t, value) => { html = value; } },
    SDT: { Base: { bagCap: () => 24, carriedPet: () => ({ name: 'pet' }) } },
    document: { getElementById: () => null },
    stackCapOf, bagV2Rarity: c => c.rarity || '普通', bagUseStatus,
    bagSlots: { bindBagDrag: noop }, esc,
    captureBattleContext: () => () => true,
    resetBagDrag: noop, _set_cardPageOpen: noop, bagAct: noop, closeBackpack: noop, sortBagBy: noop, openBagZoom: noop,
  };
  deps.SDT.UI = deps.UI;
  deps.SDT.Cards = { all: () => [], cardHTML: c => `<span data-card="${escAttr(c.id || c.name)}">${esc(c.name)}</span>` };
  const pageHTML = new Function('SDT', 'window', 'esc', 'escAttr', 'bagUseLocation', `${view}\nreturn pageHTML;`)(deps.SDT, { SDT:deps.SDT }, esc, escAttr, bagUseLocation);
  deps.bagV2PageHTML = x => { model = x; return pageHTML(x); };
  const current = optimized ? bag : baseline;
  const src = `const {${Object.keys(deps).join(',')}} = deps;
    let bagZone = initialZone, bagFilter = ${JSON.stringify(filter)}, bagSortKey = 'rarity', bagReceipt = null;
    let requestedBagSection = null, backpackOpen = false, bagOverChest = false, bagDrag = false;
    const safeCap = () => 6, bagCap = () => 24;
    ${stacks}\n${fn(session, 'usedSlots')}\n${fn(session, 'bagCapacityText')}
    const pearlBonus = () => 0; game.bagCapacityText = bagCapacityText;
    ${fn(current, 'syncCardOrder')}\n${fn(current, 'sortStacksByOrder')}\n${fn(current, 'bagZoneTiles')}\n${fn(current, 'showBackpack')}
    return () => showBackpack(true);`;
  const render = new Function('deps', src)(deps);
  return { stats, render: () => { render(); return { model:JSON.parse(JSON.stringify(model)), html }; } };
}
function fixture() {
  const cards = [
    ...Array.from({ length: 7 }, (_, i) => ({ uid: `a${i}`, card: { name: '法术A', type: '法术', cost: 2 }, safe: false })),
    ...Array.from({ length: 3 }, (_, i) => ({ uid: `b${i}`, card: { name: '装备B', type: '装备', cost: 1 }, safe: false, equipped:i === 0 })),
    { uid: 'c0', card: { name: '资源C', type: '资源' }, safe: true },
    { uid: 'd0', card: { name: '收藏D', type: '资源' }, stored: true },
    { uid: 'e0', card: { id:'tt-crystal', name: '道具E', type: '道具' }, safe: false },
  ];
  return { ownedCards: cards, inventory: [{ name: '物资', value: 3, count: 5 }], usedPocket: [{ card: { name: '消耗F', type: '法术' }, count: 2 }], cardOrder: ['装备B', '过期卡'], runActive: true, myClass: '法师', state: 'idle', coins: 20, fragments: 2 };
}
const results = [];
for (const fixtureKind of ['mixed', 'empty', 'atCapacity']) for (const zone of ['bag', 'safe', 'pocket']) for (const filter of ['all', 'move', '装备', '道具', '资源', 'supply']) {
  const create = () => {
    const g = fixture();
    if (fixtureKind === 'empty') { g.ownedCards = []; g.inventory = []; g.usedPocket = []; }
    if (fixtureKind === 'atCapacity') g.inventory = [{ name:'木材', count:51, value:1 }];
    return g;
  };
  const a = harness(create(), zone, filter, false), b = harness(create(), zone, filter, true);
  const before = a.render(), after = b.render();
  assert.deepEqual(after, before);
  const first = { before: { ...a.stats }, after: { ...b.stats } };
  // The same array is mutated between renders: the snapshot must be rebuilt.
  const next = { uid: 'new', card: { name: '新增G', type: '法术' }, safe: false };
  // Expose this through the model's existing card reference is deliberately avoided;
  // rebuild with an in-place-mutated fixture below to verify current data is read.
  const g1 = create(), g2 = create();
  const a2 = harness(g1, zone, filter, false), b2 = harness(g2, zone, filter, true);
  a2.render(); b2.render(); g1.ownedCards.push(next); g2.ownedCards.push(structuredClone(next));
  assert.deepEqual(b2.render(), a2.render());
  results.push({ fixtureKind, zone, filter, modelEqual:true, htmlEqual:true, inPlaceMutationEqual:true, ...first });
}
const out = { note:'Current source versus preserved baseline, actual status rules. Full page HTML with controlled card renderer; no browser timing.', cases:results.length, results };
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), 'bag-render-probe.json');
fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ cases:results.length, passed:true, representative:results.filter(x => x.fixtureKind === 'mixed' && x.filter === 'all') }));
