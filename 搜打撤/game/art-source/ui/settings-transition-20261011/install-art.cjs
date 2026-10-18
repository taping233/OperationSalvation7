const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/太平/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

async function main() {
  const project = path.resolve(__dirname, '../../../..');
  const generated = 'C:/Users/太平/.codex/generated_images/01a12a83-ee5f-73b0-bbce-a25457648258/exec-2346f370-64b6-417c-bb65-f02fd28265c1.png';
  const source = path.join(__dirname, 'settings-imagegen-v1.png');
  const output = path.join(project, 'game/assets/ui/settings-shutter-1011.webp');
  fs.copyFileSync(generated, source);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(source).resize({ width: 1344, withoutEnlargement: true }).webp({ quality: 88 }).toFile(output);
  const describe = file => ({ path: path.relative(project, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') });
  const receipt = {
    acquisition: 'NovelAI draft -> built-in imagegen redraw -> sharp WebP encoding; originals retained',
    generatedSource: generated,
    styleReference: describe(path.join(project, 'game/assets/portraits/full/wu.webp')),
    novelai: describe(path.join(__dirname, 'settings-nai-v1.png')),
    imagegen: describe(source),
    runtime: describe(output),
    largeBinaryPolicy: 'PNG originals over 1MB stay local; paths, SHA256 and acquisition recorded here',
  };
  fs.writeFileSync(path.join(__dirname, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ runtime: receipt.runtime, sourceBytes: receipt.imagegen.bytes }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
