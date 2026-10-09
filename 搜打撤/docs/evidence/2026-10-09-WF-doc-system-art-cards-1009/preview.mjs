import { JSDOM } from 'jsdom';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCompendium } from '../../../scripts/generate-compendium.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const live = path.join(root, 'docs/game-compendium.md');
const before = readFileSync(live);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} },
  MAP: { rules: { battleEnergy: 99, battleHandMax: 99 }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } } };
await import('../../../game/src/cards/cards.js');
const { DATA } = await import('../../../game/src/core/data-loader.js');
const Cards = window.SDT.Cards;
Cards.ensureTabletop();
const output = buildCompendium({ Cards, syncData: DATA.cardsSync, achievements: DATA.achievements,
  pets: DATA.pets, scenes: DATA.scenes, mapData: DATA.map, generatedAt: '2026-10-09' });
if (!readFileSync(live).equals(before)) throw new Error('Live compendium changed while building preview');
writeFileSync(path.join(here, 'game-compendium-preview.md'), output, 'utf8');
dom.window.close();
console.log(JSON.stringify({ preview: 'game-compendium-preview.md', cards: Cards.all().length, bytes: Buffer.byteLength(output), liveDocumentUnchanged: true }));
