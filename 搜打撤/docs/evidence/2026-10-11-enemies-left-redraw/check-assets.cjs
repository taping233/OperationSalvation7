const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const { auditAssets } = require(path.join(root, 'scripts/asset-audit-lib.cjs'));
const receiptPath = path.join(__dirname, 'receipt.json');
const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
const selected = receipt.items.flatMap(item => item.outputs.map(output => output.path));
const selectedAssets = new Set(selected.map(value => value.slice('game/assets/'.length)));
const result = auditAssets({ root, paths: selected });
const issues = result.issues.filter(issue => selectedAssets.has(issue.path) || issue.code === 'count-mismatch');
const summary = {
  checked_paths: selected.length,
  errors: issues,
  unrelated_issues_not_reviewed: result.issues.length - issues.length,
  scope: 'Only the 54 enemy asset outputs and manifest count; other work is excluded.'
};
fs.writeFileSync(path.join(__dirname, 'asset-check.json'), JSON.stringify(summary, null, 2) + '\n');
receipt.verification.asset_check = { checked_paths: selected.length, errors: issues.length,
  evidence: 'docs/evidence/2026-10-11-enemies-left-redraw/asset-check.json' };
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify(summary));
if (issues.length) process.exitCode = 1;
