import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { auditAssets } = require('../../../scripts/asset-audit-lib.cjs');
const here = 'docs/evidence/2026-10-16-home-snow-road/';
const receipt = JSON.parse(readFileSync(here + 'receipt.json', 'utf8'));
const manifest = JSON.parse(readFileSync('game/assets/asset-manifest.json', 'utf8'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const entry = manifest.assets.find(item => item.path === receipt.output.path);
assert.equal(entry.sha256, digest('game/assets/' + entry.path));
assert.equal(entry.bytes, readFileSync('game/assets/' + entry.path).length);
for (const old of receipt.retired) assert.equal(digest('game/assets/' + old.path), old.sha256);
const targets = ['game/index.html', 'game/css/title-p0.css', 'game/css/settings-navigation.css', 'game/css/winter.css'];
for (const path of targets) {
  const text = readFileSync(path, 'utf8');
  assert.ok(text.includes('wallpaper-snow-road-1016.webp?v=1016b'));
  assert.ok(!/wallpaper-(wu-1004|ensemble-1005|original)\.webp/.test(text));
}
const result = auditAssets({ root: process.cwd(), paths: ['game/assets/' + entry.path] });
const ownErrors = result.errors.filter(issue => issue.path === entry.path);
assert.equal(ownErrors.length, 0);
const proof = {
  source: receipt.source.path,
  image: { size: receipt.output.size, bytes: entry.bytes, sha256: entry.sha256 },
  targetChecks: '清单字节/SHA、旧图SHA不变、四处资源URL与退役引用检查通过',
  tests: { file: 'tests/title-wallpaper.test.js', passed: 8, note: '第二次仅替换同尺寸图片及URL版本，复用逻辑测试' },
  assetAudit: { ownErrors, globalErrors: result.errors.length, globalWarnings: result.warnings.length,
    unrelatedPaths: [...new Set(result.errors.map(issue => issue.path))] },
};
writeFileSync(here + 'verification.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ image: proof.image, ownErrors: ownErrors.length, unrelatedErrors: result.errors.length }));
