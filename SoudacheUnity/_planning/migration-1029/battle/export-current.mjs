import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const taskDir = path.dirname(fileURLToPath(import.meta.url));
const unityRoot = path.resolve(taskDir, '../../..');
const sourceRoot = path.resolve(unityRoot, '../搜打撤');
const { createServer } = await import(pathToFileURL(path.join(sourceRoot, 'node_modules/vite/dist/node/index.js')).href);
const mem = new Map();
globalThis.window = globalThis;
globalThis.SDT = { Icons: { img: () => '' } };
globalThis.localStorage = {
  getItem: key => mem.get(key) ?? null,
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: key => mem.delete(key), clear: () => mem.clear(),
  key: index => [...mem.keys()][index] ?? null,
  get length() { return mem.size; },
};
globalThis.document = { body: null, head: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }) };
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.Image = class { addEventListener() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
const server = await createServer({ root: path.join(sourceRoot, 'game'), configFile: false,
  cacheDir: path.join(taskDir, '.vite'), optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'catalog-without-view', enforce: 'pre',
    transform(code, id) { if (id.replaceAll('\\', '/').endsWith('/cards/cards.view.js')) return 'export const cardHTML = () => ""; export const cardBackHTML = () => "";'; } }],
  server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const load = rel => server.ssrLoadModule('/src/' + rel);
  const randomModule = await load('core/random.js');
  const { Cards } = await load('cards/cards.js');
  Cards.STARTERS.forEach((card, index) => { if (!card.id) card.id = `starter-${index + 1}`; });
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const cards = Cards.all();
  const { CHARACTERS } = await load('core/characters.js');
  const { RULE_CONFIG } = await load('core/rule-config.js');
  const bestiaryIds = new Set(Cards.BESTIARY.map(card => card.id));
  const operations = {}, triggers = {}, fields = {};
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    if (value.op) operations[value.op] = (operations[value.op] ?? 0) + 1;
    for (const child of Object.values(value)) visit(child);
  };
  for (const card of cards) {
    for (const field of Object.keys(card)) fields[field] = (fields[field] ?? 0) + 1;
    for (const trigger of Object.keys(card.rules?.triggers ?? {})) triggers[trigger] = (triggers[trigger] ?? 0) + 1;
    visit(card.rules);
  }
  const packet = { cards, characters: CHARACTERS, config: RULE_CONFIG, bestiaryIds: [...bestiaryIds],policies:{price:Cards.PRICE,shopWeights:Cards.SHOP_WEIGHTS,dropWeights:Cards.DROP_WEIGHTS} };
  fs.writeFileSync(path.join(taskDir, 'current-catalog.json'), JSON.stringify(packet, null, 2) + '\n');
  fs.writeFileSync(path.join(taskDir, 'current-catalog-summary.json'), JSON.stringify({ count: cards.length,
    withRules: cards.filter(card => card.rules).length, operations, triggers, fields }, null, 2) + '\n');
  console.log(JSON.stringify({ count: cards.length, withRules: cards.filter(card => card.rules).length, operations, triggers, fields }));
  const { parse } = await import(pathToFileURL(path.join(sourceRoot, 'node_modules/acorn/dist/acorn.mjs')).href);
  const chestSource = fs.readFileSync(path.join(sourceRoot, 'game/src/run/chests.js'), 'utf8');
  const ast = parse(chestSource, { ecmaVersion: 'latest', sourceType: 'module' });
  const declaration = name => {
    const found = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    if (!found) throw new Error('Missing source function ' + name);
    return chestSource.slice(found.start, found.end);
  };
  const map = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'game/data/map.json'), 'utf8'));
  const sourceSdt = { MAP: map, Cards, Base: { petEggDropChance: () => 0.007, slot: 1,
    recordPetEggChestResult: () => Promise.resolve({ persisted: true }) }, game: { mode: 'standard' } };
  const drop = new Function('SDT', 'Random', 'classChestChance', 'UI', 'return (' + declaration('rollDrops') + ')')
    (sourceSdt, randomModule.Random, () => 0.25, { log() {} });
  const seen = new Function('return (' + declaration('panelSeen') + ')')();
  const contents = new Function('SDT', 'Random', 'KINDS', 'panelSeen', 'G', 'rndInt', 'UI', 'return (' + declaration('rollContents') + ')')
    (sourceSdt, randomModule.Random, () => map.chestKinds, seen, { myClass: '法师' },
      (a,b) => a + Math.floor(randomModule.Random.random('loot','reward') * (b-a+1)), { log() {} });
  const chestVectors = [];
  for (const seed of [1,123,20261029]) for (const layer of [0,1,2,3]) {
    randomModule.setRandomService(new randomModule.SeededRandomService(seed));
    const boxes = drop({ layer, isBoss: false });
    chestVectors.push({ seed, layer, boxes: boxes.map(box => (box.isClass ? 'class:' : '') + box.kind) });
  }
  const contentVectors = [];
  for (const seed of [1,123,20261029]) for (const kind of ['small','medium','large','boss']) for (const isClass of [false,true]) {
    randomModule.setRandomService(new randomModule.SeededRandomService(seed));
    const box = contents(kind,isClass);
    contentVectors.push({seed,kind,isClass,cards:box.cards.map(card=>card.id),coins:box.coins,claimMode:box.claimMode,choiceCount:box.choiceCount??0});
  }
  const { createCombatRuntime } = await load('battle/core/combat.factory.js');
  const combat = createCombatRuntime(); const damageVectors = [];
  for (const type of ['attack','spell','fixed','true']) for (const status of [{},{bleed:2},{abreak:1},{reduce:3},{immune:1},{stealth:1},{dodge:1}]) for (const amount of [-5,0,3,9]) {
    const attacker = {atk:4,spellPower:2,status:{atkUp:1,spellUp:1}};
    const target = {hp:20,maxHp:20,status:{...status},defense:{shield:2,armor:3,guard:true}};
    const input = structuredClone({attacker,target}); const result = combat.dealDamage(attacker,target,amount,type);
    damageVectors.push({...input,amount,type,dealt:result.dealt,after:target});
  }
  const randomVectors = [];
  for (const seed of [1,123,4294967295,'雪域']) {
    const service = new randomModule.SeededRandomService(seed);
    const calls = [['battle','target'],['loot','reward'],['card','shuffle'],['legacy',null],['other','target'],['status','enemy']];
    randomVectors.push({ seed,calls,values:calls.map(([stream,purpose])=>service.random(stream,purpose)) });
  }
  fs.writeFileSync(path.join(taskDir,'source-vectors.json'),JSON.stringify({ chestVectors,contentVectors,damageVectors,randomVectors },null,2)+'\n');
} finally { await server.close(); }
