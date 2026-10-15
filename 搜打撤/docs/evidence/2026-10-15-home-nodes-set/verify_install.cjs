const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const { auditAssets } = require('../../../scripts/asset-audit-lib.cjs');
const root = path.resolve(__dirname, '../../..');
const receipt = JSON.parse(fs.readFileSync(path.join(__dirname, 'install-receipt.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'game/assets/asset-manifest.json'), 'utf8'));
const document = new JSDOM(fs.readFileSync(path.join(root, 'game/index.html'), 'utf8')).window.document;
function check(value, message) { if (!value) throw new Error(message); }
for (const item of receipt.items) {
  const file = path.join(root, item.path);
  const bytes = fs.readFileSync(file);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const relative = item.path.replace('game/assets/', '');
  const entries = manifest.assets.filter(entry => entry.path === relative);
  check(entries.length === 1, `manifest duplicate/missing: ${relative}`);
  check(entries[0].bytes === bytes.length && entries[0].sha256 === hash && hash === item.sha256, relative);
  const button = document.getElementById(item.button);
  check(button?.tagName === 'BUTTON', item.button);
  check(button.querySelector('.home-node-icon')?.getAttribute('src') === item.path.replace('game/', ''), item.button);
  check(!button.querySelector('svg.home-line-icon'), `old icon: ${item.button}`);
  check(button.querySelector('.home-button-cn')?.textContent.trim(), `label: ${item.button}`);
}
check(manifest.count === manifest.assets.length, 'manifest count');
check(document.querySelectorAll('#title .home-node-icon').length === 7, 'seven icons');
const audit = auditAssets({ root, paths: receipt.items.map(item => item.path) });
const scope = new Set(receipt.items.map(item => item.path.replace('game/assets/', '')));
const relatedErrors = audit.errors.filter(issue => scope.has(issue.path));
check(relatedErrors.length === 0, JSON.stringify(relatedErrors));
const result = { icons: 7, ownManifestAndHashes: 'passed', ownAssetIssues: relatedErrors,
  globalAssetAudit: { passed: audit.ok, unrelatedErrors: audit.errors.length, historicalWarnings: audit.warnings.length },
  scope: 'Homepage icon assets and references only; global unrelated asset debt not repaired' };
fs.writeFileSync(path.join(__dirname, 'install-static-check.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result));
