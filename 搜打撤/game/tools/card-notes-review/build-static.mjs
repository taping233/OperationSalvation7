// Rebuild only on an explicit review release. The uppercase .HTML route is served
// verbatim by the current Vite static middleware, without its development client.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const catalog = JSON.parse(read('game/tools/card-notes-review/catalog.json'));
const baseline = JSON.parse(read('game/data/card-notes.json'));
const dom = new JSDOM('', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in globalThis)) Object.defineProperty(globalThis, key, { get: () => dom.window[key], configurable: true });
}
window.matchMedia = () => ({ matches: false, addEventListener() {} });
const server = await createServer({ root: path.join(root, 'game'), server: { middlewareMode: true }, appType: 'custom' });
try {
  const { Art } = await server.ssrLoadModule('/src/core/art.js');
  const { displayCardDescription } = await server.ssrLoadModule('/src/cards/card-description-text.js');
  for (const card of catalog.cards) {
    card.reviewArt = Art.cardIcon(card, { low: true });
    card.reviewDescription = displayCardDescription(card.desc, card.id, card);
  }
} finally {
  await server.close();
  dom.window.close();
}
const app = read('game/tools/card-notes-review/app.js').split('\n').filter(line => !line.startsWith('import ')).join('\n');
const script = `const catalog=${JSON.stringify(catalog)};\nconst baseline=${JSON.stringify(baseline)};\nconst Art={cardIcon:c=>c.reviewArt};\nconst displayCardDescription=(desc,id,c)=>c.reviewDescription;\nconst esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));\n${app}\nwindow.addEventListener('beforeunload',e=>{if(editing&&$('editor').open&&$('note').value.trim()!==noteFor(editing)){e.preventDefault();e.returnValue='';}});\nif(!$('notice').textContent)$('notice').textContent='静态审阅版 · 已沿用此浏览器原有修改与审阅进度。';\n`.replace(/<\/script/gi, '<\\/script');
const digest = createHash('sha256').update(script).digest('base64');
const policy = `default-src 'self'; script-src 'sha256-${digest}'; style-src 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; object-src 'none'`;
let html = read('game/card-notes-review.html')
  .replace('<meta charset="UTF-8">', `<meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="${policy}">`)
  .replace('<title>卡牌备注 · 审阅手册</title>', '<title>卡牌备注 · 静态审阅版</title>')
  .replace('<link rel="stylesheet" href="/tools/card-notes-review/style.css">', `<style>${read('game/tools/card-notes-review/style.css')}</style>`)
  .replaceAll('/card-notes-review.html', '/card-notes-review-static.HTML')
  .replace('文案审阅 · 2026.10.26', '静态审阅 · 2026.10.26')
  .replace('<script type="module" src="/tools/card-notes-review/app.js"></script>', `<script>${script}</script>`);
const target = path.join(root, 'game/card-notes-review-static.HTML');
fs.writeFileSync(target, html, 'utf8');
console.log(JSON.stringify({ file: target, cards: catalog.cards.length, bytes: Buffer.byteLength(html), sha256: createHash('sha256').update(html).digest('hex') }));
