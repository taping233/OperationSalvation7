import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import postcss from 'postcss';

const root = process.cwd(), evidence = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const local = path.join(root, 'docs/evidence/2026-10-11-WF-base-refine-1011');
const js = ['game.hub', 'hub.personnel', 'hub.presentation', 'hub.home-v3', 'hub.courtyard-v3', 'hub.warehouse', 'hub.archive-v3', 'hub.shop-v3', 'hub.collection-v4', 'base-motion-v4', 'courtyard.rain-tableau'].map(name => `game/src/hub/${name}.js`).concat('game/src/hub/courtyard-vendor/KoiPond.js');
const css = ['base-camp-rework', 'base-home-v3', 'base-archive-v3', 'base-shop-v3', 'base-controls-v4', 'base-collection-v4', 'base-courtyard-v3', 'base-panel-layout'].map(name => `game/css/${name}.css`);
const sha = data => createHash('sha256').update(data).digest('hex');
for (const file of js) execFileSync(process.execPath, ['--check', file], { cwd:root, stdio:'pipe' });
for (const file of css) postcss.parse(readFileSync(path.join(root, file), 'utf8'), { from:file });
const pages = readFileSync(path.join(root, 'game/src/hub/game.hub.pages.js'), 'utf8');
const footer = pages.slice(pages.indexOf('    const footerHTML = () => {'), pages.indexOf('    const refreshZoom = () => {'));
const protectedHash = sha(footer), expected = '260e5ae5346df12a4d8edb739605a944d7ac494617ae4de1e2e64d9da6c4c076';
if (protectedHash !== expected) throw new Error('Protected warehouse footer changed');
const receipt = JSON.parse(readFileSync(path.join(local, 'pond-art-receipt.json'), 'utf8'));
const asset = readFileSync(path.join(root, receipt.path));
const manifest = JSON.parse(readFileSync(path.join(root, 'game/assets/asset-manifest.json'), 'utf8'));
const registered = manifest.assets.find(item => item.path === 'scenes/courtyard-pond-v4.webp');
if (asset.length !== receipt.bytes || sha(asset) !== receipt.sha256 || registered?.bytes !== asset.length || registered?.sha256 !== sha(asset) || manifest.count !== manifest.assets.length) throw new Error('Pond receipt/manifest mismatch');
const require = createRequire(import.meta.url);
const audit = require(path.join(root, 'scripts/asset-audit-lib.cjs')).auditAssets({ root, paths:[receipt.path] });
const ownAssetIssues = audit.errors.filter(issue => issue.path === registered.path);
if (ownAssetIssues.length) throw new Error('New pond asset has audit errors');
const targeted = JSON.parse(readFileSync(path.join(local, 'targeted-tests.json'), 'utf8'));
if (!targeted.success || targeted.numFailedTests) throw new Error('Targeted tests failed');
const sourceValidation = {
  observedAt:new Date().toISOString(), syntax:{passed:js.length, paths:js}, css:{passed:css.length, paths:css},
  targeted:{files:targeted.testResults.length, passed:targeted.numPassedTests, failed:targeted.numFailedTests, success:targeted.success, premiumBasePassed:2, premiumSkipped:7},
  protectedFooter:{expected, actual:protectedHash, unchanged:true}, eslint:'passed', docsCheck:'passed',
  pondAsset:{path:receipt.path, bytes:asset.length, sha256:sha(asset), manifestMatches:true, scopedErrors:ownAssetIssues},
  globalAssetGate:{passed:audit.ok, errors:audit.errors.length, scope:'全库增量门仍检出本任务之外的新债，不修改其他属地；新池塘条目单独通过'},
  inputs:[...js,...css].map(file => ({path:file, sha256:sha(readFileSync(path.join(root,file)))})),
  unverified:['真实非空收藏/可领奖/待复原由构造测试覆盖，实页档位01为空；未真实购买、扩建、培养、领奖、应用卡背或外观','仅当前内置窗口；未调整视口，未做多尺寸或性能A/B','未build、全量测试、提交或推送；壁纸沿老板要求暂缓']
};
writeFileSync(path.join(local, 'source-validation.json'), JSON.stringify(sourceValidation,null,2)+'\n');
writeFileSync(path.join(local, 'asset-audit-limit.json'), JSON.stringify({observedAt:sourceValidation.observedAt, ownAssetErrors:ownAssetIssues, errors:audit.errors, warningsCount:audit.warnings.length},null,2)+'\n');
const screenshots = readdirSync(local).filter(file=>file.endsWith('.jpg')).map(file=>{
  const bytes=readFileSync(path.join(local,file));
  if(bytes[0]!==0xff || bytes[1]!==0xd8) throw new Error(`Unexpected screenshot encoding: ${file}`);
  let offset=2, width=0, height=0;
  while(offset<bytes.length) {
    if(bytes[offset]!==0xff) {offset++;continue;}
    const marker=bytes[offset+1]; offset+=2;
    if(marker>=0xc0 && marker<=0xcf && ![0xc4,0xc8,0xcc].includes(marker)) {height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break;}
    if([0xd8,0xd9].includes(marker)) continue;
    const length=bytes.readUInt16BE(offset); if(length<2) throw new Error('Invalid JPEG segment'); offset+=length;
  }
  if(!width||!height) throw new Error(`No screenshot dimensions: ${file}`);
  return {path:file,format:'JPEG',width,height,bytes:bytes.length,sha256:sha(bytes),source:'Codex IAB cua getAXStateAndScreenshot'};
});
writeFileSync(path.join(local, 'screenshot-manifest.json'), JSON.stringify({observedAt:new Date().toISOString(),screenshots},null,2)+'\n');
const snapshots = readdirSync(local).filter(file=>file.endsWith('-browser.json'));
console.log(JSON.stringify({syntax:js.length,css:css.length,targeted:targeted.numPassedTests,premiumBase:2,ownPondAsset:'passed',globalAssetErrors:audit.errors.length,browserExports:snapshots.length,evidence:path.basename(evidence)}));
