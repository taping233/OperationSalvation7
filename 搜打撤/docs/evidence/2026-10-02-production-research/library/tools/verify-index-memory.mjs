// Executes only this library's own inline index script in the installed jsdom.
// No resource loader, browser, service, screenshots or downloaded source code.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const errors = [], checks = [];
const assert = (condition, name, detail) => {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) errors.push(name + ': ' + detail);
};
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', error => errors.push(error.message));
const dom = new JSDOM(html, { url: pathToFileURL(indexPath).href, runScripts: 'dangerously', virtualConsole });
const { document, Event } = dom.window;
const cards = () => [...document.querySelectorAll('#cards article')];
const select = (id, value) => {
  const input = document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
assert(cards().length === 38, 'default', 'Expected 38; actual ' + cards().length);
assert(document.querySelectorAll('#category option').length === 9, 'eight category options', 'All plus eight categories');
select('category', 'art-audio');
assert(cards().length === 3, 'category art-audio', 'Expected 3; actual ' + cards().length);
select('category', ''); select('useStatus', 'usable');
assert(cards().length === 3, 'useStatus usable', 'Expected 3; actual ' + cards().length);
select('useStatus', ''); select('downloaded', 'true');
assert(cards().length === 7, 'downloaded true', 'Expected 7; actual ' + cards().length);
select('downloaded', ''); select('query', 'MinHeap');
assert(cards().length === 1 && cards()[0].id === 'rot-js', 'MinHeap search', 'Expected sole rot-js; actual ' + cards().map(c => c.id).join(','));
document.querySelector('button[type="reset"]').click();
await new Promise(resolve => dom.window.setTimeout(resolve, 10));
assert(cards().length === 38 && ['query', 'category', 'useStatus', 'downloaded'].every(id => document.getElementById(id).value === ''), 'clear filters', 'Expected empty controls and 38 records; actual ' + cards().length);
select('category', 'open-source'); select('useStatus', 'evaluate'); select('downloaded', 'true');
assert(cards().length === 5, 'combined filters', 'Expected 4 source subsets plus 2048; actual ' + cards().length);
select('query', 'there-is-no-such-resource-6ba290');
assert(cards().length === 0 && document.querySelector('.empty'), 'no match', 'Expected clear empty-state message');
document.getElementById('filters').reset();
await new Promise(resolve => dom.window.setTimeout(resolve, 10));
const localLinks = [...document.querySelectorAll('a[href]')].filter(a => a.protocol === 'file:');
for (const anchor of localLinks) {
  const localPath = fileURLToPath(anchor.href);
  assert(localPath.startsWith(root + path.sep) && fs.existsSync(localPath), 'local reference path', anchor.getAttribute('href'));
}
assert(document.querySelectorAll('a[download]').length === 40, '40 payload links', 'Expected all manifest files, actual ' + document.querySelectorAll('a[download]').length);
assert([...document.querySelectorAll('a[href]')].every(a => ['file:', 'https:'].includes(a.protocol)), 'link schemes', 'Only local file references or HTTPS sources');
assert(document.querySelectorAll('a[href="null"]').length === 0 && html.includes('未见开放复用许可'), 'unknown permissions', 'No null URL links; readable reference-only license boundary');
assert(document.querySelectorAll('#cards details').length === 38, 'expandable record details', 'One native details per record');
const deepLinks = [...document.querySelectorAll('#cards a')].filter(a => a.textContent === '深读方法卡');
assert(deepLinks.length === 4 && deepLinks.every(a => fs.readFileSync(fileURLToPath(a.href), 'utf8').includes('id="' + decodeURIComponent(a.hash.slice(1)) + '"')), 'four deep-read links and anchors', 'Each method card links to its explicit anchor');
select('query', '真正消费参数');
assert(cards().some(c => c.id === 'fp-gamedevbench'), 'method content searchable', 'Search includes upgraded method and experiment fields');
document.getElementById('filters').reset();
await new Promise(resolve => dom.window.setTimeout(resolve, 10));
assert(document.getElementById('results').getAttribute('aria-live') === 'polite', 'live result count markup', 'Markup only; assistive technology behavior unverified');
dom.window.close();
const report = {
  checkedAt: new Date().toISOString(), result: errors.length ? 'failed' : 'passed',
  method: 'Existing project jsdom; library-authored inline script only; pure memory DOM/events; resource loading disabled by default; no browser or rendering',
  indexSha256: crypto.createHash('sha256').update(html).digest('hex'),
  checks, errors,
  browserAcceptance: { result: 'blocked', reason: 'Current-platform built-in browser rejected file URL by URL safety policy: HTTP/HTTPS only. No service, borrowed port, alternate browser or policy workaround used.', visualVerified: false, realBrowserInputVerified: false },
  limitations: ['DOM/event checks do not prove rendered layout, pixels, keyboard behavior, screen-reader behavior or real browser file-link handling', 'User can open index.html locally; external source links require network']
};
fs.writeFileSync(path.join(root, 'index-memory-validation.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ result: report.result, checks: checks.length, localReferenceLinks: localLinks.length, indexSha256: report.indexSha256, errors }, null, 2));
if (errors.length) process.exitCode = 1;
