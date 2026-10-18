import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { JSDOM } from 'jsdom';
import { isConsumedMapNode, mapNodeStatus } from '../../../../game/src/core/map-node-state.js';
import { mapNodeInfo } from '../../../../game/src/core/node-info.js';
import { entrySupplyGate } from '../../../../game/src/run/node-reward-state.js';
import { recodeEligibleCards } from '../../../../game/src/run/event-recode-candidates.js';
import { esc, escAttr } from '../../../../game/src/core/shared.js';

const root = new URL('../../../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const baseline = path => readFileSync(new URL(`baseline/${path.replaceAll('/', '__')}.txt`, import.meta.url), 'utf8');
const ast = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function declaration(source, name) {
  const node = ast(source).body.map(node => node.declaration || node).find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  if (!node) throw new Error(`Missing function ${name}`);
  return source.slice(node.start, node.end);
}
function compile(source, names, ports) {
  return new Function(...Object.keys(ports), `${names.map(name => declaration(source, name)).join('\n')}\nreturn ${names.at(-1)};`)(...Object.values(ports));
}
const equal = (a, b, label) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Different ${label}`); };
const target = idx => ({ li: 0, idx });
function branchMap(branches = 30) {
  const blocked = branches + 1, end = branches + 2;
  const logical = Array.from({ length: end + 1 }, (_, idx) => ({ def: { type: idx === 0 ? 'entrance' : idx === blocked ? 'battle' : idx === end ? 'chest' : 'blank' },
    next: idx === 0 ? Array.from({ length: branches }, (_, i) => [0, i + 1]) : idx === end ? [] : [[0, idx === blocked ? end : blocked]],
  }));
  return { blocked, end, game: { layerIdx: 0, trackPos: 0, layerData: [{ logical, doors: [] }], visited: {}, nodeRewards: {},
    seen: Object.fromEntries(logical.map((_, idx) => [`0,${idx}`, 1])),
  } };
}
const report = { scope: 'Deterministic synchronous operation counts; no browser FPS/RSS claim', createdAt: new Date().toISOString() };

const pathFile = 'game/src/run/map-travel-path.js';
const pathRuns = [baseline(pathFile), read(pathFile)].map(source => {
  let checked = 0;
  const { game, end } = branchMap();
  const find = compile(source, ['findMapTravelPath'], { entrySupplyGate, isConsumedMapNode: (...args) => { checked++; return isConsumedMapNode(...args); } });
  return { result: find(game, target(end)), blockedStateQueries: checked };
});
equal(pathRuns[0].result, pathRuns[1].result, 'BFS path');
report.longRoute = { fixture: '30 cleared branches meet the same unresolved battle, distant target behind it', before: pathRuns[0], after: pathRuns[1] };

const routeFile = 'game/src/run/expedition.view.js';
const routeRuns = [baseline(routeFile), read(routeFile)].map(source => {
  const { game } = branchMap(6);
  game.layerData[0].logical.forEach((node, index) => { if (index > 0 && index < 7) node.def.type = 'chest'; });
  const rewards = game.nodeRewards; let reads = 0;
  Object.defineProperty(game, 'nodeRewards', { get() { reads++; return rewards; } });
  const routes = compile(source, ['expeditionRoutes'], { isConsumedMapNode, mapNodeStatus, mapNodeInfo,
    previousRoutePlan: game => game.routePlan, routeChoicePreview: () => null, getExpeditionPreview: () => null,
  })(game);
  return { routes, rewardRecordReads: reads };
});
equal(routeRuns[0].routes, routeRuns[1].routes, 'route projection');
report.routeProjection = { adjacentNodes: 6, before: { rewardRecordReads: routeRuns[0].rewardRecordReads }, after: { rewardRecordReads: routeRuns[1].rewardRecordReads }, outputsEqual: true };

const cards = Array.from({ length: 600 }, (_, i) => ({ id: `c${i}`, name: `卡${i % 107}`, type: ['武术', '法术', '装备', '道具'][i % 4],
  rarity: ['古朴', '稀有', '职业'][i % 3], cls: i % 2 ? '法师' : '侠客', hero: i % 23 === 0, unrandom: i % 11 === 0,
}));
const ownedCards = cards.slice(0, 80).map((card, i) => ({ uid: `u${i}`, card, safe: i % 13 === 0, stored: i % 17 === 0 }));
const obtainable = card => !['初始', '职业', '衍生', '棱彩'].includes(card.rarity) && !card.unrandom;
function recodeRun(before) {
  let entries = 0, checks = 0;
  const library = new Proxy(cards, { get(array, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) entries++; return Reflect.get(array, key, receiver); } });
  const check = card => { checks++; return obtainable(card); }, game = { ownedCards, myClass: '侠客' };
  let eligible;
  if (before) {
    const source = baseline('game/src/run/game.run.flow.js');
    const SDT = { Cards: { all: () => library, isRandomObtainable: check } };
    const transformCandidates = compile(source, ['transformCandidates'], { SDT, game });
    const open = ast(source).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'openEventRecode');
    const init = open.body.body.flatMap(node => node.declarations || []).find(node => node.id.name === 'eligible').init;
    eligible = new Function('game', 'transformCandidates', `return (${source.slice(init.start, init.end)});`)(game, transformCandidates);
  } else eligible = recodeEligibleCards(ownedCards, library, '侠客', check);
  return { ids: eligible.map(entry => entry.uid), catalogEntryReads: entries, randomObtainableChecks: checks };
}
const beforeRecode = recodeRun(true), afterRecode = recodeRun(false);
equal(beforeRecode.ids, afterRecode.ids, 'recode eligibility');
report.recode = { catalogSize: cards.length, ownedSize: ownedCards.length, eligibleCount: afterRecode.ids.length,
  before: { catalogEntryReads: beforeRecode.catalogEntryReads, randomObtainableChecks: beforeRecode.randomObtainableChecks },
  after: { catalogEntryReads: afterRecode.catalogEntryReads, randomObtainableChecks: afterRecode.randomObtainableChecks }, outputsEqual: true,
};

const dom = new JSDOM('<!doctype html><body></body>');
const document = dom.window.document;
const sceneFile = 'game/src/ui/node-scene-view.js';
function sceneRun(source, args) {
  let templates = 0;
  const create = document.createElement.bind(document);
  document.createElement = (...args) => { if (args[0] === 'template') templates++; return create(...args); };
  try { return { html: compile(source, ['mergeSingleOptionDescription', 'eventSceneHTML'], { document, esc, escAttr })(args), templates }; }
  finally { document.createElement = create; }
}
const button = '<button class="evt-opt" data-act="one"><b>接通</b><span>补给。</span></button>';
report.nodeTemplateParsing = ['fire', 'pickup', 'entry', 'door', 'altar', 'extract', 'event-multiple', 'event-single'].map(kind => {
  const args = { tone: kind.startsWith('event') ? 'event' : kind, title: '节点', layer: 0, body: kind === 'event-multiple' ? button + button : button, sub: kind === 'event-single' ? '<b>补给！</b>' : '' };
  const before = sceneRun(baseline(sceneFile), args), after = sceneRun(read(sceneFile), args);
  equal(before.html, after.html, `${kind} HTML`);
  return { kind, beforeTemplates: before.templates, afterTemplates: after.templates, htmlEqual: true };
});
dom.window.close();

function calls(source, name) {
  let count = 0;
  simple(ast(source), { CallExpression(node) { if (node.callee.type === 'MemberExpression' && node.callee.property.name === name) count++; } });
  return count;
}
const classFile = 'game/src/run/game.run.class-choice.page.js';
report.characterChoice = { sourceCallSites: [baseline(classFile), read(classFile)].map(source => ({
  warmClassRoster: calls(source, 'warmClassRoster'), visibleFullArt: calls(source, 'classFullArt'), rosterAvatarArt: calls(source, 'classAvatarArt'),
})), speculativeBatchUrlsBefore: 5, speculativeBatchUrlsAfter: 0,
  boundary: 'Five default full-art URLs previously submitted to Art.warm; this is not five guaranteed network transfers, decodes, or an RSS measurement.' };
writeFileSync(new URL('operation-counts.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
console.log(`Saved ${fileURLToPath(new URL('operation-counts.json', import.meta.url))}`);
