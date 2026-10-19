// One-shot audit export. The catalog is assembled in memory, never from a player's save.
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://audit.local/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.MutationObserver = dom.window.MutationObserver;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.CustomEvent = dom.window.CustomEvent;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
window.SDT = { Icons: { img: () => '', TYPE_ART: {} } };
const server = await createServer({ configFile: false, root: path.join(root, 'game'),
  server: { middlewareMode: true, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
try {
  await server.ssrLoadModule('/src/cards/cards.js');
  const cards = window.SDT.Cards;
  cards.ensureSha(); cards.ensureStarters(); cards.ensureTabletop(); cards.ensureDmgTypes(); cards.ensureEffectFields();
  const catalog = cards.all().slice().sort((a, b) => a.id.localeCompare(b.id));
  if (!catalog.length || new Set(catalog.map(card => card.id)).size !== catalog.length) throw new Error('Empty or duplicate runtime catalog');
  const counts = {};
  for (const card of catalog) counts[card.type] = (counts[card.type] || 0) + 1;
  const output = path.join(root, 'docs/evidence/2026-10-19-card-description-audit/catalog.json');
  writeFileSync(output, JSON.stringify({ capturedAt: new Date().toISOString(), source: 'fresh in-memory production catalog with normal seed/migrations', count: catalog.length, counts, cards: catalog }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output, count: catalog.length, counts }));
} finally { await server.close(); dom.window.close(); }
