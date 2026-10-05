const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/太平/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../../..');
const generated = 'C:/Users/太平/.codex/generated_images/01a106bd-b41c-7132-8ce4-6af29cc0327d/exec-4c32838e-c320-4072-bdf3-eb88dbe63585.png';
const raw = path.join(root, '.tmp/imagegen/volcano-v4-reference-20261004/volcano-v1.png');
const out = path.join(root, 'game/art-source/cards/hero-volcano-v4-reference-20261004.webp');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
(async () => {
  fs.mkdirSync(path.dirname(raw), {recursive:true});
  fs.mkdirSync(path.dirname(out), {recursive:true});
  fs.copyFileSync(generated, raw);
  await sharp(raw).webp({quality:90, effort:6}).toFile(out);
  const report = {method:'Built-in imagegen; Sharp performs format encoding only', styleReference:'../WF-baita-lore-raving/prompt-v4-reference-analysis.txt and user-approved generated v4 artwork', identityReference:'docs/character-bible/ref-images/changwuyu.webp', raw:{path:path.relative(root,raw).replaceAll('\\','/'),bytes:fs.statSync(raw).size,sha256:hash(raw),obtainedFrom:generated}, candidate:{path:path.relative(root,out).replaceAll('\\','/'),bytes:fs.statSync(out).size,sha256:hash(out)}, integration:'Independent candidate; active WF-changwuyu-volcano runtime assets preserved', verification:'Not performed, per user instruction'};
  fs.writeFileSync(path.join(__dirname,'images.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
