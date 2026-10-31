import fs from 'node:fs';
import vm from 'node:vm';
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
  const { Cards } = await load('cards/cards.js');
  Cards.STARTERS.forEach((card, index) => { if (!card.id) card.id = `starter-${index + 1}`; });
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const { displayCardDescription } = await load('cards/card-description-text.js');
  const { TERM_TIPS, TERM_KEYWORDS } = await load('ui/term-definitions.js');
  const source = fs.readFileSync(path.join(sourceRoot,'game/src/cards/card-description-text.js'),'utf8');
  const revisions = [...vm.runInNewContext(source.match(/const descriptions = new Map\((\[[\s\S]*?\n\])\);/)[1])].map(([id,[original,reviewed]])=>({id,original,reviewed}));
  const termSource=fs.readFileSync(path.join(sourceRoot,'game/src/ui/term-tips.js'),'utf8');
  const aliases=vm.runInNewContext('('+termSource.match(/const TERM_ALIAS = (\{[\s\S]*?\n\});/)[1]+')',{TERM_KEYWORDS});
  const richSource=fs.readFileSync(path.join(sourceRoot,'game/src/cards/cards.view.js'),'utf8');
  const words=vm.runInNewContext(richSource.match(/const DESC_TERMS = (\[.*?\]);/)[1]);
  const descriptions = Cards.all().map(card => ({id:card.id, original:card.desc || '', display:displayCardDescription(card.desc,card.id,card)}));
  const { registerBattleValueProvider } = await load('cards/battle-value-context.js');
  const { registerCardStateProvider } = await load('cards/card-state-presentation.js');
  const cases = Cards.all().map(card=>({card,context:null,expected:displayCardDescription(card.desc,card.id,card)}));
  registerBattleValueProvider(()=>({active:true,atk:7,spellPower:3}));
  for(const card of Cards.all()) cases.push({card,context:{Attack:7,SpellPower:3},expected:displayCardDescription(card.desc,card.id,card)});
  registerBattleValueProvider(null);
  for(const original of Cards.all()) {
    if(!['heal','draw','armor'].some(k=>Number(original[k])>0)) continue;
    const card=JSON.parse(JSON.stringify(original));for(const key of ['heal','draw','armor'])if(Number(card[key])>0)card[key]+=2;
    cases.push({card,context:null,expected:displayCardDescription(card.desc,card.id,card)});
  }
  const star=Cards.all().find(c=>c.id==='tt13-astrolabe');
  for(const phase of [0,1,2])for(const triggered of [false,true]){
    const card={...star,_presentation:{uid:'photo-oracle'}};
    registerCardStateProvider(()=>({snapshot:{turn:phase+1,pstat:{requestedCards:{astrolabes:{'photo-oracle':{firstTurn:1,turn:phase+1,triggered}}}}}}));
    cases.push({card,context:{AstrolabePhase:phase,AstrolabeTriggered:triggered},expected:displayCardDescription(card.desc,card.id,card)});
  }
  registerCardStateProvider(null);
  const destination = path.join(unityRoot,'Assets/Resources/Art/CurrentPhoto/descriptions.json');
  fs.writeFileSync(destination,JSON.stringify({revisions,terms:Object.entries(TERM_TIPS).map(([key,value])=>({key,...value})),aliases:Object.entries(aliases).map(([word,key])=>({word,key})),words},null,2)+'\n');
  fs.writeFileSync(path.join(taskDir,'copy-vectors.json'),JSON.stringify({descriptions,cases},null,2)+'\n');
  console.log(JSON.stringify({descriptions:descriptions.length,changed:descriptions.filter(d=>d.original!==d.display).length}));
} finally { await server.close(); }
