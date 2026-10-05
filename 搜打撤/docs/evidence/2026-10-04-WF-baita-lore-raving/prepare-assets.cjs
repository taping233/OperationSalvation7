// Only encode the generated artwork and reproduce the existing thumbnail bake.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/太平/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../../..');
const local = path.join(root, '.tmp/imagegen/baita-lore-raving-20261004');
const version = process.argv[2] || 'v1';
const generated = process.argv[3] || 'C:/Users/太平/.codex/generated_images/01a10695-8871-75e0-99c4-6cf3fb6399fb/exec-12cb86f6-dee1-4728-847d-5c9636153320.png';
const outputs = ['game/assets/cards/lore-raving.webp', 'game/assets/thumbs/cards/lore-raving.webp'];
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
async function info(file) { const m = await sharp(file).metadata(); return {path: path.relative(root, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: digest(file), width:m.width, height:m.height}; }
(async () => {
  const backupDir = version === 'v1' ? 'originals' : 'originals-before-' + version;
  fs.mkdirSync(path.join(local, backupDir), {recursive:true});
  const originals = [];
  for (const rel of outputs) {
    const source = path.join(root, rel);
    const backup = path.join(local, backupDir, rel.includes('/thumbs/') ? 'thumb-lore-raving.webp' : 'lore-raving.webp');
    if (fs.existsSync(backup)) throw new Error('Backup exists; refuse to replace original evidence');
    fs.copyFileSync(source, backup);
    originals.push(await info(backup));
  }
  const raw = path.join(local, 'lore-raving-' + version + '.png');
  fs.copyFileSync(generated, raw);
  const full = path.join(root, outputs[0]);
  await sharp(raw).webp({quality:90, effort:6}).toFile(full);
  const resized = await sharp(full).resize({width:448}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const matrix = [[1.087994,0.003705,0.005219],[0.006245,1.079741,0.004274],[0.002781,-0.006867,1.082379]];
  const data = resized.data;
  for(let i=0;i<data.length;i+=3) {
    const rgb = [data[i]/255,data[i+1]/255,data[i+2]/255];
    for(let c=0;c<3;c++) data[i+c]=Math.max(0,Math.min(255,Math.round((matrix[c].reduce((s,v,k)=>s+v*rgb[k],0)-0.02575)*255)));
  }
  await sharp(data,{raw:{width:resized.info.width,height:resized.info.height,channels:3}}).webp({quality:82, effort:6}).toFile(path.join(root,outputs[1]));
  const report = {method:'Built-in imagegen; Sharp only encodes and applies the existing bake-card-thumbs.cjs thumbnail matrix', raw:await info(raw), originals, outputs:await Promise.all(outputs.map(rel=>info(path.join(root,rel))))};
  fs.writeFileSync(path.join(__dirname, version === 'v1' ? 'images.json' : 'images-' + version + '.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
