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
  const baseline=Cards.all().map(card=>card.id);
  const targetIndex=5,original=Cards.all()[targetIndex];
  const edited={...original,desc:'source override example'};Cards.upsert(edited);
  const first=Cards.all();
  const added={...original,id:'fidelity-only-new',name:'source new example',desc:'new example'};Cards.upsert(added);
  const after=Cards.all();
  const result={baseline, targetId:original.id, targetIndex,
    override:{count:first.length,sameId:first.filter(c=>c.id===original.id).length,index:first.findIndex(c=>c.id===original.id),desc:first.find(c=>c.id===original.id).desc,ids:first.map(c=>c.id)},
    append:{count:after.length,index:after.findIndex(c=>c.id===added.id),ids:after.map(c=>c.id)},
    serialized:JSON.parse(localStorage.getItem('sdt-cards-v1'))};
  fs.writeFileSync(path.join(taskDir,'source-custom-merge.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({baseline:baseline.length,override:result.override.count,overrideSameId:result.override.sameId,newTotal:result.append.count}));
} finally { await server.close(); }